import { Router, Request, Response } from 'express';
import path from 'path';
import os from 'os';
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
  const logFd = fs.openSync(logPath, 'a');

  // Spawn detached so it survives beyond the HTTP response timeout
  const child = spawn('bash', [setupFile], {
    cwd: workingDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);

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
  const logFd = fs.openSync(logPath, 'w');

  const child = spawn('bash', [setupFile], {
    cwd: workingDir,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  child.unref();
  fs.closeSync(logFd);

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

// ── Context usage endpoint ─────────────────────────────────────────────────────
// Cache: projectId → { data, expiry }
const contextCache = new Map<number, { data: Record<string, number>; expiry: number }>();

router.get('/api/projects/:id/context-usage', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'invalid id' });

  const now = Date.now();
  const cached = contextCache.get(projectId);
  if (cached && now < cached.expiry) return res.json(cached.data);

  const project = storage.getProject(projectId);
  if (!project?.tmux_session_name) return res.json({});
  const session = project.tmux_session_name;

  try {
    // List panes with role names
    const { stdout: paneList } = await execAsync(
      `tmux list-panes -t ${session} -F "#{pane_index} #{@role_name}"`,
      { timeout: 3000, encoding: 'utf-8' },
    );

    const result: Record<string, number> = {};
    for (const line of paneList.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length !== 2 || !parts[1]) continue;
      const [paneIdx, role] = parts;
      try {
        // Capture last 10 lines of pane — status bar is at the bottom
        const { stdout: paneOutput } = await execAsync(
          `tmux capture-pane -p -t ${session}:0.${paneIdx} -S -10`,
          { timeout: 2000, encoding: 'utf-8' },
        );
        // Extract the LAST percentage in the output (Claude Code status bar format: "26% | $0.05 | 2m 30s")
        const matches = paneOutput.match(/\b(\d{1,3})%/g);
        if (matches && matches.length > 0) {
          const lastPct = parseInt(matches[matches.length - 1]);
          if (lastPct >= 0 && lastPct <= 100) result[role] = lastPct;
        }
      } catch {}
    }

    contextCache.set(projectId, { data: result, expiry: now + 5000 });
    return res.json(result);
  } catch (e: any) {
    return res.json({});
  }
});

// ── GET /api/projects/:id/role-models ─────────────────────────────────────────
// Returns the last-used model per role by scanning the tail of each role's JSONL.
// Cache: 30s per project.

const roleModelsCache = new Map<number, { data: Record<string, string>; expiry: number }>();

async function lastModelInJsonl(jsonlPath: string): Promise<string | null> {
  if (!fs.existsSync(jsonlPath)) return null;
  try {
    const { stdout } = await execAsync(`tail -n 300 "${jsonlPath}"`, { timeout: 3000 });
    const lines = stdout.split('\n').filter(Boolean).reverse();
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'assistant' && obj.message?.model) return obj.message.model as string;
      } catch {}
    }
  } catch {}
  return null;
}

router.get('/api/projects/:id/role-models', async (req: Request, res: Response) => {
  const projectId = parseInt(req.params.id as string);
  if (isNaN(projectId)) return res.status(400).json({ error: 'invalid id' });

  const now = Date.now();
  const cached = roleModelsCache.get(projectId);
  if (cached && now < cached.expiry) return res.json(cached.data);

  const project = storage.getProject(projectId);
  if (!project?.working_directory) return res.json({});

  const mapPath = path.join(project.working_directory, '.ai-teams-sessions.json');
  if (!fs.existsSync(mapPath)) return res.json({});

  let roles: Record<string, { session_id: string; cwd: string }>;
  try { roles = JSON.parse(fs.readFileSync(mapPath, 'utf-8')).roles ?? {}; }
  catch { return res.json({}); }

  const result: Record<string, string> = {};
  await Promise.all(Object.entries(roles).map(async ([role, info]) => {
    const encoded = info.cwd.replace(/[/_]/g, '-');
    const jsonlPath = path.join(os.homedir(), '.claude', 'projects', encoded, `${info.session_id}.jsonl`);
    const model = await lastModelInJsonl(jsonlPath);
    if (model) result[role] = model;
  }));

  roleModelsCache.set(projectId, { data: result, expiry: now + 30000 });
  return res.json(result);
});

// ── POST /api/projects/:id/compact-all ────────────────────────────────────────

router.post('/api/projects/:id/compact-all', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = getProject(id);
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });

  const sessionName = project.tmux_session_name;
  if (!sessionName) return res.status(400).json({ ok: false, error: 'No tmux session' });
  if (!(await tmuxHasSession(sessionName))) return res.status(400).json({ ok: false, error: 'Session not running' });

  try {
    const { stdout } = await execAsync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 3000, encoding: 'utf-8' },
    );
    const panes = stdout.trim().split('\n').map((l) => {
      const parts = l.trim().split(' ', 2);
      return parts.length === 2 ? { idx: parts[0], role: parts[1] } : null;
    }).filter(Boolean) as { idx: string; role: string }[];

    for (const { idx } of panes) {
      await execAsync(`tmux send-keys -t ${sessionName}:0.${idx} '/compact' Enter`);
    }
    return res.json({ ok: true, compacted: panes.length });
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
