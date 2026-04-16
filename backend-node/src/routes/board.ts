import { Router, Request, Response } from 'express';
import { getStorage } from '../storage/factory';

const router = Router();

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];

// Get board
router.get('/api/sprints/:sprintId/board', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const storage = await getStorage();
  const items = await storage.listSprintItems(sprintId);

  const board: Record<string, any[]> = {};
  for (const col of BOARD_COLUMNS) board[col] = [];
  for (const si of items) {
    board[si.board_status].push({
      id: si.id,
      sprint_id: si.sprint_id,
      backlog_item_id: si.backlog_item_id,
      title: si.backlog_item.title,
      description: si.backlog_item.description,
      priority: si.backlog_item.priority,
      story_points: si.backlog_item.story_points,
      assignee_role: si.assignee_role,
      board_status: si.board_status,
      order: si.order,
    });
  }
  res.json(board);
});

// Move item
router.put('/api/board/items/:itemId/move', async (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId as string);
  const { board_status, order } = req.body;
  const storage = await getStorage();

  if (!BOARD_COLUMNS.includes(board_status)) {
    return res.status(400).json({ detail: `Invalid status. Must be one of: ${BOARD_COLUMNS.join(', ')}` });
  }

  const si = await storage.getSprintItemRaw(itemId);
  if (!si) {
    return res.status(404).json({ detail: 'Sprint item not found' });
  }

  await storage.updateSprintItem(itemId, { board_status, order: order ?? 0 });
  res.json({ ok: true });
});

// Dashboard
router.get('/api/projects/:projectId/dashboard', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);
  const storage = await getStorage();
  const data = await storage.getDashboard(projectId);
  if (!data) {
    return res.status(404).json({ detail: 'Project not found' });
  }
  res.json(data);
});

export default router;
