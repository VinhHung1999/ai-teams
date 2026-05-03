import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import storage from '../lib/JsonStorage';

const execAsync = promisify(exec);
const router = Router();

const voiceTmpDir = path.join(__dirname, '../../data/voice-tmp');
fs.mkdirSync(voiceTmpDir, { recursive: true });

const upload = multer({
  dest: voiceTmpDir,
  limits: { fileSize: 5 * 1024 * 1024 },
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

// POST /api/chat/:projectId/voice — multipart: role (string), audio (blob ≤5MB)
router.post(
  '/api/chat/:projectId/voice',
  upload.single('audio'),
  async (req: Request, res: Response) => {
    const projectId = parseInt(req.params.projectId as string);
    if (isNaN(projectId)) return res.status(400).json({ error: 'invalid projectId' });

    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role required' });

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'audio file required' });

    const tmpPath = file.path;

    try {
      const project = storage.getProject(projectId);
      if (!project) return res.status(404).json({ error: 'project not found' });

      const sessionName = loadSessionName(project);
      if (!sessionName) return res.status(404).json({ error: 'no tmux session configured' });

      let transcript: string;
      const apiKey = process.env.OPENAI_API_KEY;

      if (!apiKey) {
        // Stub: no key configured — forward placeholder so frontend can still test the flow
        transcript = '[STT pending — set OPENAI_API_KEY in .env to enable voice transcription]';
      } else {
        // Whisper API — native Node.js 22 fetch + FormData + Blob
        const fileBuffer = fs.readFileSync(tmpPath);
        const blob = new Blob([fileBuffer], { type: file.mimetype || 'audio/webm' });

        const formData = new FormData();
        formData.append('file', blob, file.originalname || 'audio.webm');
        formData.append('model', 'whisper-1');

        const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: formData,
        });

        if (!sttRes.ok) {
          const errBody = await sttRes.text();
          throw new Error(`Whisper API ${sttRes.status}: ${errBody.slice(0, 200)}`);
        }

        const sttData = await sttRes.json() as { text: string };
        transcript = sttData.text?.trim() || '';
        if (!transcript) return res.status(422).json({ error: 'empty transcript' });
      }

      await tmSend(sessionName, role, `[via UI] BOSS: ${transcript}`);
      res.json({ ok: true, transcript });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      fs.unlink(tmpPath, () => {});
    }
  },
);

export default router;
