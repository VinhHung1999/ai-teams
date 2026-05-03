import { Router, Request, Response } from 'express';
import {
  listSprints,
  findSprint,
  createSprint,
  updateSprint,
  deleteSprint,
  addItemToSprint,
  removeItemFromSprint,
  getSprintItems,
} from '../lib/MarkdownStorage';

const router = Router();

function formatSprint(s: any) {
  return {
    id: s.id,
    project_id: s.project_id,
    number: s.number,
    goal: s.goal,
    status: s.status,
    started_at: s.started_at,
    completed_at: s.completed_at,
    created_at: s.created_at,
  };
}

// List sprints
router.get('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const sprints = await listSprints(projectId);
  res.json(sprints.map(formatSprint));
});

// Create sprint
router.post('/api/projects/:projectId/sprints', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const { goal } = req.body;
  try {
    const sprint = await createSprint(projectId, { goal: goal || null });
    res.json(formatSprint(sprint));
  } catch (e: any) {
    res.status(404).json({ detail: e.message });
  }
});

// Start sprint
router.put('/api/sprints/:sprintId/start', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const found = await findSprint(sprintId);
  if (!found) return res.status(404).json({ detail: 'Sprint not found' });
  if (found.sprint.status !== 'planning') {
    return res.status(400).json({ detail: 'Sprint must be in planning status' });
  }
  const updated = await updateSprint(sprintId, { status: 'active', started_at: new Date().toISOString() });
  res.json(formatSprint(updated));
});

// Complete sprint
router.put('/api/sprints/:sprintId/complete', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const found = await findSprint(sprintId);
  if (!found) return res.status(404).json({ detail: 'Sprint not found' });
  if (found.sprint.status !== 'active') {
    return res.status(400).json({ detail: 'Sprint must be active' });
  }
  const updated = await updateSprint(sprintId, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
  res.json(formatSprint(updated));
});

// Delete sprint
router.delete('/api/sprints/:sprintId', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const found = await findSprint(sprintId);
  if (!found) return res.status(404).json({ detail: 'Sprint not found' });
  if (found.sprint.status === 'active') {
    return res.status(400).json({ detail: 'Cannot delete an active sprint. Complete it first.' });
  }
  await deleteSprint(sprintId);
  res.json({ ok: true });
});

// Add item to sprint
router.post('/api/sprints/:sprintId/items', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const { backlog_item_id, assignee_role } = req.body;
  try {
    const si = await addItemToSprint(sprintId, { backlog_item_id, assignee_role });
    if (!si) return res.status(404).json({ detail: 'Sprint or backlog item not found' });
    res.json({
      id: si.id, sprint_id: si.sprint_id, backlog_item_id: si.backlog_item_id,
      assignee_role: si.assignee_role, board_status: si.board_status, order: si.order,
    });
  } catch (e: any) {
    res.status(404).json({ detail: e.message });
  }
});

// Remove item from sprint
router.delete('/api/sprints/:sprintId/items/:itemId', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const itemId = parseInt(req.params.itemId as string);
  const removed = await removeItemFromSprint(sprintId, itemId);
  if (!removed) return res.status(404).json({ detail: 'Sprint item not found' });
  res.json({ ok: true });
});

export default router;
