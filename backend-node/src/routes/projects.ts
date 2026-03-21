import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import os from 'os';
import prisma from '../lib/prisma';

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

// List projects
router.get('/api/projects', async (_req: Request, res: Response) => {
  const projects = await prisma.project.findMany({
    orderBy: { created_at: 'desc' },
  });
  res.json(projects.map(p => ({
    id: p.id,
    name: p.name,
    tmux_session_name: p.tmux_session_name,
    working_directory: p.working_directory,
    created_at: p.created_at.toISOString(),
  })));
});

// Create project
router.post('/api/projects', async (req: Request, res: Response) => {
  const { name, tmux_session_name, working_directory } = req.body;
  const project = await prisma.project.create({
    data: {
      name,
      tmux_session_name: tmux_session_name || null,
      working_directory: working_directory || null,
    },
  });
  res.json({
    id: project.id,
    name: project.name,
    tmux_session_name: project.tmux_session_name,
    working_directory: project.working_directory,
    created_at: project.created_at.toISOString(),
  });
});

// Get project
router.get('/api/projects/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }
  res.json({
    id: project.id,
    name: project.name,
    tmux_session_name: project.tmux_session_name,
    working_directory: project.working_directory,
    created_at: project.created_at.toISOString(),
  });
});

// Delete project
router.delete('/api/projects/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string);
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return res.status(404).json({ detail: 'Project not found' });
  }
  await prisma.project.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
