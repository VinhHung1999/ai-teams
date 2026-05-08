import os from 'os';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { createBoardWss } from './board-ws';

const MAX_SCROLLBACK = 50_000;

interface TerminalSession {
  pty: any;
  name: string;
  cwd: string;
  outputBuffer: string;
  clients: Set<WebSocket>;
  cols: number;
  rows: number;
  createdAt: number;
}

const sessions = new Map<string, TerminalSession>();

function getOrCreateSession(
  name: string,
  cwd: string,
  cols: number,
  rows: number,
  cmd?: string,
): TerminalSession {
  const existing = sessions.get(name);
  if (existing) return existing;

  const pty = require('@homebridge/node-pty-prebuilt-multiarch');

  // If cmd provided, run it directly instead of interactive shell
  let spawnCmd: string;
  let spawnArgs: string[];
  if (cmd) {
    spawnCmd = '/bin/bash';
    spawnArgs = ['-c', cmd];
  } else {
    spawnCmd = process.env.SHELL || '/bin/bash';
    spawnArgs = [];
  }

  const ptyProcess = pty.spawn(spawnCmd, spawnArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env: { ...process.env, TERM: 'xterm-256color' } as Record<string, string>,
  });

  const session: TerminalSession = {
    pty: ptyProcess,
    name,
    cwd,
    outputBuffer: '',
    clients: new Set(),
    cols,
    rows,
    createdAt: Date.now(),
  };

  ptyProcess.onData((data: string) => {
    session.outputBuffer += data;
    if (session.outputBuffer.length > MAX_SCROLLBACK) {
      session.outputBuffer = session.outputBuffer.slice(-MAX_SCROLLBACK);
    }
    for (const client of session.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      } catch {}
    }
  });

  ptyProcess.onExit(() => {
    for (const client of session.clients) {
      try {
        client.send('\r\n\x1b[90m[session ended]\x1b[0m\r\n');
      } catch {}
    }
    sessions.delete(name);
  });

  sessions.set(name, session);
  return session;
}

export function killSession(name: string): boolean {
  const session = sessions.get(name);
  if (!session) return false;
  try { session.pty.kill(); } catch {}
  sessions.delete(name);
  return true;
}

export function listSessions(): { name: string; clients: number; uptime: number }[] {
  return Array.from(sessions.entries()).map(([name, s]) => ({
    name,
    clients: s.clients.size,
    uptime: Math.floor((Date.now() - s.createdAt) / 1000),
  }));
}

/**
 * Register WebSocket terminal on HTTP server upgrade event.
 * This is more reliable than express-ws for WebSocket connections through proxies/tunnels.
 */
