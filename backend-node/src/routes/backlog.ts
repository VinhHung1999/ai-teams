import { Router, Request, Response } from 'express';
import {
  listBacklog,
  createBacklogItem,
  updateBacklogItem,
  deleteBacklogItem,
  reorderBacklog,
  findBacklogItem,
} from '../lib/MarkdownStorage';

const router = Router();

function formatItem(item: any) {
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
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

// List backlog items
router.get('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const items = await listBacklog(projectId);
  res.json(items.map(formatItem));
});

// Create backlog item
router.post('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { title, description, priority, story_points, acceptance_criteria } = req.body;
  try {
    const item = await createBacklogItem(projectId, {
      title, description, priority, story_points, acceptance_criteria,
    });
    res.json(formatItem(item));
  } catch (e: any) {
    res.status(404).json({ detail: e.message });
  }
});

// Update backlog item
router.put('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await findBacklogItem(id);
  if (!existing) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }

  const patch: any = {};
  for (const field of ['title', 'description', 'priority', 'story_points', 'acceptance_criteria', 'status']) {
    if (req.body[field] !== undefined) patch[field] = req.body[field];
  }

  const item = await updateBacklogItem(id, patch);
  if (!item) return res.status(404).json({ detail: 'Backlog item not found' });
  res.json(formatItem(item));
});

// Delete backlog item
router.delete('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const existing = await findBacklogItem(id);
  if (!existing) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }
  await deleteBacklogItem(id);
  res.json({ ok: true });
});

// Reorder backlog items
router.put('/api/projects/:projectId/backlog/reorder', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { item_ids } = req.body;
  if (item_ids && Array.isArray(item_ids)) {
    await reorderBacklog(projectId, item_ids);
  }
  res.json({ ok: true });
});

export default router;
