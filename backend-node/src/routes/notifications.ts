import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { pushNotificationToProject } from './board-ws';

const router = Router();

// POST /api/notifications — create + push via Board WS
router.post('/api/notifications', async (req: Request, res: Response) => {
  const { session_name, message, from_role, urgency } = req.body;
  if (!session_name || !message) {
    return res.status(400).json({ error: 'session_name and message are required' });
  }

  try {
    // Resolve session → project
    const project = await prisma.project.findFirst({
      where: { tmux_session_name: session_name },
    });
    if (!project) {
      return res.status(404).json({ error: `No project for session '${session_name}'` });
    }

    const notification = await prisma.notification.create({
      data: {
        project_id: project.id,
        session_name,
        from_role: from_role || null,
        message,
        urgency: urgency || 'normal',
      },
    });

    // Push to all Board WS clients for this project
    pushNotificationToProject(project.id, {
      id: notification.id,
      project_id: notification.project_id,
      session_name: notification.session_name,
      from_role: notification.from_role,
      message: notification.message,
      urgency: notification.urgency,
      read: notification.read,
      created_at: notification.created_at.toISOString(),
    });

    return res.json({ ok: true, id: notification.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications?projectId=X&unread=true
router.get('/api/notifications', async (req: Request, res: Response) => {
  const projectId = parseInt(req.query.projectId as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'projectId required' });

  try {
    const where: any = { project_id: projectId };
    if (req.query.unread === 'true') where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return res.json(notifications.map(n => ({
      id: n.id,
      project_id: n.project_id,
      session_name: n.session_name,
      from_role: n.from_role,
      message: n.message,
      urgency: n.urgency,
      read: n.read,
      created_at: n.created_at.toISOString(),
    })));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read — mark all as read for a project
router.patch('/api/notifications/read', async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    await prisma.notification.updateMany({
      where: { project_id: projectId, read: false },
      data: { read: true },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
