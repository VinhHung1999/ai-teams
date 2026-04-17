import { WebSocketServer, WebSocket } from 'ws';
import { getStorage } from '../storage/factory';
import { flattenDashboardBoards } from './board';

// ── Subscription management ──────────────────────────────────────────────────
const subscriptions = new Map<number, Set<WebSocket>>();
const pendingNotifies = new Map<number, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 300;

function addSubscription(ws: WebSocket, projectId: number) {
  let clients = subscriptions.get(projectId);
  if (!clients) {
    clients = new Set();
    subscriptions.set(projectId, clients);
  }
  clients.add(ws);
}

function removeSubscription(ws: WebSocket, projectId: number) {
  const clients = subscriptions.get(projectId);
  if (clients) {
    clients.delete(ws);
    if (clients.size === 0) subscriptions.delete(projectId);
  }
}

function removeFromAll(ws: WebSocket) {
  for (const [pid, clients] of subscriptions) {
    clients.delete(ws);
    if (clients.size === 0) subscriptions.delete(pid);
  }
}

async function pushToProject(projectId: number) {
  const clients = subscriptions.get(projectId);
  if (!clients || clients.size === 0) return;

  try {
    const storage = await getStorage();
    const data = await storage.getDashboard(projectId);
    if (!data) return;
    const msg = JSON.stringify({ type: 'dashboard', ...data, boards: flattenDashboardBoards(data.boards as any) });
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  } catch (e: any) {
    console.error(`[board-ws] Push failed for project ${projectId}:`, e.message);
  }
}

export function onBoardChange(projectId: number) {
  const existing = pendingNotifies.get(projectId);
  if (existing) clearTimeout(existing);
  pendingNotifies.set(projectId, setTimeout(() => {
    pendingNotifies.delete(projectId);
    pushToProject(projectId);
  }, DEBOUNCE_MS));
}

// ── WebSocket server ──────────────────────────────────────────────────────────
export function createBoardWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket) => {
    let currentProjectId: number | null = null;

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && typeof msg.projectId === 'number') {
          if (currentProjectId !== null) removeSubscription(ws, currentProjectId);
          currentProjectId = msg.projectId as number;
          addSubscription(ws, currentProjectId);

          const storage = await getStorage();
          const data = await storage.getDashboard(currentProjectId);
          if (data && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'dashboard', ...data, boards: flattenDashboardBoards(data.boards as any) }));
          }
        }
      } catch {}
    });

    ws.on('close', () => removeFromAll(ws));
    ws.on('error', () => removeFromAll(ws));

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.ping();
    }, 30000);
    ws.on('close', () => clearInterval(ping));
  });

  return wss;
}

export function cleanupBoardWs() {
  // no-op: no PG listener to clean up
}

/** Push a notification to all clients subscribed to a project. */
export function pushNotificationToProject(projectId: number, notification: object) {
  const clients = subscriptions.get(projectId);
  if (!clients || clients.size === 0) return;
  const msg = JSON.stringify({ type: 'notification', notification });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}
