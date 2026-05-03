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

// [377] Transcribe audio via Soniox async batch HTTP API (stt-async-v4).
// More accurate than real-time WS for pre-recorded clips; no token-drop issue.
// Flow: convert WebM → OGG → upload file → submit transcription → poll → fetch transcript.
// Note: Soniox rejects WebM directly ("invalid audio file") — OGG conversion required.
async function transcribeWithSoniox(audioFilePath: string, apiKey: string): Promise<string> {
  const authHeader = { 'Authorization': `Bearer ${apiKey}` };

  // Step 1: Convert to OGG (Soniox rejects .webm from browser MediaRecorder)
  const oggPath = `${audioFilePath}.ogg`;
  try {
    await execAsync(`ffmpeg -y -i "${audioFilePath}" -c:a libvorbis -q:a 4 "${oggPath}"`, { timeout: 30_000 });
  } catch (e: any) {
    throw new Error(`ffmpeg convert: ${e.message}`);
  }

  try {
    // Step 2: Upload audio file
    const audioBlob = new Blob([fs.readFileSync(oggPath)], { type: 'audio/ogg' });
    const uploadForm = new FormData();
    uploadForm.append('file', audioBlob, 'audio.ogg');

    const upRes = await fetch('https://api.soniox.com/v1/files', {
      method: 'POST', headers: authHeader, body: uploadForm,
    });
    if (!upRes.ok) throw new Error(`Soniox upload: ${await upRes.text()}`);
    const { id: fileId } = await upRes.json() as { id: string };

    // Step 3: Submit async transcription
    const txRes = await fetch('https://api.soniox.com/v1/transcriptions', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, model: 'stt-async-v4', language_hints: ['vi', 'en'] }),
    });
    if (!txRes.ok) throw new Error(`Soniox submit: ${await txRes.text()}`);
    const { id: txId } = await txRes.json() as { id: string };

    // Step 4: Poll until completed (max 2 min, 1.5s interval)
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}`, { headers: authHeader });
      if (!pollRes.ok) throw new Error(`Soniox poll: ${pollRes.status}`);
      const poll = await pollRes.json() as { status: string; error_message?: string };
      if (poll.status === 'error') throw new Error(`Soniox: ${poll.error_message ?? 'unknown error'}`);
      if (poll.status === 'completed') break;
    }

    // Step 5: Fetch transcript text
    const tRes = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}/transcript`, { headers: authHeader });
    if (!tRes.ok) throw new Error(`Soniox transcript: ${tRes.status}`);
    const { text } = await tRes.json() as { text: string };
    return text.trim();
  } finally {
    try { fs.unlinkSync(oggPath); } catch {}
  }
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
      const apiKey = process.env.SONIOX_API_KEY;

      if (!apiKey) {
        transcript = '[STT pending — set SONIOX_API_KEY in .env to enable voice transcription]';
      } else {
        transcript = await transcribeWithSoniox(tmpPath, apiKey);
        if (!transcript) return res.status(422).json({ error: 'empty transcript from STT' });
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
