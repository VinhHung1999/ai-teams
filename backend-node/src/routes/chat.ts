import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { createInterface } from 'readline';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import chokidar from 'chokidar';
import storage from '../lib/JsonStorage';
import { pushNotify } from './push';

const execAsync = promisify(exec);
const router = Router();

// ── Types ──

export type ChatEvent = {
  id: string;
  role: 'PO' | 'DEV' | 'BOSS';
  targetRole?: 'PO' | 'DEV'; // BOSS messages: which pane's JSONL they came from
  sessionId: string;
  timestamp: string;
  kind: 'message' | 'tool_use' | 'tool_result';
  text?: string;
  pending?: boolean; // [367] queued_command attachment, agent hasn't processed yet
  attachment?: { filename: string; url: string; isImage: boolean }; // [408]
  question?: { text: string; options: string[]; toolUseId: string }; // [409]
  tool?: {
    name: string;
    input?: any;
    output?: any;
    isError?: boolean;
    toolUseId?: string;
  };
};

// ── Helpers ──

function encodeCwd(cwd: string): string {
  // Claude replaces both / and _ with - when encoding the cwd into a folder name
  return cwd.replace(/[/_]/g, '-');
}

function claudeProjectsFolder(cwd: string): string {
  return path.join(os.homedir(), '.claude', 'projects', encodeCwd(cwd));
}

