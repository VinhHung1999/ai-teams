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

const execAsync = promisify(exec);

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const BASE = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : '';

let offset = 0;
let running = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;

// ── message_id → session_name mapping (for swipe-reply detection) ────────────
// Keeps last 200 notification message IDs; old ones evicted automatically.
const MSG_CACHE_MAX = 200;
const msgToSession = new Map<number, string>(); // message_id → session_name
const msgOrder: number[] = [];

export function registerNotificationMessage(messageId: number, sessionName: string): void {
  if (msgOrder.length >= MSG_CACHE_MAX) {
    const evict = msgOrder.shift()!;
    msgToSession.delete(evict);
  }
  msgToSession.set(messageId, sessionName);
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
    const { stdout } = await execAsync('tmux list-sessions -F "#{session_name}" 2>/dev/null', { timeout: 3000 });
    const sessions = stdout.trim().split('\n').filter(Boolean);

    if (!sessions.length) return;

    const commands = sessions.map((s) => ({
      command: s.replace(/[^a-zA-Z0-9_]/g, '_'),
      description: `Send to PO@${s}`,
    }));

    await tgPost('setMyCommands', { commands });
  } catch {
    // Non-fatal — commands just won't update
  }
}

// ── Message handler ──────────────────────────────────────────────────────────

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

async function forwardToAgent(chatId: string, resolvedSession: string, userMsg: string): Promise<void> {
  const bossMsg = `BOSS: ${userMsg}`;
  const safeMsg = bossMsg.replace(/'/g, "'\\''");
  try {
    await execAsync(`tm-send -s '${resolvedSession}' PO '${safeMsg}'`, { timeout: 5000 });
    await sendReply(chatId, `Sent to PO@${resolvedSession} ✓`);
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
    const replySession = msgToSession.get(replyToId);
    if (replySession) {
      const resolvedSess = await resolveSession(replySession.replace(/-/g, '_')) ?? replySession;
      await forwardToAgent(chatId, resolvedSess, text.trim());
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

  // ── Command: /session_name [message] ──
  const match = text.match(/^\/([^\s@]+)(?:@\S+)?(?:\s+([\s\S]*))?$/);
  if (!match) {
    await sendReply(chatId, '⚠️ Format: <code>/session_name your message</code>');
    return;
  }

  const rawSession = match[1];
  const userMsg = (match[2] || '').trim();

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
