import os from 'os';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';

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
  watermark: number;
}

const sessions = new Map<string, TerminalSession>();

function getOrCreateSession(
  name: string,
  cwd: string,
  cols: number,
  rows: number
): TerminalSession {
  const existing = sessions.get(name);
  if (existing) return existing;

  const pty = require('@homebridge/node-pty-prebuilt-multiarch');
  const shell = process.env.SHELL || '/bin/bash';

  const ptyProcess = pty.spawn(shell, [], {
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
    watermark: 0,
  };

  ptyProcess.onData((data: string) => {
    session.outputBuffer += data;
    if (session.outputBuffer.length > MAX_SCROLLBACK) {
      session.outputBuffer = session.outputBuffer.slice(-MAX_SCROLLBACK);
    }
    session.watermark += data.length;
    for (const client of session.clients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      } catch {}
    }
    // Flow control: pause PTY if too much unacknowledged data
    if (session.watermark > 100000) {
      ptyProcess.pause();
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

  // Handle upgrade manually
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/ws/terminal') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const cwd = url.searchParams.get('cwd') || os.homedir();
    const cols = parseInt(url.searchParams.get('cols') || '80');
    const rows = parseInt(url.searchParams.get('rows') || '24');
    const name = url.searchParams.get('name') || `term-${Date.now()}`;

    try {
      const session = getOrCreateSession(name, cwd, cols, rows);
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
