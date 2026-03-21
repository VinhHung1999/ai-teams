import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

function formatBacklogItem(item: any) {
  return {
    id: item.id,
    project_id: item.project_id,
    title: item.title,
    description: item.description,
    priority: item.priority,
    story_points: item.story_points,
    acceptance_criteria: item.acceptance_criteria,
    status: item.status,
    order: item.order,
    created_at: item.created_at.toISOString(),
    updated_at: item.updated_at.toISOString(),
  };
}

// List backlog items
router.get('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const items = await prisma.backlogItem.findMany({
    where: { project_id: projectId },
    orderBy: { order: 'asc' },
  });
  res.json(items.map(formatBacklogItem));
});

// Create backlog item
router.post('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { title, description, priority, story_points, acceptance_criteria } = req.body;

  const maxOrderResult = await prisma.backlogItem.findFirst({
    where: { project_id: projectId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const maxOrder = maxOrderResult?.order ?? 0;

  const item = await prisma.backlogItem.create({
    data: {
      project_id: projectId,
      title,
      description: description || null,
      priority: priority || 'P2',
      story_points: story_points || null,
      acceptance_criteria: acceptance_criteria || null,
      order: maxOrder + 1,
    },
  });
  res.json(formatBacklogItem(item));
});

// Update backlog item
router.put('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.backlogItem.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }

  const updateData: any = {};
  const fields = ['title', 'description', 'priority', 'story_points', 'acceptance_criteria', 'status'];
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      updateData[field] = req.body[field];
    }
  }

  const item = await prisma.backlogItem.update({
    where: { id },
    data: updateData,
  });
  res.json(formatBacklogItem(item));
});

// Delete backlog item
router.delete('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await prisma.backlogItem.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }
  await prisma.backlogItem.delete({ where: { id } });
  res.json({ ok: true });
});

// Reorder backlog items
router.put('/api/projects/:projectId/backlog/reorder', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { item_ids } = req.body;

  if (item_ids && Array.isArray(item_ids)) {
    for (let idx = 0; idx < item_ids.length; idx++) {
      await prisma.backlogItem.updateMany({
        where: { id: item_ids[idx], project_id: projectId },
        data: { order: idx },
      });
    }
  }
  res.json({ ok: true });
});

export default router;