export function registerTerminalWs(server: http.Server) {
  const wss = new WebSocketServer({ noServer: true });
  const tmuxWss = new WebSocketServer({ noServer: true });
  const boardWss = createBoardWss();

  // Handle upgrade manually
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/ws/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else if (url.pathname === '/ws/tmux-pane') {
      tmuxWss.handleUpgrade(req, socket, head, (ws) => {
        tmuxWss.emit('connection', ws, req);
      });
    } else if (url.pathname === '/ws/board') {
      boardWss.handleUpgrade(req, socket, head, (ws) => {
        boardWss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  // ── Tmux pane WebSocket: push output changes to client ──
  // Two modes:
  //   1. subscribe-session {session} → poll ALL panes, send {type:"session-output", outputs:{role:output,...}}
  //   2. subscribe {session, role}   → legacy single-role mode (backwards compat)
  const { exec: execCb } = require('child_process');
  const { promisify: promisifyUtil } = require('util');
  const tmuxExecAsync = promisifyUtil(execCb);
  const MIN_SEND_INTERVAL = 200;

  function quickHash(str: string): string {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return h.toString(36);
  }

  tmuxWss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    let currentSession = url.searchParams.get('session') || '';
    let currentRole = url.searchParams.get('role') || '';
    let lines = parseInt(url.searchParams.get('lines') || '100');
    let sessionMode = false; // true = subscribe-session (all panes), false = single role

    // Session-mode state
    let cachedPanes: Array<{ idx: string; role: string }> = [];
    let panesTTL = 0;
    let lastSessionHash = '';
    let lastSendTime = 0;

    // Single-role state
    let lastHash = '';
    let cachedPaneIdx: string | null = null;
    let paneIdxTTL = 0;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    function resetState() {
      lastHash = ''; lastSendTime = 0; prevPollHash = '';
      cachedPaneIdx = null; paneIdxTTL = 0;
      cachedPanes = []; panesTTL = 0; lastSessionHash = '';
    }

    // ── Session mode: capture all panes, send combined output ──
    async function pollSession() {
      if (ws.readyState !== WebSocket.OPEN || !currentSession) return;
      try {
        const now = Date.now();
        // Refresh pane list every 5s
        if (!cachedPanes.length || now > panesTTL) {
          const { stdout: listOut } = await tmuxExecAsync(
            `tmux list-panes -t ${currentSession} -F "#{pane_index} #{@role_name}"`,
            { timeout: 2000, encoding: 'utf-8' }
          );
          cachedPanes = [];
          for (const line of listOut.trim().split('\n')) {
            const parts = line.trim().split(' ', 2);
            if (parts.length === 2 && parts[1]) cachedPanes.push({ idx: parts[0], role: parts[1] });
          }
          panesTTL = now + 5000;
        }
        if (!cachedPanes.length) return;

        // Capture all panes in parallel
        const results = await Promise.all(
          cachedPanes.map(async ({ idx, role }) => {
            try {
              const { stdout } = await tmuxExecAsync(
                `tmux capture-pane -p -e -t ${currentSession}:0.${idx} -S -${lines}`,
                { timeout: 2000, encoding: 'utf-8' }
              );
              return { role, output: stdout as string };
            } catch {
              return { role, output: '' };
            }
          })
        );

        const outputs: Record<string, string> = {};
        for (const { role, output } of results) outputs[role] = output;

        const combinedHash = quickHash(JSON.stringify(outputs));
        if (combinedHash === lastSessionHash) return;
        lastSessionHash = combinedHash;

        const elapsed = now - lastSendTime;
        if (elapsed >= MIN_SEND_INTERVAL) {
          ws.send(JSON.stringify({ type: 'session-output', outputs }));
          lastSendTime = Date.now();
        }
      } catch {}
    }

    // ── Single-role mode (legacy) ──
    let prevPollHash = ''; // hash from previous poll cycle — used for isActive
    async function pollSingle() {
      if (ws.readyState !== WebSocket.OPEN || !currentSession || !currentRole) return;
      try {
        const now = Date.now();
        if (!cachedPaneIdx || now > paneIdxTTL) {
          const { stdout: listOut } = await tmuxExecAsync(
            `tmux list-panes -t ${currentSession} -F "#{pane_index} #{@role_name}"`,
            { timeout: 2000, encoding: 'utf-8' }
          );
          cachedPaneIdx = null;
          for (const line of listOut.trim().split('\n')) {
            const parts = line.trim().split(' ', 2);
            if (parts.length === 2 && parts[1] === currentRole) { cachedPaneIdx = parts[0]; break; }
          }
          paneIdxTTL = now + 5000;
        }
        if (cachedPaneIdx === null) return;

        const { stdout: output } = await tmuxExecAsync(
          `tmux capture-pane -p -e -t ${currentSession}:0.${cachedPaneIdx} -S -${lines}`,
          { timeout: 2000, encoding: 'utf-8' }
        );
        const hashStr = quickHash(output);
        const isActive = !!(prevPollHash && hashStr !== prevPollHash);
        prevPollHash = hashStr;
        if (hashStr === lastHash) return;
        lastHash = hashStr;
        const elapsed = Date.now() - lastSendTime;
        if (elapsed >= MIN_SEND_INTERVAL) {
          ws.send(JSON.stringify({ output, isActive }));
          lastSendTime = Date.now();
        }
      } catch {}
    }

    function startPolling() {
      if (pollInterval) clearInterval(pollInterval);
      const fn = sessionMode ? pollSession : pollSingle;
      pollInterval = setInterval(fn, 500);
      fn(); // immediate fetch
    }

    // Start polling if URL params provided (backwards compat)
    if (currentSession && currentRole) startPolling();

    ws.on('message', (raw) => {
      // Keepalive ping/pong
      if (raw.toString() === 'ping') { ws.send('pong'); return; }
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe-session' && msg.session) {
          currentSession = msg.session;
          if (msg.lines) lines = msg.lines;
          sessionMode = true;
          resetState();
          startPolling();
        } else if (msg.type === 'subscribe' && msg.session && msg.role) {
          currentSession = msg.session;
          currentRole = msg.role;
          if (msg.lines) lines = msg.lines;
          sessionMode = false;
          resetState();
          startPolling();
        } else if (msg.type === 'unsubscribe') {
          // Pause polling — keep WS connection alive (idle)
          if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
          currentRole = '';
          resetState();
        }
      } catch {}
    });

    ws.on('close', () => { if (pollInterval) clearInterval(pollInterval); });
    ws.on('error', () => { if (pollInterval) clearInterval(pollInterval); });
  });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const cwd = url.searchParams.get('cwd') || os.homedir();
    const cols = parseInt(url.searchParams.get('cols') || '80');
    const rows = parseInt(url.searchParams.get('rows') || '24');
    const name = url.searchParams.get('name') || `term-${Date.now()}`;
    const cmd = url.searchParams.get('cmd') || undefined;

    try {
      const session = getOrCreateSession(name, cwd, cols, rows, cmd);
      session.clients.add(ws);

      // Send scrollback buffer immediately
      if (session.outputBuffer.length > 0) {
        ws.send(session.outputBuffer);
      }

      // Forward client input to PTY
      ws.on('message', (message: Buffer | string) => {
        const msg = message.toString();
        if (msg.startsWith('{"type"')) {
          try {
            const parsed = JSON.parse(msg);
            if (parsed.type === 'resize') {
              session.pty.resize(parsed.cols || cols, parsed.rows || rows);
              session.cols = parsed.cols || cols;
              session.rows = parsed.rows || rows;
              return;
            }
          } catch {}
        }
        session.pty.write(msg);
      });

      ws.on('close', () => {
        session.clients.delete(ws);
      });

      ws.on('error', () => {
        session.clients.delete(ws);
      });

    } catch (err: any) {
      console.error('Terminal session error:', err.message);
      ws.close();
    }
  });

  return wss;
}
