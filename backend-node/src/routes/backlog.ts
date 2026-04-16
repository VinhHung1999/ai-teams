import { Router, Request, Response } from 'express';
import { getStorage } from '../storage/factory';

const router = Router();

// List backlog items
router.get('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const storage = await getStorage();
  const items = await storage.listBacklog(projectId);
  res.json(items);
});

// Create backlog item
router.post('/api/projects/:projectId/backlog', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { title, description, priority, story_points, acceptance_criteria } = req.body;
  const storage = await getStorage();
  const item = await storage.createBacklogItem(projectId, {
    title,
    description,
    priority,
    story_points,
    acceptance_criteria,
  });
  res.json(item);
});

// Update backlog item
router.put('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const storage = await getStorage();
  const existing = await storage.getBacklogItem(id);
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

  const item = await storage.updateBacklogItem(id, updateData);
  res.json(item);
});

// Delete backlog item
router.delete('/api/backlog/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const storage = await getStorage();
  const existing = await storage.getBacklogItem(id);
  if (!existing) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }
  await storage.deleteBacklogItem(id);
  res.json({ ok: true });
});

// Reorder backlog items
router.put('/api/projects/:projectId/backlog/reorder', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { item_ids } = req.body;
  const storage = await getStorage();
  if (item_ids && Array.isArray(item_ids)) {
    await storage.reorderBacklog(projectId, item_ids);
  }
  res.json({ ok: true });
});

export default router;
