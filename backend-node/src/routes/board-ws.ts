import { WebSocketServer, WebSocket } from 'ws';
import { Client } from 'pg';
import prisma from '../lib/prisma';

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];

function formatBoardItem(si: any, bi: any) {
  return {
    id: si.id,
    sprint_id: si.sprint_id,
    backlog_item_id: si.backlog_item_id,
    title: bi.title,
    description: bi.description,
    priority: bi.priority,
    story_points: bi.story_points,
    assignee_role: si.assignee_role,
    board_status: si.board_status,
    order: si.order,
  };
}

async function fetchDashboard(projectId: number) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;

  const sprints = await prisma.sprint.findMany({
    where: { project_id: projectId },
    orderBy: { number: 'desc' },
  });

  const backlogItems = await prisma.backlogItem.findMany({
    where: { project_id: projectId },
    orderBy: { order: 'asc' },
  });

  const sprintIds = sprints.map(s => s.id);
  const boards: Record<string, Record<string, any[]>> = {};

  if (sprintIds.length > 0) {
    const allItems = await prisma.sprintItem.findMany({
      where: { sprint_id: { in: sprintIds } },
      include: { backlog_item: true },
      orderBy: { order: 'asc' },
    });

    for (const si of allItems) {
      const sid = String(si.sprint_id);
      if (!boards[sid]) {
        boards[sid] = {};
        for (const col of BOARD_COLUMNS) boards[sid][col] = [];
      }
      boards[sid][si.board_status].push(formatBoardItem(si, si.backlog_item));
    }
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      tmux_session_name: project.tmux_session_name,
      working_directory: project.working_directory,
      created_at: project.created_at?.toISOString() ?? null,
    },
    sprints: sprints.map(s => ({
      id: s.id,
      project_id: s.project_id,
      number: s.number,
      goal: s.goal,
      status: s.status,
      started_at: s.started_at?.toISOString() ?? null,
      completed_at: s.completed_at?.toISOString() ?? null,
      created_at: s.created_at?.toISOString() ?? null,
    })),
    backlog: backlogItems.map(i => ({
      id: i.id,
      project_id: i.project_id,
      title: i.title,
      description: i.description,
      priority: i.priority,
      story_points: i.story_points,
      acceptance_criteria: i.acceptance_criteria,
      status: i.status,
      order: i.order,
      created_at: i.created_at?.toISOString() ?? null,
      updated_at: i.updated_at?.toISOString() ?? null,
    })),
    boards,
  };
}

// ── Subscription management ──
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
    const data = await fetchDashboard(projectId);
    if (!data) return;
    const msg = JSON.stringify({ type: 'dashboard', ...data });
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  } catch (e: any) {
    console.error(`[board-ws] Push failed for project ${projectId}:`, e.message);
  }
}

function onBoardChange(projectId: number) {
  const existing = pendingNotifies.get(projectId);
  if (existing) clearTimeout(existing);
  pendingNotifies.set(projectId, setTimeout(() => {
    pendingNotifies.delete(projectId);
    pushToProject(projectId);
  }, DEBOUNCE_MS));
}

// ── PG LISTEN ──
let pgClient: Client | null = null;

async function startPgListener() {
  // Hardcoded to match Prisma schema — env DATABASE_URL may point to legacy DB
  const connStr = 'postgresql://hungphu@localhost:5432/ai_teams';
  pgClient = new Client({ connectionString: connStr });

  pgClient.on('error', (err) => {
    console.error('[board-ws] PG error:', err.message);
    pgClient = null;
    setTimeout(startPgListener, 3000);
  });

  pgClient.on('notification', (msg) => {
    if (msg.channel === 'board_change' && msg.payload) {
      const projectId = parseInt(msg.payload);
      if (!isNaN(projectId)) onBoardChange(projectId);
    }
  });

  try {
    await pgClient.connect();
    await pgClient.query('LISTEN board_change');
    console.log('[board-ws] PG LISTEN active');
  } catch (err: any) {
    console.error('[board-ws] PG connect failed:', err.message);
    pgClient = null;
    setTimeout(startPgListener, 3000);
  }
}

// ── WebSocket server ──
export function createBoardWss(): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  startPgListener();

  wss.on('connection', (ws: WebSocket) => {
    let currentProjectId: number | null = null;

    ws.on('message', async (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && typeof msg.projectId === 'number') {
          if (currentProjectId !== null) removeSubscription(ws, currentProjectId);
          currentProjectId = msg.projectId as number;
          addSubscription(ws, currentProjectId);

          const data = await fetchDashboard(currentProjectId as number);
          if (data && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'dashboard', ...data }));
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
  if (pgClient) {
    pgClient.end().catch(() => {});
    pgClient = null;
  }
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
