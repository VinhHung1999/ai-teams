import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

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

// Get board
router.get('/api/sprints/:sprintId/board', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const items = await prisma.sprintItem.findMany({
    where: { sprint_id: sprintId },
    include: { backlog_item: true },
    orderBy: { order: 'asc' },
  });

  const board: Record<string, any[]> = {};
  for (const col of BOARD_COLUMNS) {
    board[col] = [];
  }
  for (const si of items) {
    const item = formatBoardItem(si, si.backlog_item);
    board[si.board_status].push(item);
  }
  res.json(board);
});

// Move item
router.put('/api/board/items/:itemId/move', async (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId as string);
  const { board_status, order } = req.body;

  if (!BOARD_COLUMNS.includes(board_status)) {
    return res.status(400).json({ detail: `Invalid status. Must be one of: ${BOARD_COLUMNS.join(', ')}` });
  }

  const si = await prisma.sprintItem.findUnique({ where: { id: itemId } });
  if (!si) {
    return res.status(404).json({ detail: 'Sprint item not found' });
  }

  await prisma.sprintItem.update({
    where: { id: itemId },
    data: { board_status, order: order ?? 0 },
  });

  res.json({ ok: true });
});

// Dashboard
router.get('/api/projects/:projectId/dashboard', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }

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
        for (const col of BOARD_COLUMNS) {
          boards[sid][col] = [];
        }
      }
      boards[sid][si.board_status].push(formatBoardItem(si, si.backlog_item));
    }
  }

  res.json({
    project: {
      id: project.id,
      name: project.name,
      tmux_session_name: project.tmux_session_name,
      working_directory: project.working_directory,
      created_at: project.created_at ? project.created_at.toISOString() : null,
    },
    sprints: sprints.map(s => ({
      id: s.id,
      project_id: s.project_id,
      number: s.number,
      goal: s.goal,
      status: s.status,
      started_at: s.started_at ? s.started_at.toISOString() : null,
      completed_at: s.completed_at ? s.completed_at.toISOString() : null,
      created_at: s.created_at ? s.created_at.toISOString() : null,
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
      created_at: i.created_at ? i.created_at.toISOString() : null,
      updated_at: i.updated_at ? i.updated_at.toISOString() : null,
    })),
    boards,
  });
});

export default router;
