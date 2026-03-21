import os from 'os';

/**
 * Terminal session manager with persistent named sessions.
 *
 * Key concepts:
 * - Sessions persist even when all clients disconnect
 * - Reconnecting clients get the scrollback buffer instantly
 * - Multiple clients can view the same session
 * - Sessions are identified by name (e.g. "boss-42", "agent-PO")
 */

const MAX_SCROLLBACK = 50_000; // chars to keep in buffer

interface TerminalSession {
  pty: any;
  name: string;
  cwd: string;
  outputBuffer: string;
  clients: Set<any>; // WebSocket clients viewing this session
  cols: number;
  rows: number;
  createdAt: number;
}

// Global map of all terminal sessions
const sessions = new Map<string, TerminalSession>();

function getOrCreateSession(
  name: string,
  cwd: string,
  cols: number,
  rows: number
): TerminalSession {
  // Return existing session if it exists and PTY is alive
  const existing = sessions.get(name);
  if (existing) {
    return existing;
  }

  // Create new PTY
  const pty = require('node-pty');
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
  };

  // Collect output into buffer + broadcast to all connected clients
  ptyProcess.onData((data: string) => {
    // Append to scrollback buffer
    session.outputBuffer += data;
    if (session.outputBuffer.length > MAX_SCROLLBACK) {
      session.outputBuffer = session.outputBuffer.slice(-MAX_SCROLLBACK);
    }

    // Broadcast to all connected clients
    for (const client of session.clients) {
      try {
        if (client.readyState === 1) {
          client.send(data);
        }
      } catch {
        // Client gone, will be cleaned up on close
      }
    }
  });

  // When PTY exits, clean up session
  ptyProcess.onExit(() => {
    // Notify all clients
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

/**
 * Kill a named session explicitly.
 */
export function killSession(name: string): boolean {
  const session = sessions.get(name);
  if (!session) return false;
  try {
    session.pty.kill();
  } catch {}
  sessions.delete(name);
  return true;
}

/**
 * List all active sessions.
 */
export function listSessions(): { name: string; clients: number; uptime: number }[] {
  return Array.from(sessions.entries()).map(([name, s]) => ({
    name,
    clients: s.clients.size,
    uptime: Math.floor((Date.now() - s.createdAt) / 1000),
  }));
}

/**
 * Register WebSocket terminal endpoint.
 *
 * Query params:
 *   - name: session name (default: auto-generated)
 *   - cwd: working directory
 *   - cols: terminal columns (default: 80)
 *   - rows: terminal rows (default: 24)
 */
export function registerTerminalWs(app: any) {
  app.ws('/ws/terminal', (ws: any, req: any) => {
    const cwd = (req.query.cwd as string) || os.homedir();
    const cols = parseInt(req.query.cols as string) || 80;
    const rows = parseInt(req.query.rows as string) || 24;
    // Session name: use query param or generate from cwd
    const name = (req.query.name as string) || `term-${Date.now()}`;

    try {
      const session = getOrCreateSession(name, cwd, cols, rows);

      // Add this client to the session
      session.clients.add(ws);

      // Send scrollback buffer immediately (instant render!)
      if (session.outputBuffer.length > 0) {
        ws.send(session.outputBuffer);
      }

      // Forward client input to PTY
      ws.on('message', (message: string) => {
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
          } catch {
            // Not JSON, forward as input
          }
        }
        session.pty.write(msg);
      });

      // Heartbeat every 25s to keep alive through proxies
      const heartbeatInterval = setInterval(() => {
        try {
          if (ws.readyState === 1) {
            ws.ping();
          }
        } catch {
          clearInterval(heartbeatInterval);
        }
      }, 25000);

      // On disconnect: remove client but DON'T kill PTY
      ws.on('close', () => {
        clearInterval(heartbeatInterval);
        session.clients.delete(ws);
        // Session persists even with 0 clients!
      });

      ws.on('error', () => {
        clearInterval(heartbeatInterval);
        session.clients.delete(ws);
      });

    } catch (err: any) {
      console.error('Failed to create terminal session:', err.message);
      ws.close();
    }
  });

  // REST endpoint to list/kill sessions
  const express = require('express');
  const router = express.Router();

  router.get('/api/terminal/sessions', (_req: any, res: any) => {
    res.json(listSessions());
  });

  router.delete('/api/terminal/sessions/:name', (req: any, res: any) => {
    const killed = killSession(req.params.name);
    res.json({ ok: killed });
  });

  app.use(router);
}
