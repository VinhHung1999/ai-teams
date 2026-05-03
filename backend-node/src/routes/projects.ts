import { Router, Request, Response } from 'express';
import path from 'path';
import fs, { globSync } from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import storage from '../lib/JsonStorage';

const execAsync = promisify(exec);

const router = Router();

// ── Shared helpers ─────────────────────────────────────────────────────────────

// 5-second TTL cache for tmux status (avoids hammering tmux on list refresh)
const tmuxCache = new Map<string, { tmuxActive: boolean; roles: string[]; expires: number }>();
const TMUX_CACHE_TTL = 5000;

async function getTmuxStatus(session: string): Promise<{ tmuxActive: boolean; roles: string[] }> {
  const cached = tmuxCache.get(session);
  if (cached && Date.now() < cached.expires) {
    return { tmuxActive: cached.tmuxActive, roles: cached.roles };
  }

  let tmuxActive = false;
  const roles: string[] = [];
  try {
    const { stdout } = await execAsync(
      `tmux list-panes -t ${session} -F "#{pane_index} #{@role_name}" 2>/dev/null`,
      { timeout: 3000, encoding: 'utf-8' }
    );
    tmuxActive = true;
    for (const line of stdout.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1]) roles.push(parts[1]);
    }
  } catch {}

  tmuxCache.set(session, { tmuxActive, roles, expires: Date.now() + TMUX_CACHE_TTL });
  return { tmuxActive, roles };
}

function getSetupFile(workingDir: string): { hasSetupFile: boolean; setupFilePath: string } {
  if (!workingDir || !fs.existsSync(workingDir) || !fs.statSync(workingDir).isDirectory()) {
    return { hasSetupFile: false, setupFilePath: '' };
  }
  try {
    const matches = globSync(path.join(workingDir, 'docs/tmux/*/setup-team.sh'));
    if (matches.length > 0) return { hasSetupFile: true, setupFilePath: matches[0] };
  } catch {}
  return { hasSetupFile: false, setupFilePath: '' };
}

// Browse directories
router.get('/api/projects/browse-dirs', async (req: Request, res: Response) => {
  let dirPath = (req.query.path as string) || '';
  if (!dirPath) {
    dirPath = os.homedir();
  }

  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ detail: 'Not a directory' });
    }
  } catch {
    return res.status(400).json({ detail: 'Not a directory' });
  }

  const dirs: { name: string; path: string }[] = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        dirs.push({ name: entry.name, path: path.join(dirPath, entry.name) });
      }
    }
  } catch {
    // PermissionError equivalent - just return empty
  }

  res.json({
    current: dirPath,
    parent: path.dirname(dirPath),
    dirs,
  });
});

// Create directory
router.post('/api/projects/mkdir', async (req: Request, res: Response) => {
  const { parent, name } = req.body;
  if (!parent || !name) {
    return res.status(400).json({ detail: 'parent and name required' });
  }
  const target = path.join(parent, name);
  if (fs.existsSync(target)) {
    return res.status(400).json({ detail: 'Directory already exists' });
  }
  try {
    fs.mkdirSync(target, { recursive: true });
    res.json({ path: target });
  } catch (e: any) {
    res.status(400).json({ detail: e.message });
  }
});

// List projects (includes tmux_active, roles, has_setup_file, setup_file_path, pinned)
router.get('/api/projects', async (_req: Request, res: Response) => {
  const projects = storage.getProjects()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const enriched = await Promise.all(projects.map(async (p) => {
    const { tmuxActive, roles } = p.tmux_session_name
      ? await getTmuxStatus(p.tmux_session_name)
      : { tmuxActive: false, roles: [] };
    const { hasSetupFile, setupFilePath } = getSetupFile(p.working_directory || '');
    return {
      id: p.id,
      name: p.name,
      tmux_session_name: p.tmux_session_name,
      working_directory: p.working_directory,
      created_at: p.created_at,
      pinned: p.pinned ?? false,
      tmux_active: tmuxActive,
      roles,
      has_setup_file: hasSetupFile,
      setup_file_path: setupFilePath,
    };
  }));

  res.json(enriched);
});

// Create project
router.post('/api/projects', (req: Request, res: Response) => {
  const { name, tmux_session_name, working_directory } = req.body;
  const project = storage.createProject({
    name,
    tmux_session_name: tmux_session_name || null,
    working_directory: working_directory || null,
  });
  res.json({
    id: project.id,
    name: project.name,
    tmux_session_name: project.tmux_session_name,
    working_directory: project.working_directory,
    created_at: project.created_at,
  });
});

// Get project (includes tmux status to avoid a separate round-trip)
router.get('/api/projects/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = storage.getProject(id);
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }

  const { hasSetupFile, setupFilePath } = getSetupFile(project.working_directory || '');
  const { tmuxActive, roles } = project.tmux_session_name
    ? await getTmuxStatus(project.tmux_session_name)
    : { tmuxActive: false, roles: [] };

  res.json({
    id: project.id,
    name: project.name,
    tmux_session_name: project.tmux_session_name,
    working_directory: project.working_directory,
    created_at: project.created_at,
    has_setup_file: hasSetupFile,
    setup_file_path: setupFilePath,
    tmux_active: tmuxActive,
    roles,
  });
});

// Delete project
router.delete('/api/projects/:id', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const deleted = storage.deleteProject(id);
  if (!deleted) {
    return res.status(404).json({ detail: 'Project not found' });
  }
  res.json({ ok: true });
});

export default router;
