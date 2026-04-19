import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { getStorage } from '../storage/factory';
import { pushNotificationToProject } from './board-ws';
import { registerNotificationMessage } from '../telegram-bot';
import type { Project } from '../storage/types';

const router = Router();

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB Telegram limit

async function sendTelegram(
  urgency: string,
  fromRole: string | null,
  sessionName: string,
  message: string,
  project: Project,
  imagePath?: string,
): Promise<void> {
  if (!TELEGRAM_TOKEN) return;
  const chatId = project.telegram_chat_id ?? (TELEGRAM_CHAT_ID ? Number(TELEGRAM_CHAT_ID) : null);
  if (!chatId) return;

  const emoji = urgency === 'high' ? '🔴' : '🟡';
  const role = fromRole ? `<b>${fromRole}</b>` : 'Agent';
  const text = `${emoji} ${role} [${sessionName}]\n${message}`;

  try {
    if (imagePath) {
      // Validate file
      if (!fs.existsSync(imagePath)) {
        console.error(`[notifications] image_path not found: ${imagePath}`);
        // Fall back to text-only — caller already validated, but be safe
        await sendTextMessage(chatId, text, sessionName, fromRole);
        return;
      }
      const stat = fs.statSync(imagePath);
      if (stat.size > MAX_IMAGE_BYTES) {
        console.error(`[notifications] image too large (${stat.size} bytes): ${imagePath}`);
        await sendTextMessage(chatId, text + '\n⚠️ [image too large to send]', sessionName, fromRole);
        return;
      }

      // Build multipart/form-data
      const fileBuffer = fs.readFileSync(imagePath);
      const fileName = path.basename(imagePath);
      const boundary = `----TGBoundary${Date.now()}`;

      const parts: Buffer[] = [];
      const field = (name: string, value: string) =>
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);

      parts.push(field('chat_id', String(chatId)));
      parts.push(field('caption', text));
      parts.push(field('parse_mode', 'HTML'));
      parts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: image/jpeg\r\n\r\n`)
      );
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
      });
      const data = await res.json() as any;
      if (data?.ok && data.result?.message_id) {
        registerNotificationMessage(data.result.message_id, sessionName, fromRole ?? null);
      } else {
        console.error('[notifications] sendPhoto failed:', JSON.stringify(data));
      }
    } else {
      await sendTextMessage(chatId, text, sessionName, fromRole);
    }
  } catch (e) {
    console.error('[notifications] sendTelegram error:', e);
  }
}

async function sendTextMessage(chatId: number, text: string, sessionName: string, fromRole: string | null): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  const data = await res.json() as any;
  if (data?.ok && data.result?.message_id) {
    registerNotificationMessage(data.result.message_id, sessionName, fromRole ?? null);
  }
}

// POST /api/notifications — create + push via Board WS
router.post('/api/notifications', async (req: Request, res: Response) => {
  const { session_name, message, from_role, urgency, image_path } = req.body;
  if (!session_name || !message) {
    return res.status(400).json({ error: 'session_name and message are required' });
  }

  // Validate image_path early if provided
  if (image_path) {
    if (!fs.existsSync(image_path)) {
      return res.status(400).json({ error: `image_path not found: ${image_path}` });
    }
    const stat = fs.statSync(image_path);
    if (stat.size > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: `image too large for Telegram (max 10MB, got ${Math.round(stat.size / 1024 / 1024 * 10) / 10}MB)` });
    }
  }

  try {
    const storage = await getStorage();
    const project = await storage.findProjectBySession(session_name);
    if (!project) {
      return res.status(404).json({ error: `No project for session '${session_name}'` });
    }

    // Enrich dashboard message with image note for MVP
    const dashboardMessage = image_path
      ? `${message}\n[image: ${path.basename(image_path)}]`
      : message;

    const notification = await storage.createNotification({
      project_id: project.id,
      session_name,
      from_role: from_role ?? null,
      message: dashboardMessage,
      urgency: urgency ?? 'normal',
    });

    pushNotificationToProject(project.id, notification);
    sendTelegram(notification.urgency, notification.from_role, notification.session_name, message, project, image_path);

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

export default router;
