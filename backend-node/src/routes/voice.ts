import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { WebSocket } from 'ws';
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

// Transcribe audio file via Soniox WebSocket + ffmpeg PCM conversion.
// Protocol (from sibling project + Soniox docs):
//   1. Connect to wss://stt-rt.soniox.com/transcribe-websocket
//   2. Send JSON config as first text frame
//   3. Stream PCM 16kHz mono s16le binary frames via ffmpeg pipe
//   4. Close WebSocket after ffmpeg finishes → Soniox flushes + closes
//   5. Collect is_final tokens → joined transcript
async function transcribeWithSoniox(audioFilePath: string, apiKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
    let finalText = '';
    let done = false;

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.terminate(); } catch {}
      if (err) reject(err);
      else resolve(finalText.trim());
    };

    const timer = setTimeout(() => finish(new Error('Soniox STT timeout (30s)')), 30_000);

    ws.on('open', () => {
      // Step 1: JSON config frame (must be first — Soniox protocol requirement)
      ws.send(JSON.stringify({
        api_key: apiKey,
        model: 'stt-rt-v4',
        sample_rate: 16000,
        num_channels: 1,
        audio_format: 'pcm_s16le',
        language_hints: ['vi', 'en'],
        language_hints_strict: false,
      }));

      // Step 2: stream audio → PCM 16kHz mono via ffmpeg
      const ff = spawn('ffmpeg', [
        '-i', audioFilePath,
        '-ar', '16000', '-ac', '1', '-f', 's16le', 'pipe:1',
      ], { stdio: ['ignore', 'pipe', 'ignore'] });

      // Track bytes to estimate audio duration for dynamic flush window
      let totalBytesSent = 0;

      ff.stdout.on('data', (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
          totalBytesSent += chunk.length;
        }
      });

      ff.stdout.on('end', () => {
        // [371] Send empty binary frame as potential EOS hint (binary-only protocol after config)
        try { if (ws.readyState === WebSocket.OPEN) ws.send(Buffer.alloc(0)); } catch {}

        // [371] Dynamic flush window: stt-rt-v4 processes ~real-time.
        // PCM 16kHz s16le = 32000 bytes/s. Give Soniox 35% of clip duration + 2s base.
        // Minimum 3000ms (was 2500ms), max 12000ms.
        const audioDurationMs = (totalBytesSent / 32000) * 1000;
        const flushMs = Math.min(12000, Math.max(3000, Math.round(audioDurationMs * 0.35 + 2000)));

        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) ws.close();
        }, flushMs);
      });

      ff.on('error', (e) => finish(new Error(`ffmpeg: ${e.message}`)));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as {
          tokens?: Array<{ text: string; is_final: boolean }>;
          error_message?: string;
        };
        if (msg.error_message) { finish(new Error(`Soniox: ${msg.error_message}`)); return; }
        if (msg.tokens && msg.tokens.length > 0) {
          // Soniox sends the FULL accumulated token list in each message (not deltas).
          // The last non-empty message has the most complete transcript — use all tokens.
          finalText = msg.tokens.map((t) => t.text).join('');
        }
      } catch {}
    });

    ws.on('close', () => finish());
    ws.on('error', (e) => finish(e));
  });
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
