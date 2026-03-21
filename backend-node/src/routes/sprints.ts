import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function formatSprint(s: any) {
  return {
    id: s.id,
    project_id: s.project_id,
    number: s.number,
    goal: s.goal,
    status: s.status,
    started_at: s.started_at ? s.started_at.toISOString() : null,
    completed_at: s.completed_at ? s.completed_at.toISOString() : null,
    created_at: s.created_at.toISOString(),
  };
}

// List sprints
router.get('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const sprints = await prisma.sprint.findMany({
    where: { project_id: projectId },
    orderBy: { number: 'desc' },
  });
  res.json(sprints.map(formatSprint));
});

// Create sprint
router.post('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { goal } = req.body;

  const maxResult = await prisma.sprint.aggregate({
    where: { project_id: projectId },
    _max: { number: true },
  });
  const maxNum = maxResult._max.number ?? 0;

  const sprint = await prisma.sprint.create({
    data: {
      project_id: projectId,
      number: maxNum + 1,
      goal: goal || null,
    },
  });
  res.json(formatSprint(sprint));
});

// Start sprint
router.put('/api/sprints/:sprintId/start', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status !== 'planning') {
    return res.status(400).json({ detail: 'Sprint must be in planning status' });
  }

  const activeSprint = await prisma.sprint.findFirst({
    where: { project_id: sprint.project_id, status: 'active' },
  });
  if (activeSprint) {
    return res.status(400).json({ detail: 'Another sprint is already active. Complete it first.' });
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: 'active', started_at: new Date() },
  });
  res.json(formatSprint(updated));
});

// Complete sprint
router.put('/api/sprints/:sprintId/complete', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status !== 'active') {
    return res.status(400).json({ detail: 'Sprint must be active' });
  }

  // Move incomplete items back to backlog
  const incompleteItems = await prisma.sprintItem.findMany({
    where: { sprint_id: sprintId, NOT: { board_status: 'done' } },
  });
  for (const si of incompleteItems) {
    await prisma.backlogItem.updateMany({
      where: { id: si.backlog_item_id },
      data: { status: 'ready' },
    });
  }

  // Mark done items
  const doneItems = await prisma.sprintItem.findMany({
    where: { sprint_id: sprintId, board_status: 'done' },
  });
  for (const si of doneItems) {
    await prisma.backlogItem.updateMany({
      where: { id: si.backlog_item_id },
      data: { status: 'done' },
    });
  }

  const updated = await prisma.sprint.update({
    where: { id: sprintId },
    data: { status: 'completed', completed_at: new Date() },
  });
  res.json(formatSprint(updated));
});

// Delete sprint
router.delete('/api/sprints/:sprintId', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status === 'active') {
    return res.status(400).json({ detail: 'Cannot delete an active sprint. Complete it first.' });
  }

  // Return sprint items to backlog
  const items = await prisma.sprintItem.findMany({
    where: { sprint_id: sprintId },
  });
  for (const si of items) {
    await prisma.backlogItem.updateMany({
      where: { id: si.backlog_item_id },
      data: { status: 'ready' },
    });
  }

  // Delete sprint items first, then sprint
  await prisma.sprintItem.deleteMany({ where: { sprint_id: sprintId } });
  await prisma.sprint.delete({ where: { id: sprintId } });
  res.json({ ok: true });
});

// Add item to sprint
router.post('/api/sprints/:sprintId/items', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const { backlog_item_id, assignee_role } = req.body;

  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }

  const bi = await prisma.backlogItem.findUnique({ where: { id: backlog_item_id } });
  if (!bi) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }

  const maxOrderResult = await prisma.sprintItem.aggregate({
    where: { sprint_id: sprintId },
    _max: { order: true },
  });
  const maxOrder = maxOrderResult._max.order ?? 0;

  const si = await prisma.sprintItem.create({
    data: {
      sprint_id: sprintId,
      backlog_item_id,
      assignee_role: assignee_role || null,
      order: maxOrder + 1,
    },
  });

  await prisma.backlogItem.update({
    where: { id: backlog_item_id },
    data: { status: 'in_sprint' },
  });

  res.json({
    id: si.id,
    sprint_id: si.sprint_id,
    backlog_item_id: si.backlog_item_id,
    assignee_role: si.assignee_role,
    board_status: si.board_status,
    order: si.order,
  });
});

// Remove item from sprint
router.delete('/api/sprints/:sprintId/items/:itemId', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const itemId = parseInt(req.params.itemId as string);

  const si = await prisma.sprintItem.findFirst({
    where: { id: itemId, sprint_id: sprintId },
  });
  if (!si) {
    return res.status(404).json({ detail: 'Sprint item not found' });
  }

  await prisma.backlogItem.updateMany({
    where: { id: si.backlog_item_id },
    data: { status: 'ready' },
  });

  await prisma.sprintItem.delete({ where: { id: itemId } });
  res.json({ ok: true });
});

export default router;
