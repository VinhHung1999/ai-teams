import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import storage from '../lib/JsonStorage';

const execAsync = promisify(exec);
const router = Router();

const attachDir = path.join(__dirname, '../../data/attachments');
fs.mkdirSync(attachDir, { recursive: true });

const upload = multer({
  dest: attachDir,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

function loadSessionName(project: ReturnType<typeof storage.getProject>): string {
  if (!project) return '';
  let sessionName = project.tmux_session_name || '';
  if (project.working_directory) {
    try {
      const mapRaw = fs.readFileSync(
        path.join(project.working_directory, '.ai-teams-sessions.json'),
        'utf-8',
      );
      const mapData = JSON.parse(mapRaw);
      if (mapData.session_name) sessionName = mapData.session_name;
    } catch {}
  }
  return sessionName;
}

async function tmSend(sessionName: string, role: string, text: string): Promise<void> {
  const { stdout } = await execAsync(
    `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
    { timeout: 3000, encoding: 'utf-8' },
  );
  let paneIdx: string | null = null;
  for (const line of stdout.trim().split('\n')) {
    const parts = line.trim().split(' ', 2);
    if (parts.length === 2 && parts[1] === role) { paneIdx = parts[0]; break; }
  }
  if (paneIdx === null) throw new Error(`Role ${role} not found in session ${sessionName}`);
  await execAsync(`tmux send-keys -t ${sessionName}:0.${paneIdx} ${JSON.stringify(text)} C-m`);
  await execAsync(`tmux send-keys -t ${sessionName}:0.${paneIdx} C-m`);
}

// POST /api/chat/:projectId/attach — multipart: role (string), file (blob ≤20MB)
router.post(
  '/api/chat/:projectId/attach',
  upload.single('file'),
  async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: 'invalid projectId' });

    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role required' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'file required' });

    // Keep the file with its original extension for correct MIME serving
    const ext = path.extname(file.originalname || '');
    const finalName = file.filename + ext;
    const finalPath = path.join(attachDir, finalName);
    fs.renameSync(file.path, finalPath);

    try {
      const project = storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: 'project not found' });

      const sessionName = loadSessionName(project);
      if (!sessionName) return res.status(404).json({ error: 'no tmux session configured' });

      const isImage = (file.mimetype || '').startsWith('image/');
      const label = isImage ? '📷 Image' : '📎 File';
      const msg = `[via UI] BOSS: ${label} attached: ${file.originalname} → /api/attachments/${finalName}`;

      await tmSend(sessionName, role, msg);
      res.json({ ok: true, uuid: finalName, name: file.originalname, mime: file.mimetype, isImage });
    } catch (e: any) {
      fs.unlink(finalPath, () => {});
      res.status(500).json({ error: e.message });
    }
  },
);

// GET /api/attachments/:uuid — serve attachment file
router.get('/api/attachments/:uuid', (req: Request, res: Response) => {
  const uuid = req.params.uuid as string;
  // Security: no path traversal
  if (uuid.includes('..') || uuid.includes('/')) return res.status(400).end();
  const filePath = path.join(attachDir, uuid);
  if (!fs.existsSync(filePath)) return res.status(404).end();
  res.sendFile(filePath);
});

export default router;
