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
  limits: { fileSize: 50 * 1024 * 1024 }, // [401] 50MB — ~5min at 96kbps webm
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
// Flow: try direct upload → if Soniox rejects (invalid_audio_file) → ffmpeg convert → retry.
// iOS sends audio/mp4; desktop Chrome/Firefox sends audio/webm. Both paths handled.
async function transcribeWithSoniox(audioFilePath: string, apiKey: string, filename: string = 'audio.webm'): Promise<string> {
  const authHeader = { 'Authorization': `Bearer ${apiKey}` };
  const fileSize = fs.statSync(audioFilePath).size;
  console.error(`[voice] received ${filename} size=${(fileSize/1024).toFixed(1)}KB`);

  const uploadAndTranscribe = async (filePath: string, fname: string): Promise<string> => {
    const audioBlob = new Blob([fs.readFileSync(filePath)], { type: 'application/octet-stream' });
    const uploadForm = new FormData();
    uploadForm.append('file', audioBlob, fname);

    const upRes = await fetch('https://api.soniox.com/v1/files', {
      method: 'POST', headers: authHeader, body: uploadForm,
    });
    const upBody = await upRes.text();
    if (!upRes.ok) throw new Error(`upload_failed:${upBody}`);
    const { id: fileId } = JSON.parse(upBody) as { id: string };
    console.error(`[voice] uploaded file_id=${fileId}`);

    const txRes = await fetch('https://api.soniox.com/v1/transcriptions', {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, model: 'stt-async-v4', language_hints: ['vi', 'en'] }),
    });
    if (!txRes.ok) throw new Error(`submit: ${await txRes.text()}`);
    const { id: txId } = await txRes.json() as { id: string };

    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      await new Promise<void>((r) => setTimeout(r, 1500));
      const pollRes = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}`, { headers: authHeader });
      if (!pollRes.ok) throw new Error(`poll: ${pollRes.status}`);
      const poll = await pollRes.json() as { status: string; error_message?: string };
      if (poll.status === 'error') throw new Error(`soniox: ${poll.error_message ?? 'unknown'}`);
      if (poll.status === 'completed') break;
    }

    const tRes = await fetch(`https://api.soniox.com/v1/transcriptions/${txId}/transcript`, { headers: authHeader });
    if (!tRes.ok) throw new Error(`transcript: ${tRes.status}`);
    const { text } = await tRes.json() as { text: string };
    return text.trim();
  };

  // Step 1: Try direct upload. Any Soniox rejection (upload, invalid audio, transcribe error)
  // falls through to ffmpeg — iOS audio/mp4 and some WebM streams are unreliable.
  try {
    return await uploadAndTranscribe(audioFilePath, filename);
  } catch (e: any) {
    console.error(`[voice] direct attempt failed (${e.message}) → ffmpeg fallback`);
  }

  // Step 2: Fallback — rename with extension so ffmpeg can detect format, then convert to OGG
  // multer saves files without extension → ffmpeg can't auto-detect format
  const ext = filename.includes('mp4') || filename.includes('aac') ? '.mp4'
    : filename.includes('ogg') ? '.ogg'
    : '.webm';
  const namedPath = `${audioFilePath}${ext}`;
  fs.renameSync(audioFilePath, namedPath);

  const oggPath = `${audioFilePath}.ogg`;
  try {
    const { stdout, stderr } = await execAsync(
      `ffmpeg -y -i "${namedPath}" -c:a libvorbis -q:a 4 "${oggPath}" 2>&1`,
      { timeout: 30_000 },
    );
    console.error(`[voice] ffmpeg stdout: ${stdout}`);
    if (stderr) console.error(`[voice] ffmpeg stderr: ${stderr}`);
  } catch (e: any) {
    try { fs.renameSync(namedPath, audioFilePath); } catch {} // restore original name for cleanup
    throw new Error(`ffmpeg: ${e.message}`);
  }

  try {
    return await uploadAndTranscribe(oggPath, 'audio.ogg');
  } finally {
    try { fs.unlinkSync(namedPath); } catch {}
    try { fs.unlinkSync(oggPath); } catch {}
  }
}

// POST /api/projects/:projectId/voice — multipart: role (string), audio (blob ≤5MB)
// [382] Renamed from /api/chat/* — namespace cleared with JSONL chat removal.
router.post(
  '/api/projects/:projectId/voice',
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
        transcript = await transcribeWithSoniox(tmpPath, apiKey, file.originalname || 'voice.webm');
        if (!transcript) return res.status(422).json({ error: 'empty transcript from STT' });
      }

      // [382] No '[via UI] BOSS:' prefix — pane shows '❯ <transcript>', parser tags as BOSS.
      await tmSend(sessionName, role, transcript);
      res.json({ ok: true, transcript });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    } finally {
      // tmpPath may have been renamed inside transcribeWithSoniox — try both
      fs.unlink(tmpPath, () => {});
      const mtype = file.mimetype || '';
      const ext2 = mtype.includes('mp4') || mtype.includes('aac') ? '.mp4' : mtype.includes('ogg') ? '.ogg' : '.webm';
      fs.unlink(tmpPath + ext2, () => {});
    }
  },
);

export default router;