function loadSessionsMap(workingDir: string): Record<string, { session_id: string; cwd: string }> {
  const mapPath = path.join(workingDir, '.ai-teams-sessions.json');
  if (!fs.existsSync(mapPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    return data.roles || {};
  } catch {
    return {};
  }
}

// [378] Content-hash ID for pending events: attachment + queue-operation with same text → same id → dedup
function contentKey(text: string): string {
  return Buffer.from(text.trim().slice(0, 64)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
}

// Parses one JSONL line into zero or more ChatEvents.
// toolUseMap accumulates tool_use id→{name,input} for pairing with tool_results.
function parseJsonlLine(
  line: string,
  fileRole: 'PO' | 'DEV',
  sessionId: string,
  toolUseMap: Map<string, { name: string; input: any; hidden?: boolean }>,
): ChatEvent[] {
  let d: any;
  try { d = JSON.parse(line); } catch { return []; }

  const ts: string = d.timestamp;
  if (!ts) return [];

  const events: ChatEvent[] = [];

  // [345] Role retag: only '[via UI] BOSS:' → BOSS; 'PO [HH:mm]:' → PO/DEV; else → fileRole
  const BOSS_PREFIX_RE   = /^\[via UI\]\s*BOSS:\s*/;
  const SENDER_PREFIX_RE = /^([A-Z]{2,})\s*\[\d{1,2}:\d{2}\]:\s*/;

  function retagContent(text: string): { role: 'BOSS' | 'PO' | 'DEV'; text: string; targetRole?: 'PO' | 'DEV' } {
    if (BOSS_PREFIX_RE.test(text)) {
      // [358] BOSS messages belong to the pane whose JSONL they came from
      return { role: 'BOSS', text: text.replace(BOSS_PREFIX_RE, ''), targetRole: fileRole };
    }
    const m = text.match(SENDER_PREFIX_RE);
    if (m) {
      const senderRole = m[1] as 'PO' | 'DEV';
      return { role: senderRole, text: text.replace(SENDER_PREFIX_RE, '') };
    }
    return { role: fileRole, text };
  }

  if (d.type === 'user') {
    const content = d.message?.content;

    if (typeof content === 'string' && content.trim()) {
      const retagged = retagContent(content);
      // [408] Detect attachment pattern: "📷 Image attached: <name> → /api/attachments/<uuid>"
      const ATTACH_RE = /^(?:📷 Image|📎 File) attached: (.+) → (\/api\/attachments\/.+)$/;
      const attachMatch = retagged.text?.match(ATTACH_RE);
      events.push({
        id: d.uuid || `${ts}-user`,
        role: retagged.role,
        ...(retagged.targetRole ? { targetRole: retagged.targetRole } : {}),
        sessionId,
        timestamp: ts,
        kind: 'message',
        text: retagged.text,
        ...(attachMatch ? { attachment: {
          filename: attachMatch[1],
          url: attachMatch[2],
          isImage: retagged.text!.startsWith('📷'),
        }} : {}),
      });
    } else if (Array.isArray(content)) {
      const textParts = content
        .filter((c: any) => c.type === 'text')
        .map((c: any) => c.text as string)
        .join('');
      if (textParts.trim()) {
        const retagged = retagContent(textParts);
        events.push({
          id: `${d.uuid}:text`,
          role: retagged.role,
          ...(retagged.targetRole ? { targetRole: retagged.targetRole } : {}),
          sessionId,
          timestamp: ts,
          kind: 'message',
          text: retagged.text,
        });
      }
      for (const c of content) {
        if (c.type !== 'tool_result') continue;
        const prior = toolUseMap.get(c.tool_use_id);
        if ((prior as any)?.hidden) continue; // [346] skip result for hidden tm-send tool_use
        const outputText =
          typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
        events.push({
          id: `result:${c.tool_use_id}`,
          role: fileRole,
          sessionId,
          timestamp: ts,
          kind: 'tool_result',
          tool: {
            name: prior?.name || 'unknown',
            input: prior?.input,
            output: outputText,
            isError: !!c.is_error,
            toolUseId: c.tool_use_id,
          },
        });
      }
    }
  } else if (d.type === 'assistant') {
    const content = d.message?.content;
    if (!Array.isArray(content)) return events;

    for (const c of content) {
      if (c.type === 'text' && c.text?.trim()) {
        events.push({
          id: `${d.uuid}:text`,
          role: fileRole,
          sessionId,
          timestamp: ts,
          kind: 'message',
          text: c.text as string,
        });
      } else if (c.type === 'tool_use') {
        // [346] Skip tm-send / tmux send-keys Bash calls — internal plumbing, not content
        const isTmSend = c.name === 'Bash' &&
          /^(tm-send|tmux\s+send-keys)\b/.test(String(c.input?.command ?? ''));
        toolUseMap.set(c.id, { name: c.name, input: c.input, hidden: isTmSend });
        if (isTmSend) {
          // no-op: hidden
        } else if (c.name === 'ask_followup_question' || c.name === 'AskUserQuestion') {
          // [409] Phase 1 — handle both Cline (ask_followup_question) and Claude Code (AskUserQuestion)
          // AskUserQuestion: input.questions[0].{question, options:[{label}]}
          // ask_followup_question: input.{question, options:string[]}
          const q0 = c.input?.questions?.[0];
          const questionText = q0?.question ?? c.input?.question ?? 'Question';
          const optionLabels: string[] = q0?.options
            ? (q0.options as any[]).map((o: any) => o.label ?? String(o))
            : (c.input?.options ?? []) as string[];
          events.push({
            id: c.id,
            role: fileRole,
            sessionId,
            timestamp: ts,
            kind: 'ask_question' as any,
            question: {
              text: questionText,
              options: optionLabels,
              toolUseId: c.id as string,
            },
          });
        } else {
          events.push({
            id: c.id,
            role: fileRole,
            sessionId,
            timestamp: ts,
            kind: 'tool_use',
            tool: {
              name: c.name as string,
              input: c.input,
              toolUseId: c.id as string,
            },
          });
        }
      }
    }
  }
  // [382] attachment queued_command + queue-operation skipped — frontend optimistic covers pending state

  return events;
}

async function parseJsonlFile(
  filePath: string,
  fileRole: 'PO' | 'DEV',
  sessionId: string,
  toolUseMap: Map<string, { name: string; input: any; hidden?: boolean }>,
): Promise<ChatEvent[]> {
  if (!fs.existsSync(filePath)) return [];

  const events: ChatEvent[] = [];
  const rl = createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    events.push(...parseJsonlLine(line, fileRole, sessionId, toolUseMap));
  }
  return events;
}

type RoleInfo = { role: 'PO' | 'DEV'; sessionId: string; folder: string };

function getRoleInfos(workingDir: string): RoleInfo[] {
  const sessionsMap = loadSessionsMap(workingDir);
  return Object.entries(sessionsMap).map(([roleName, info]) => ({
    role: roleName as 'PO' | 'DEV',
    sessionId: info.session_id,
    folder: claudeProjectsFolder(info.cwd),
  }));
}

async function aggregateEvents(projectId: number): Promise<ChatEvent[]> {
  const project = storage.getProject(projectId);
  if (!project?.working_directory) return [];

  const roleInfos = getRoleInfos(project.working_directory);
  if (roleInfos.length === 0) {
    console.warn(`[chat] No sessions map for project ${projectId}`);
    return [];
  }

  // Build sessionId → role map so each file is processed exactly once with correct role
  const sessionToRole = new Map<string, 'PO' | 'DEV'>();
  const folders = new Set<string>();
  for (const { role, sessionId, folder } of roleInfos) {
    sessionToRole.set(sessionId, role);
    folders.add(folder);
  }

  const allEvents: ChatEvent[] = [];
  const toolUseMap = new Map<string, { name: string; input: any }>();
  const processedFiles = new Set<string>();

  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      console.warn(`[chat] Folder not found: ${folder}`);
      continue;
    }

    // Process known-role primary files first so tool_use IDs are registered before tool_results
    const allJsonl = fs.readdirSync(folder)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({ file: path.join(folder, f), sid: path.basename(f, '.jsonl') }));

    const primary = allJsonl.filter(({ sid }) => sessionToRole.has(sid));
    const others = allJsonl.filter(({ sid }) => !sessionToRole.has(sid));

    for (const { file, sid } of [...primary, ...others]) {
      if (processedFiles.has(file)) continue;
      processedFiles.add(file);

      // Unknown session files default to the first role (arbitrary but consistent)
      const fileRole = sessionToRole.get(sid) ?? roleInfos[0].role;
      const events = await parseJsonlFile(file, fileRole, sid, toolUseMap);
      allEvents.push(...events);
    }
  }

  // Sort ascending by timestamp
  allEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // [367] Remove pending events where a confirmed BOSS message with same text exists
  const confirmedBossTexts = new Set(
    allEvents
      .filter(e => e.role === 'BOSS' && e.kind === 'message' && !e.pending)
      .map(e => e.text?.trim() ?? '')
      .filter(Boolean),
  );
  const deconfirmed = confirmedBossTexts.size > 0
    ? allEvents.filter(e => !(e.pending && confirmedBossTexts.has(e.text?.trim() ?? '')))
    : allEvents;

  // [378] Full id-based dedup — queue-operation + attachment in same JSONL both produce
  // pending:<hash> id; without this both survive into history and cause React duplicate-key warning
  const idSeen = new Set<string>();
  return deconfirmed.filter(e => {
    if (idSeen.has(e.id)) return false;
    idSeen.add(e.id);
    return true;
  });
}

