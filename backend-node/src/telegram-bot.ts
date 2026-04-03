/**
 * Telegram 2-way bot — long-polling
 *
 * Incoming: /session_name message text
 * Action:   exec tm-send -s session_name PO 'BOSS: message text'
 * Reply:    'Sent to PO@session_name ✓'  or  'Team not found ✗'
 *
 * Security: only accepts updates from TELEGRAM_CHAT_ID
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import prisma from './lib/prisma';

const execAsync = promisify(exec);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

let offset = 0;
let running = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ── message_id → {session, role} mapping (for swipe-reply detection) ─────────
// Keeps last 200 notification message IDs; old ones evicted automatically.
const MSG_CACHE_MAX = 200;
interface MsgMeta { session: string; role: string; }
const msgCache = new Map<number, MsgMeta>(); // message_id → {session, role}
const msgOrder: number[] = [];

export function registerNotificationMessage(messageId: number, sessionName: string, fromRole: string | null): void {
  if (msgOrder.length >= MSG_CACHE_MAX) {
    const evict = msgOrder.shift()!;
    msgCache.delete(evict);
  }
  msgCache.set(messageId, { session: sessionName, role: fromRole || 'PO' });
  msgOrder.push(messageId);
}

// ── Pending state (command with no message) ──────────────────────────────────
interface PendingState {
  session: string;   // resolved tmux session name
  timer: ReturnType<typeof setTimeout>;
}
const pending = new Map<string, PendingState>(); // key = chatId string

function setPending(chatId: string, session: string): void {
  clearPending(chatId);
  const timer = setTimeout(() => pending.delete(chatId), 60_000);
  pending.set(chatId, { session, timer });
}

function clearPending(chatId: string): void {
  const p = pending.get(chatId);
  if (p) { clearTimeout(p.timer); pending.delete(chatId); }
}

// ── Telegram API helpers ─────────────────────────────────────────────────────

async function tgPost(method: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sendReply(chatId: number | string, text: string): Promise<void> {
  await tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

// ── Session → commands sync ──────────────────────────────────────────────────

async function syncBotCommands(): Promise<void> {
  try {
    const builtins = [
      { command: 'status', description: 'All teams + sprint progress' },
      { command: 'board', description: 'Sprint board: /board <session>' },
      { command: 'broadcast', description: 'Send to all teams: /broadcast <msg>' },
      { command: 'help', description: 'Show available commands' },
    ];

    let sessionCmds: { command: string; description: string }[] = [];
    try {
      const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { timeout: 3000 });
      const sessions = stdout.trim().split('\n').filter(Boolean);
      sessionCmds = sessions.map((s) => ({
        command: s.replace(/[^a-zA-Z0-9_]/g, '_'),
        description: `Send to PO@${s}`,
      }));
    } catch {}

    await tgPost('setMyCommands', { commands: [...builtins, ...sessionCmds] });
  } catch {
    // Non-fatal
  }
}

// ── Built-in commands ────────────────────────────────────────────────────────

const BOARD_COLS = ['todo', 'in_progress', 'in_review', 'testing', 'done'] as const;
const COL_EMOJI: Record<string, string> = {
  todo: '📋', in_progress: '🔨', in_review: '👀', testing: '🧪', done: '✅',
};

async function cmdStatus(chatId: string): Promise<void> {
  let lines: string[] = ['<b>🖥 Team Status</b>\n'];
  try {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { timeout: 3000 });
    const sessions = stdout.trim().split('\n').filter(Boolean);
    if (!sessions.length) { await sendReply(chatId, 'No active tmux sessions.'); return; }

    for (const s of sessions) {
      const project = await prisma.project.findFirst({ where: { tmux_session_name: s } });
      const sprint = project
        ? await prisma.sprint.findFirst({ where: { project_id: project.id, status: 'active' }, include: { items: true } })
        : null;
      const done = sprint?.items.filter((i: any) => i.board_status === 'done').length ?? 0;
      const total = sprint?.items.length ?? 0;
      lines.push(`<b>${s}</b>${project ? ` — ${project.name}` : ''}`);
      if (sprint) lines.push(`  Sprint ${sprint.number}: ${done}/${total} done${sprint.goal ? ` · ${sprint.goal}` : ''}`);
      else lines.push('  No active sprint');
    }
  } catch (e: any) {
    lines.push(`Error: ${e.message}`);
  }
  await sendReply(chatId, lines.join('\n'));
}

async function cmdBoard(chatId: string, rawSession: string): Promise<void> {
  const sess = await resolveSessionDirect(rawSession);
  if (!sess) { await sendReply(chatId, `Team not found ✗\n<code>${rawSession}</code>`); return; }

  const project = await prisma.project.findFirst({ where: { tmux_session_name: sess } });
  if (!project) { await sendReply(chatId, `No project linked to session <code>${sess}</code>`); return; }

  const sprint = await prisma.sprint.findFirst({
    where: { project_id: project.id, status: 'active' },
    include: { items: { include: { backlog_item: true } } },
  });
  if (!sprint) { await sendReply(chatId, `No active sprint for <b>${project.name}</b>`); return; }

  const lines: string[] = [`<b>📋 ${project.name} — Sprint ${sprint.number}</b>\n`];
  for (const col of BOARD_COLS) {
    const colItems = sprint.items.filter((i: any) => i.board_status === col);
    if (!colItems.length) continue;
    lines.push(`${COL_EMOJI[col]} <b>${col.replace('_', ' ')}</b>`);
    for (const item of colItems) {
      const assignee = item.assignee_role ? ` [${item.assignee_role}]` : '';
      lines.push(`  • ${item.backlog_item.title}${assignee}`);
    }
  }
  await sendReply(chatId, lines.join('\n'));
}

async function cmdBroadcast(chatId: string, message: string): Promise<void> {
  if (!message) { await sendReply(chatId, '⚠️ Usage: /broadcast your message'); return; }
  try {
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { timeout: 3000 });
    const sessions = stdout.trim().split('\n').filter(Boolean);
    if (!sessions.length) { await sendReply(chatId, 'No active sessions to broadcast to.'); return; }
    const safeMsg = `[via Telegram] BOSS: ${message}`.replace(/'/g, "'\\''");
    const results: string[] = [];
    for (const s of sessions) {
      try {
        await execAsync(`tm-send -s '${s}' PO '${safeMsg}'`, { timeout: 5000 });
        results.push(`✓ PO@${s}`);
      } catch {
        results.push(`✗ PO@${s}`);
      }
    }
    await sendReply(chatId, `Broadcast sent:\n${results.join('\n')}`);
  } catch (e: any) {
    await sendReply(chatId, `Broadcast failed: ${e.message}`);
  }
}

async function cmdHelp(chatId: string): Promise<void> {
  await sendReply(chatId, [
    '<b>🤖 AI Teams Bot Commands</b>',
    '',
    '/status — All teams + sprint progress',
    '/board &lt;session&gt; — Sprint board for a team',
    '/broadcast &lt;msg&gt; — Send to PO in all active sessions',
    '/&lt;session&gt; &lt;msg&gt; — Send message to PO@session',
    '/&lt;session&gt; — Prompt for message (60s timeout)',
    '',
    '<i>Swipe-reply</i> a notification to reply to the sender directly.',
  ].join('\n'));
}

// ── Message handler ──────────────────────────────────────────────────────────

// resolveSession without tmux fallback (for builtins that pass session directly)
async function resolveSessionDirect(raw: string): Promise<string | null> {
  return resolveSession(raw);
}

async function resolveSession(rawSession: string): Promise<string | null> {
  const session = rawSession.replace(/_/g, '-');
  try {
    const { stdout } = await execAsync(`tmux list-sessions -F "#{session_name}" 2>/dev/null`, { timeout: 3000 });
    const sessions = stdout.trim().split('\n').filter(Boolean);
    if (sessions.includes(rawSession)) return rawSession;
    if (sessions.includes(session)) return session;
  } catch {}
  return null;
}

async function forwardToAgent(chatId: string, resolvedSession: string, userMsg: string, role = 'PO'): Promise<void> {
  const bossMsg = `[via Telegram] BOSS: ${userMsg}`;
  const safeMsg = bossMsg.replace(/'/g, "'\\''");
  try {
    await execAsync(`tm-send -s '${resolvedSession}' ${role} '${safeMsg}'`, { timeout: 5000 });
    await sendReply(chatId, `Sent to ${role}@${resolvedSession} ✓`);
  } catch (err: any) {
    await sendReply(chatId, `Failed to send ✗\n<code>${err.message}</code>`);
  }
}

async function handleMessage(msg: any): Promise<void> {
  const chatId = String(msg.chat?.id);
  const text: string = msg.text || '';

  // Security: only accept from authorised chat
  if (chatId !== String(ALLOWED_CHAT_ID)) return;

  // ── Swipe-reply to a notification message ──
  const replyToId: number | undefined = msg.reply_to_message?.message_id;
  if (replyToId !== undefined && !text.startsWith('/')) {
    const meta = msgCache.get(replyToId);
    if (meta) {
      const resolvedSess = await resolveSession(meta.session.replace(/-/g, '_')) ?? meta.session;
      await forwardToAgent(chatId, resolvedSess, text.trim(), meta.role);
      return;
    }
    // No mapping — fall through to normal handling
  }

  // ── Non-command text: check for pending session state ──
  if (!text.startsWith('/')) {
    const state = pending.get(chatId);
    if (state) {
      clearPending(chatId);
      await forwardToAgent(chatId, state.session, text.trim());
    } else {
      await sendReply(chatId, '⚠️ Format: <code>/session_name your message</code>');
    }
    return;
  }

  // ── Command: built-ins first, then session-forward ──
  const match = text.match(/^\/([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
  if (!match) {
    await sendReply(chatId, '⚠️ Format: <code>/session_name your message</code>');
    return;
  }

  const rawCmd = match[1].toLowerCase();
  const args = (match[2] || '').trim();

  if (rawCmd === 'status') { await cmdStatus(chatId); return; }
  if (rawCmd === 'help' || rawCmd === 'start') { await cmdHelp(chatId); return; }
  if (rawCmd === 'board') {
    const [sessArg, ...rest] = args.split(/\s+/);
    if (!sessArg) { await sendReply(chatId, '⚠️ Usage: /board &lt;session&gt;'); return; }
    await cmdBoard(chatId, sessArg);
    return;
  }
  if (rawCmd === 'broadcast') { await cmdBroadcast(chatId, args); return; }

  // ── Session forward ──
  const rawSession = match[1]; // preserve original case for session name
  const userMsg = args;

  const resolvedSess = await resolveSession(rawSession);
  if (!resolvedSess) {
    await sendReply(chatId, `Team not found ✗\n<code>${rawSession}</code> is not an active tmux session.`);
    return;
  }

  if (!userMsg) {
    // Prompt for message and store pending state (60s timeout)
    setPending(chatId, resolvedSess);
    await sendReply(chatId, `Nhập message cho PO@${resolvedSess}:`);
    return;
  }

  await forwardToAgent(chatId, resolvedSess, userMsg);
}

// ── Long-polling loop ────────────────────────────────────────────────────────

async function poll(): Promise<void> {
  if (!running) return;
  try {
    const data = await fetch(`${BASE}/getUpdates?offset=${offset}&timeout=25&allowed_updates=["message"]`)
      .then((r) => r.json()) as any;

    if (data.ok && Array.isArray(data.result)) {
      for (const update of data.result) {
        offset = update.update_id + 1;
        if (update.message) {
          handleMessage(update.message).catch(() => {});
        }
      }
    }
  } catch {
    // Network error — retry after delay
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (running) {
    pollTimer = setTimeout(poll, 100);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function startTelegramBot(): void {
  if (!TOKEN || !ALLOWED_CHAT_ID) {
    console.log('[telegram] No token/chat_id — bot disabled');
    return;
  }
  if (running) return;

  running = true;
  console.log('[telegram] Bot started, polling for updates...');

  // Sync commands on startup + every 5 min
  syncBotCommands();
  setInterval(syncBotCommands, 5 * 60 * 1000);

  poll();
}

export function stopTelegramBot(): void {
  running = false;
  if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
}
