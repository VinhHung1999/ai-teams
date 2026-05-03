/**
 * [352] Web Push subscriptions
 * POST /api/push/subscribe   — save subscription
 * DELETE /api/push/subscribe — remove subscription
 * GET  /api/push/vapid-key   — return public VAPID key
 *
 * Push notifications triggered by chatWsNotify() called from chat.ts WS logic.
 */
import { Router, Request, Response } from 'express';
import webpush from 'web-push';
import fs from 'fs';
import path from 'path';

const router = Router();
const DATA_DIR = path.join(__dirname, '../../data');
const SUBS_FILE = path.join(DATA_DIR, 'push-subscriptions.json');
const THROTTLE_MS = 10_000; // 10s per team
const throttleMap = new Map<number, number>(); // projectId → last push time

type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

function loadSubs(): PushSub[] {
  try { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8')); } catch { return []; }
}

function saveSubs(subs: PushSub[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
}

// Configure web-push
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_EMAIL || 'mailto:admin@example.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

router.get('/api/push/vapid-key', (_req: Request, res: Response) => {
  if (!VAPID_PUBLIC_KEY) return res.status(503).json({ error: 'VAPID not configured' });
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post('/api/push/subscribe', (req: Request, res: Response) => {
  const sub = req.body as PushSub;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  const subs = loadSubs();
  if (!subs.find((s) => s.endpoint === sub.endpoint)) {
    subs.push(sub);
    saveSubs(subs);
  }
  res.json({ ok: true });
});

router.delete('/api/push/subscribe', (req: Request, res: Response) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  const subs = loadSubs().filter((s) => s.endpoint !== endpoint);
  saveSubs(subs);
  res.json({ ok: true });
});

// Called from chat.ts WS handler when a message event arrives
export async function pushNotify(projectId: number, projectName: string, text: string, senderRole: string) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  if (senderRole === 'BOSS') return; // skip BOSS echo-back messages
  const now = Date.now();
  if (now - (throttleMap.get(projectId) ?? 0) < THROTTLE_MS) return;
  throttleMap.set(projectId, now);

  const subs = loadSubs();
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: `${projectName} — ${senderRole}`,
    body: text.slice(0, 100),
    projectId,
    icon: '/icon-192.png',
  });

  await Promise.allSettled(subs.map((sub) =>
    webpush.sendNotification(sub as any, payload).catch((e: any) => {
      // Remove expired subscriptions (410 Gone)
      if (e.statusCode === 410) {
        const current = loadSubs().filter((s) => s.endpoint !== sub.endpoint);
        saveSubs(current);
      }
    })
  ));
}

export default router;
