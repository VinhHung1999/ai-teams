import { Router, Request, Response } from 'express';
import storage from '../lib/JsonStorage';
import { pushNotificationToProject } from './board-ws';

const router = Router();

// POST /api/notifications — create + push via Board WS
router.post('/api/notifications', (req: Request, res: Response) => {
  const { session_name, message, from_role, urgency } = req.body;
  if (!session_name || !message) {
    return res.status(400).json({ error: 'session_name and message are required' });
  }

  const project = storage.getProjectBySession(session_name);
  if (!project) {
    return res.status(404).json({ error: `No project for session '${session_name}'` });
  }

  const notification = storage.createNotification({
    project_id: project.id,
    session_name,
    from_role: from_role || null,
    message,
    urgency: urgency || 'normal',
  });

  pushNotificationToProject(project.id, {
    id: notification.id,
    project_id: notification.project_id,
    session_name: notification.session_name,
    from_role: notification.from_role,
    message: notification.message,
    urgency: notification.urgency,
    read: notification.read,
    created_at: notification.created_at,
  });

  return res.json({ ok: true, id: notification.id });
});

// GET /api/notifications?projectId=X&unread=true
router.get('/api/notifications', (req: Request, res: Response) => {
  const projectId = parseInt(req.query.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'projectId required' });

  const notifications = storage.listNotifications({
    projectId,
    unreadOnly: req.query.unread === 'true',
    limit: 50,
  });

  return res.json(notifications.map(n => ({
    id: n.id,
    project_id: n.project_id,
    session_name: n.session_name,
    from_role: n.from_role,
    message: n.message,
    urgency: n.urgency,
    read: n.read,
    created_at: n.created_at,
  })));
});

// PATCH /api/notifications/read — mark all as read for a project
router.patch('/api/notifications/read', (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });
  storage.markAllRead(parseInt(projectId));
  return res.json({ ok: true });
});

export default router;
