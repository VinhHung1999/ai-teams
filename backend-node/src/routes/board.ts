import { Router, Request, Response } from 'express';
import storage from '../lib/JsonStorage';
import { getDashboard, getSprintItems, moveSprintItem } from '../lib/MarkdownStorage';

const router = Router();

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];

// Get board for a sprint
router.get('/api/sprints/:sprintId/board', async (req: Request, res: Response) => {
  const sprintId = parseInt(req.params.sprintId as string);
  const items = await getSprintItems(sprintId);

  const board: Record<string, any[]> = {};
  for (const col of BOARD_COLUMNS) board[col] = [];

  for (const si of items) {
    const col = BOARD_COLUMNS.includes(si.board_status) ? si.board_status : 'todo';
    const { backlog_item: bi, ...siFields } = si;
    board[col].push({
      id: siFields.id,
      sprint_id: siFields.sprint_id,
      backlog_item_id: siFields.backlog_item_id,
      title: bi.title,
      description: bi.description,
      priority: bi.priority,
      story_points: bi.story_points,
      assignee_role: siFields.assignee_role,
      board_status: siFields.board_status,
      order: siFields.order,
    });
  }
  res.json(board);
});

// Move item to a different column
router.put('/api/board/items/:itemId/move', async (req: Request, res: Response) => {
  const itemId = parseInt(req.params.itemId as string);
  const { board_status, order } = req.body;

  if (!BOARD_COLUMNS.includes(board_status)) {
    return res.status(400).json({ detail: `Invalid status. Must be one of: ${BOARD_COLUMNS.join(', ')}` });
  }

  const moved = await moveSprintItem(itemId, board_status, order);
  if (!moved) {
    return res.status(404).json({ detail: 'Sprint item not found' });
  }

  res.json({ ok: true });
});

// Dashboard — full project view (project + sprints + backlog + boards)
router.get('/api/projects/:projectId/dashboard', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.projectId as string);

  try {
    const data = await getDashboard(projectId);
    if (!data) {
      return res.status(404).json({ detail: 'Project not found' });
    }

    res.json({
      project: data.project,
      sprints: data.sprints.map(s => ({
        id: s.id,
        project_id: s.project_id,
        number: s.number,
        goal: s.goal,
        status: s.status,
        started_at: s.started_at,
        completed_at: s.completed_at,
        created_at: s.created_at,
      })),
      backlog: data.backlog.map(i => ({
        id: i.id,
        project_id: i.project_id,
        title: i.title,
        description: i.description,
        priority: i.priority,
        story_points: i.story_points,
        acceptance_criteria: i.acceptance_criteria,
        status: i.status,
        order: i.order,
        created_at: i.created_at,
        updated_at: i.updated_at,
      })),
      boards: data.boards,
    });
  } catch (e: any) {
    console.error(`[board] dashboard error project ${projectId}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
