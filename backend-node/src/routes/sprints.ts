import { Router, Request, Response } from 'express';
import { getStorage } from '../storage/factory';

const router = Router();

// List sprints
router.get('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const storage = await getStorage();
  const sprints = await storage.listSprints(projectId);
  res.json(sprints);
});

// Create sprint
router.post('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { goal } = req.body;
  const storage = await getStorage();
  const sprint = await storage.createSprint(projectId, { goal: goal ?? null });
  res.json(sprint);
});

// Start sprint
router.put('/api/sprints/:sprintId/start', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const storage = await getStorage();
  const sprint = await storage.getSprint(sprintId);
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status !== 'planning') {
    return res.status(400).json({ detail: 'Sprint must be in planning status' });
  }
  const activeSprint = await storage.findActiveSprint(sprint.project_id);
  if (activeSprint) {
    return res.status(400).json({ detail: 'Another sprint is already active. Complete it first.' });
  }
  const updated = await storage.updateSprint(sprintId, {
    status: 'active',
    started_at: new Date().toISOString(),
  });
  res.json(updated);
});

// Complete sprint
router.put('/api/sprints/:sprintId/complete', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const storage = await getStorage();
  const sprint = await storage.getSprint(sprintId);
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status !== 'active') {
    return res.status(400).json({ detail: 'Sprint must be active' });
  }

  // Move incomplete items back to backlog (status: ready), mark done items
  const allItems = await storage.listSprintItemsRaw(sprintId);
  for (const si of allItems) {
    const newStatus = si.board_status === 'done' ? 'done' : 'ready';
    await storage.updateBacklogItem(si.backlog_item_id, { status: newStatus });
  }

  const updated = await storage.updateSprint(sprintId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  res.json(updated);
});

// Delete sprint
router.delete('/api/sprints/:sprintId', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const storage = await getStorage();
  const sprint = await storage.getSprint(sprintId);
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  if (sprint.status === 'active') {
    return res.status(400).json({ detail: 'Cannot delete an active sprint. Complete it first.' });
  }

  // Return items to backlog
  const items = await storage.listSprintItemsRaw(sprintId);
  for (const si of items) {
    await storage.updateBacklogItem(si.backlog_item_id, { status: 'ready' });
  }

  await storage.deleteSprintItemsBySprintId(sprintId);
  await storage.deleteSprint(sprintId);
  res.json({ ok: true });
});

// Add item to sprint
router.post('/api/sprints/:sprintId/items', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const { backlog_item_id, assignee_role } = req.body;
  const storage = await getStorage();

  const sprint = await storage.getSprint(sprintId);
  if (!sprint) {
    return res.status(404).json({ detail: 'Sprint not found' });
  }
  const bi = await storage.getBacklogItem(backlog_item_id);
  if (!bi) {
    return res.status(404).json({ detail: 'Backlog item not found' });
  }

  const si = await storage.createSprintItem(sprintId, { backlog_item_id, assignee_role: assignee_role ?? null });
  await storage.updateBacklogItem(backlog_item_id, { status: 'in_sprint' });

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
  const storage = await getStorage();

  const si = await storage.getSprintItem(itemId, sprintId);
  if (!si || si.sprint_id !== sprintId) {
    return res.status(404).json({ detail: 'Sprint item not found' });
  }

  await storage.updateBacklogItem(si.backlog_item_id, { status: 'ready' });
  await storage.deleteSprintItem(itemId);
  res.json({ ok: true });
});

export default router;
