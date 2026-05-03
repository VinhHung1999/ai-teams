import { Router, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { createInterface } from 'readline';
import { exec } from 'child_process';
import { promisify } from 'util';
import storage from '../lib/JsonStorage';
import { pushNotify } from './push';

const execAsync = promisify(exec);
const router = Router();

// ── Types ──

export type ChatEvent = {
  id: string;
  role: 'PO' | 'DEV' | 'BOSS';
  sessionId: string;
  timestamp: string;
  kind: 'message' | 'tool_use' | 'tool_result';
  text?: string;
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

  function retagContent(text: string): { role: 'BOSS' | 'PO' | 'DEV'; text: string } {
    if (BOSS_PREFIX_RE.test(text)) {
      return { role: 'BOSS', text: text.replace(BOSS_PREFIX_RE, '') };
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
      events.push({
        id: d.uuid || `${ts}-user`,
        role: retagged.role,
        sessionId,
        timestamp: ts,
        kind: 'message',
        text: retagged.text,
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
        if (!isTmSend) {
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
  return allEvents;
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

export { router as chatRouter };

// ── WebSocket: /ws/chat?projectId=N ──

const chatSubscribers = new Map<number, Set<WebSocket>>();
// [351] Firehose clients: receive events from all projects
const firehoseClients = new Set<WebSocket>();
const chatWatchers = new Map<number, fs.FSWatcher>();
const fileOffsets = new Map<string, number>();

async function watchProject(projectId: number) {
  if (chatWatchers.has(projectId)) return;

  const project = storage.getProject(projectId);
  if (!project?.working_directory) return;

  const roleInfos = getRoleInfos(project.working_directory);
  if (roleInfos.length === 0) return;

  // Build folder → role mapping (assume same CWD for all roles → same folder)
  const folderToRoles = new Map<string, RoleInfo[]>();
  for (const ri of roleInfos) {
    const list = folderToRoles.get(ri.folder) ?? [];
    list.push(ri);
    folderToRoles.set(ri.folder, list);
  }

  // Initialize offsets so we only tail new bytes
  for (const folder of folderToRoles.keys()) {
    if (!fs.existsSync(folder)) continue;
    for (const f of fs.readdirSync(folder).filter(f => f.endsWith('.jsonl'))) {
      const fp = path.join(folder, f);
      if (!fileOffsets.has(fp)) fileOffsets.set(fp, fs.statSync(fp).size);
    }
  }

  // Watch the first folder (usually identical across roles when same CWD)
  const folder = [...folderToRoles.keys()][0];
  if (!folder || !fs.existsSync(folder)) return;

  const roles = folderToRoles.get(folder)!;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const watcher = fs.watch(folder, (_, filename) => {
    if (!filename || !filename.endsWith('.jsonl')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      const changedFile = path.join(folder, filename);
      const sid = path.basename(filename, '.jsonl');

      // Determine which role owns this file
      let fileRole: 'PO' | 'DEV' = roles[0]?.role ?? 'DEV';
      for (const ri of roles) {
        if (ri.sessionId === sid) { fileRole = ri.role; break; }
      }

      const prevOffset = fileOffsets.get(changedFile) ?? 0;
      let currentSize = 0;
      try { currentSize = fs.statSync(changedFile).size; } catch { return; }
      if (currentSize <= prevOffset) return;

      const fd = fs.openSync(changedFile, 'r');
      const buf = Buffer.alloc(currentSize - prevOffset);
      fs.readSync(fd, buf, 0, buf.length, prevOffset);
      fs.closeSync(fd);
      fileOffsets.set(changedFile, currentSize);

      const toolUseMap = new Map<string, { name: string; input: any }>();
      const newEvents: ChatEvent[] = [];
      for (const line of buf.toString('utf-8').split('\n')) {
        if (!line.trim()) continue;
        newEvents.push(...parseJsonlLine(line, fileRole, sid, toolUseMap));
      }

      if (newEvents.length === 0) return;

      // Push to per-project subscribers
      const clients = chatSubscribers.get(projectId);
      const projectMsg = JSON.stringify({ type: 'chat_events', events: newEvents });
      if (clients) {
        for (const ws of clients) {
          if (ws.readyState === WebSocket.OPEN) ws.send(projectMsg);
        }
      }

      // [351] Firehose — push to all-projects subscribers with projectId field
      const firehoseMsg = JSON.stringify({ type: 'chat_events', projectId, events: newEvents });
      for (const ws of firehoseClients) {
        if (ws.readyState === WebSocket.OPEN) ws.send(firehoseMsg);
      }

      // [352] Web Push notifications for message events
      const msgEvents = newEvents.filter((e) => e.kind === 'message');
      if (msgEvents.length > 0) {
        const project = storage.getProject(projectId);
        const lastMsg = msgEvents[msgEvents.length - 1];
        pushNotify(projectId, project?.name ?? String(projectId), lastMsg.text ?? '', lastMsg.role).catch(() => {});
      }

      // Invalidate last-events cache for this project
      lastEventsCache.delete(projectId);
    }, 100);
  });

  chatWatchers.set(projectId, watcher);
}

function unwatchProject(projectId: number) {
  chatWatchers.get(projectId)?.close();
  chatWatchers.delete(projectId);
}

export function createChatWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const projectId = parseInt(url.searchParams.get('projectId') || '');
    if (isNaN(projectId)) { ws.close(); return; }

    if (!chatSubscribers.has(projectId)) chatSubscribers.set(projectId, new Set());
    chatSubscribers.get(projectId)!.add(ws);

    watchProject(projectId).catch(e => console.error('[chat-ws] watch error:', e));

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
      if (p.tmux_session_name) watchProject(p.id).catch(() => {});
    }

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);

    ws.on('close', () => { clearInterval(ping); firehoseClients.delete(ws); });
    ws.on('error', () => {});
  });

  return wss;
}