// ── Helpers for last-events [350] ──
// Return {lastMessageAt, lastMessageText} based on kind=message events only (not tool cards).

interface LastEventInfo { lastMessageAt: string; lastMessageText: string }

const lastEventsCache = new Map<number, { fetchedAt: number; info: LastEventInfo | undefined }>();
const LAST_EVENTS_TTL = 30_000;

function extractMessageText(d: any): string | undefined {
  if (d.type === 'user') {
    const c = d.message?.content;
    const raw = typeof c === 'string' ? c : Array.isArray(c)
      ? c.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('') : '';
    return raw.trim() || undefined;
  }
  if (d.type === 'assistant') {
    const c = d.message?.content;
    if (!Array.isArray(c)) return undefined;
    const text = c.filter((x: any) => x.type === 'text').map((x: any) => x.text).join('');
    return text.trim() || undefined;
  }
  return undefined;
}

function getLastMessageInfo(projectId: number): LastEventInfo | undefined {
  const project = storage.getProject(projectId);
  if (!project?.working_directory) return undefined;

  const roleInfos = getRoleInfos(project.working_directory);
  const folders = new Set(roleInfos.map((ri) => ri.folder));
  let best: LastEventInfo | undefined;

  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    for (const f of fs.readdirSync(folder).filter((f) => f.endsWith('.jsonl'))) {
      const filePath = path.join(folder, f);
      try {
        const stat = fs.statSync(filePath);
        if (stat.size === 0) continue;
        // Read last 4KB to find the last user/assistant text message
        const readSize = Math.min(4096, stat.size);
        const buf = Buffer.alloc(readSize);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, readSize, stat.size - readSize);
        fs.closeSync(fd);
        const lines = buf.toString('utf-8').split('\n').filter((l) => l.trim());
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const d = JSON.parse(lines[i]);
            if (!d.timestamp) continue;
            const text = extractMessageText(d);
            if (text) {
              const stripped = text.replace(/^\[via UI\]\s*BOSS:\s*/, '').replace(/^([A-Z]{2,})\s*\[\d{1,2}:\d{2}\]:\s*/, '');
              if (!best || d.timestamp > best.lastMessageAt) {
                best = { lastMessageAt: d.timestamp, lastMessageText: stripped.slice(0, 80) };
              }
              break;
            }
          } catch {}
        }
      } catch {}
    }
  }
  return best;
}

