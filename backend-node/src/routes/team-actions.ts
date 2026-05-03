import { Router, Request, Response } from 'express';
import path from 'path';
import fs, { globSync } from 'fs';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import storage from '../lib/JsonStorage';

const execAsync = promisify(exec);
const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function getSetupFile(workingDir: string): string {
  if (!workingDir || !fs.existsSync(workingDir)) return '';
  try {
    const matches = globSync(path.join(workingDir, 'docs/tmux/*/setup-team.sh'));
    return matches[0] ?? '';
  } catch { return ''; }
}

function isPathSafe(filePath: string, workingDir: string): boolean {
  const resolved = path.resolve(filePath);
  const base = path.resolve(workingDir);
  return resolved.startsWith(base + path.sep) || resolved === base;
}

async function tmuxHasSession(sessionName: string): Promise<boolean> {
  try {
    await execAsync(`tmux has-session -t ${sessionName} 2>/dev/null`);
    return true;
  } catch { return false; }
}

function getProject(id: number) {
  const project = storage.getProject(id);
  if (!project) return null;
  return project;
}

// ── POST /api/projects/:id/start ───────────────────────────────────────────────

router.post('/api/projects/:id/start', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = getProject(id);
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });

  const sessionName = project.tmux_session_name;
  if (!sessionName) return res.status(400).json({ ok: false, error: 'Project has no tmux_session_name' });

  // Already running — return ok without double-creating
  if (await tmuxHasSession(sessionName)) {
    return res.json({ ok: true, sessionName, already_active: true });
  }

  const workingDir = project.working_directory || '';
  const setupFile = getSetupFile(workingDir);
  if (!setupFile) return res.status(400).json({ ok: false, error: 'No setup-team.sh found in working_directory' });

  // Path traversal guard
  if (!isPathSafe(setupFile, workingDir)) {
    return res.status(400).json({ ok: false, error: 'setup_file_path is outside working_directory' });
  }

  const logPath = `/tmp/${sessionName}-startup.log`;
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  // Spawn detached so it survives beyond the HTTP response timeout
  const child = spawn('bash', [setupFile], {
    cwd: workingDir,
    detached: true,
    stdio: ['ignore', logStream, logStream],
  });
  child.unref();

  // Wait up to 5s for tmux session to appear
  const deadline = Date.now() + 5000;
  let active = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await tmuxHasSession(sessionName)) { active = true; break; }
  }

  if (active) {
    return res.json({ ok: true, sessionName, already_active: false, log_path: logPath });
  }
  return res.status(202).json({ ok: true, sessionName, already_active: false, log_path: logPath, note: 'Session not yet visible — setup still running, check log' });
});

// ── POST /api/projects/:id/kill ────────────────────────────────────────────────

router.post('/api/projects/:id/kill', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = getProject(id);
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });

  const sessionName = project.tmux_session_name;
  if (!sessionName) return res.status(400).json({ ok: false, error: 'Project has no tmux_session_name' });

  if (!(await tmuxHasSession(sessionName))) {
    return res.json({ ok: true, note: 'Session was not running' });
  }

  try {
    await execAsync(`tmux kill-session -t ${sessionName}`);
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/projects/:id/refresh ────────────────────────────────────────────

router.post('/api/projects/:id/refresh', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = getProject(id);
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });

  const sessionName = project.tmux_session_name;
  if (!sessionName) return res.status(400).json({ ok: false, error: 'Project has no tmux_session_name' });

  // Kill if running
  if (await tmuxHasSession(sessionName)) {
    try { await execAsync(`tmux kill-session -t ${sessionName}`); } catch {}
    // Brief pause for clean shutdown
    await new Promise((r) => setTimeout(r, 500));
  }

  const workingDir = project.working_directory || '';
  const setupFile = getSetupFile(workingDir);
  if (!setupFile) return res.status(400).json({ ok: false, error: 'No setup-team.sh found in working_directory' });

  if (!isPathSafe(setupFile, workingDir)) {
    return res.status(400).json({ ok: false, error: 'setup_file_path is outside working_directory' });
  }

  const logPath = `/tmp/${sessionName}-startup.log`;
  const logStream = fs.createWriteStream(logPath, { flags: 'w' });

  const child = spawn('bash', [setupFile], {
    cwd: workingDir,
    detached: true,
    stdio: ['ignore', logStream, logStream],
  });
  child.unref();

  // Wait up to 5s
  const deadline = Date.now() + 5000;
  let active = false;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    if (await tmuxHasSession(sessionName)) { active = true; break; }
  }

  if (active) {
    return res.json({ ok: true, sessionName, log_path: logPath });
  }
  return res.status(202).json({ ok: true, sessionName, log_path: logPath, note: 'Session not yet visible — setup still running' });
});

export default router;
