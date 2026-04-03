import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { pushNotificationToProject } from './board-ws';

const router = Router();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(urgency: string, fromRole: string | null, sessionName: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const emoji = urgency === 'high' ? '🔴' : '🟡';
  const role = fromRole ? `<b>${fromRole}</b>` : 'Agent';
  const text = `${emoji} ${role} [${sessionName}]\n${message}`;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
  } catch {
    // Telegram failure should not break the main response
  }
}

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

    // Fire-and-forget Telegram notification
    sendTelegram(notification.urgency, notification.from_role, notification.session_name, notification.message);

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