function getLastMessageInfoCached(projectId: number): LastEventInfo | undefined {
  const cached = lastEventsCache.get(projectId);
  if (cached && Date.now() - cached.fetchedAt < LAST_EVENTS_TTL) return cached.info;
  const info = getLastMessageInfo(projectId);
  lastEventsCache.set(projectId, { fetchedAt: Date.now(), info });
  return info;
}

// ── REST: GET /api/chat/last-events?projectIds=1,2,3 ──
// Returns {[id]: {lastMessageAt, lastMessageText}} — only kind=message events

router.get('/api/chat/last-events', async (req: Request, res: Response) => {
  const param = req.query.projectIds as string;
  if (!param) return res.json({});
  const ids = param.split(',').map(Number).filter((n) => !isNaN(n));
  const result: Record<number, LastEventInfo> = {};
  for (const id of ids) {
    const info = getLastMessageInfoCached(id);
    if (info) result[id] = info;
  }
  res.json(result);
});

// ── REST: GET /api/chat/:projectId/history ──

router.get('/api/chat/:projectId/history', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'invalid projectId' });

  const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
  const before = req.query.before as string | undefined;

  try {
    const all = await aggregateEvents(projectId);
    const filtered = before ? all.filter(e => e.timestamp < before) : all;
    // [347] Sort DESC → take newest N → sort ASC for frontend rendering
    const newest = filtered
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    res.json({ events: newest, total: filtered.length });
  } catch (e: any) {
    console.error(`[chat] history error project ${projectId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── REST: POST /api/chat/:projectId/send ──

router.post('/api/chat/:projectId/send', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'invalid projectId' });

  const { role, text } = req.body;
  if (!role || !text) return res.status(400).json({ error: 'role and text required' });

  const project = storage.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'project not found' });

  // Prefer session_name from the sessions map (authoritative) over DB field
  let sessionName = project.tmux_session_name || '';
  if (project.working_directory) {
    try {
      const mapRaw = fs.readFileSync(
        path.join(project.working_directory, '.ai-teams-sessions.json'), 'utf-8'
      );
      const mapData = JSON.parse(mapRaw);
      if (mapData.session_name) sessionName = mapData.session_name;
    } catch {}
  }
  if (!sessionName) return res.status(404).json({ error: 'no tmux session configured' });

  const wrappedText = `[via UI] BOSS: ${text}`;

  try {
    const { stdout } = await execAsync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 3000, encoding: 'utf-8' },
    );

    let paneIdx: string | null = null;
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) { paneIdx = parts[0]; break; }
    }

    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found in session ${sessionName}` });
    }

    await execAsync(`tmux send-keys -t ${sessionName}:0.${paneIdx} ${JSON.stringify(wrappedText)} C-m`);
    await execAsync(`tmux send-keys -t ${sessionName}:0.${paneIdx} C-m`);

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// [409] POST /api/chat/:projectId/respond — Boss answers an ask_followup_question prompt
router.post('/api/chat/:projectId/respond', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'invalid projectId' });

  const { role, value } = req.body;
  if (!role || value === undefined) return res.status(400).json({ error: 'role and value required' });

  const project = storage.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'project not found' });

  const sessionsMap = loadSessionsMap(project.working_directory ?? '');
  const sessionInfo = sessionsMap[role as string];
  const sessionName = project.tmux_session_name;
  if (!sessionName) return res.status(404).json({ error: 'no tmux session' });

  try {
    const { stdout } = await execAsync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 3000, encoding: 'utf-8' },
    );
    let paneIdx: string | null = null;
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) { paneIdx = parts[0]; break; }
    }
    if (paneIdx === null) return res.status(404).json({ error: `Role ${role} not found` });

    // Send the value then Enter — answers the interactive prompt
    await execAsync(`tmux send-keys -t ${sessionName}:0.${paneIdx} ${JSON.stringify(String(value))} Enter`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { router as chatRouter };

// ── WebSocket: /ws/chat?projectId=N ──

const chatSubscribers = new Map<number, Set<WebSocket>>();
// [351] Firehose clients: receive events from all projects
const firehoseClients = new Set<WebSocket>();

// [391] tail -F per JSONL file — replaces chokidar (unreliable on macOS)
interface TailEntry {
  proc: ReturnType<typeof spawn>;
  filePath: string;
}
const chatTails = new Map<number, TailEntry[]>();

function pushEvents(projectId: number, dedupedEvents: ChatEvent[], firstRole?: string) {
  console.error(`[chat-ws] push project=${projectId} events=${dedupedEvents.length} t=${Date.now()}`);
  const projectMsg = JSON.stringify({ type: 'chat_events', events: dedupedEvents });
  const clients = chatSubscribers.get(projectId);
  if (clients) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(projectMsg);
    }
  }
  const firehoseMsg = JSON.stringify({ type: 'chat_events', projectId, events: dedupedEvents });
  for (const ws of firehoseClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(firehoseMsg);
  }
  // [394] Push only for first role (e.g. PO/ASSISTANT) — skip BOSS + DEV pane 2+
  const msgEvents = dedupedEvents.filter((e) =>
    e.kind === 'message' && e.role !== 'BOSS' && (!firstRole || e.role === firstRole)
  );
  if (msgEvents.length > 0) {
    const project = storage.getProject(projectId);
    const lastMsg = msgEvents[msgEvents.length - 1];
    pushNotify(projectId, project?.name ?? String(projectId), lastMsg.text ?? '', lastMsg.role).catch(() => {});
  }
  lastEventsCache.delete(projectId);
}

