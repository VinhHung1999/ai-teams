import { Router, Request, Response } from 'express';
import { getStorage } from '../storage/factory';
import { pushNotificationToProject } from './board-ws';
import { registerNotificationMessage, sendToGroupChat } from '../telegram-bot';

const router = Router();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegram(urgency: string, fromRole: string | null, sessionName: string, message: string): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const emoji = urgency === 'high' ? '🔴' : '🟡';
  const role = fromRole ? `<b>${fromRole}</b>` : 'Agent';
  const text = `${emoji} ${role} [${sessionName}]\n${message}`;
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
    });
    const data = await res.json() as any;
    if (data?.ok && data.result?.message_id) {
      registerNotificationMessage(data.result.message_id, sessionName, fromRole ?? null);
    }
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
    const storage = await getStorage();
    const project = await storage.findProjectBySession(session_name);
    if (!project) {
      return res.status(404).json({ error: `No project for session '${session_name}'` });
    }

    const notification = await storage.createNotification({
      project_id: project.id,
      session_name,
      from_role: from_role ?? null,
      message,
      urgency: urgency ?? 'normal',
    });

    pushNotificationToProject(project.id, notification);
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
    const storage = await getStorage();
    const notifications = await storage.listNotifications(projectId, req.query.unread === 'true');
    return res.json(notifications);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notifications/read — mark all as read for a project
router.patch('/api/notifications/read', async (req: Request, res: Response) => {
  const { projectId } = req.body;
  if (!projectId) return res.status(400).json({ error: 'projectId required' });

  try {
    const storage = await getStorage();
    await storage.markAllNotificationsRead(projectId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/telegram/send — PO posts to team Telegram group ([299] send_to_team_chat)
router.post('/api/telegram/send', async (req: Request, res: Response) => {
  const { team, message, reply_to_message_id } = req.body;
  if (!team || !message) {
    return res.status(400).json({ error: 'team and message are required' });
  }
  const result = await sendToGroupChat(team, message, reply_to_message_id);
  if (!result.ok) return res.status(400).json({ error: result.error });
  return res.json({ ok: true });
});

export default router;
