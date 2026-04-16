import { Router, Request, Response } from 'express';
import path from 'path';
import fs, { globSync } from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getStorage } from '../storage/factory';

const execAsync = promisify(exec);

const router = Router();

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

// List projects — pinned first, then by created_at desc
router.get('/api/projects', async (_req: Request, res: Response) => {
  const storage = await getStorage();
  const projects = await storage.listProjects();
  res.json(projects);
});

// Toggle pin
router.patch('/api/projects/:id/pin', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) return res.status(404).json({ detail: 'Project not found' });
  const updated = await storage.updateProject(id, { pinned: !project.pinned });
  res.json({ id: updated.id, pinned: updated.pinned });
});

// Create project
router.post('/api/projects', async (req: Request, res: Response) => {
  const { name, tmux_session_name, working_directory } = req.body;
  const storage = await getStorage();
  const project = await storage.createProject({
    name,
    tmux_session_name: tmux_session_name ?? null,
    working_directory: working_directory ?? null,
  });
  res.json(project);
});

// Get project (includes tmux status to avoid a separate round-trip)
router.get('/api/projects/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }

  // Setup file check
  let hasSetupFile = false;
  let setupFilePath = '';
  const workingDir = project.working_directory || '';
  if (workingDir && fs.existsSync(workingDir) && fs.statSync(workingDir).isDirectory()) {
    try {
      const matches = globSync(path.join(workingDir, 'docs/tmux/*/setup-team.sh'));
      if (matches.length > 0) {
        hasSetupFile = true;
        setupFilePath = matches[0];
      }
    } catch {}
  }

  // Tmux session check
  let tmuxActive = false;
  const roles: string[] = [];
  const session = project.tmux_session_name;
  if (session) {
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
  }

  res.json({
    id: project.id,
    name: project.name,
    tmux_session_name: project.tmux_session_name,
    working_directory: project.working_directory,
    pinned: project.pinned,
    created_at: project.created_at,
    has_setup_file: hasSetupFile,
    setup_file_path: setupFilePath,
    tmux_active: tmuxActive,
    roles,
  });
});

// Delete project
router.delete('/api/projects/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const storage = await getStorage();
  const project = await storage.getProject(id);
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }
  await storage.deleteProject(id);
  res.json({ ok: true });
});

export default router;