function watchProject(projectId: number) {
  if (chatTails.has(projectId)) return;

  const project = storage.getProject(projectId);
  if (!project?.working_directory) return;

  const roleInfos = getRoleInfos(project.working_directory);
  if (roleInfos.length === 0) return;

  const firstRole = roleInfos[0]?.role; // [394] push only for first role
  const tails: TailEntry[] = [];

  for (const ri of roleInfos) {
    const filePath = path.join(ri.folder, `${ri.sessionId}.jsonl`);
    if (!fs.existsSync(filePath)) {
      console.error(`[chat-ws] watchProject project=${projectId} role=${ri.role} file=${ri.sessionId}.jsonl NOT FOUND — skipping`);
      continue;
    }

    console.error(`[chat-ws] tail-start project=${projectId} role=${ri.role} file=${ri.sessionId}.jsonl`);

    // tail -F -n 0: follow file (even across renames), start from current end
    const proc = spawn('tail', ['-F', '-n', '0', filePath], { stdio: ['ignore', 'pipe', 'ignore'] });

    const toolUseMap = new Map<string, { name: string; input: any; hidden?: boolean }>();
    let lineBuffer = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      lineBuffer += chunk.toString('utf-8');
      const parts = lineBuffer.split('\n');
      lineBuffer = parts.pop() ?? '';

      const newEvents: ChatEvent[] = [];
      for (const line of parts) {
        if (!line.trim()) continue;
        newEvents.push(...parseJsonlLine(line, ri.role, ri.sessionId, toolUseMap));
      }
      if (newEvents.length === 0) return;

      const seen = new Set<string>();
      const deduped = newEvents.filter((e) => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
      if (deduped.length > 0) pushEvents(projectId, deduped, firstRole);
    });

    proc.on('exit', (code) => {
      console.error(`[chat-ws] tail exit project=${projectId} role=${ri.role} code=${code}`);
    });

    tails.push({ proc, filePath });
  }

  chatTails.set(projectId, tails);
}

function unwatchProject(projectId: number) {
  const tails = chatTails.get(projectId);
  if (tails) {
    for (const { proc } of tails) { try { proc.kill(); } catch {} }
    chatTails.delete(projectId);
  }
}

export function createChatWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const projectId = parseInt(url.searchParams.get('projectId') || '');
    if (isNaN(projectId)) { ws.close(); return; }

    if (!chatSubscribers.has(projectId)) chatSubscribers.set(projectId, new Set());
    chatSubscribers.get(projectId)!.add(ws);
    console.error(`[chat-ws] subscribe project=${projectId} total=${chatSubscribers.get(projectId)!.size}`);

    watchProject(projectId);

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => {
      clearInterval(ping);
      const clients = chatSubscribers.get(projectId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          unwatchProject(projectId);
          chatSubscribers.delete(projectId);
        }
      }
    });

    ws.on('error', () => {});
  });

  return wss;
}

// ── [351] Firehose WebSocket: /ws/chat/firehose — events from ALL projects ──

export function createFirehoseWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    firehoseClients.add(ws);

    // Start watching all known projects so their fs.watch is active
    const projects = storage.getProjects();
    for (const p of projects) {
      if (p.tmux_session_name) watchProject(p.id);
    }

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => { clearInterval(ping); firehoseClients.delete(ws); });
    ws.on('error', () => {});
  });

  return wss;
}
