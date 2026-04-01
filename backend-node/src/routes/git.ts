import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const router = Router();

// GET /api/git/changes?path=...
router.get('/api/git/changes', async (req: Request, res: Response) => {
  const cwd = req.query.path as string;
  if (!cwd) return res.status(400).json({ error: 'path is required' });

  // Basic path safety check
  const resolved = path.resolve(cwd);
  if (!resolved.startsWith('/')) return res.status(400).json({ error: 'Invalid path' });

  try {
    // Verify it's a git repo
    await execAsync('git rev-parse --git-dir', { cwd: resolved, timeout: 3000 });
  } catch {
    return res.json({ files: [], diff: '', error: 'Not a git repository' });
  }

  try {
    // Get status
    const { stdout: statusOut } = await execAsync('git status --short --porcelain', {
      cwd: resolved, timeout: 5000,
    });

    const files = statusOut.trim().split('\n').filter(Boolean).map(line => {
      const xy = line.slice(0, 2);
      const filePath = line.slice(3).trim();
      let status: string;
      const x = xy[0], y = xy[1];
      if (xy === '??') status = 'untracked';
      else if (x === 'A') status = 'added';
      else if (x === 'D' || y === 'D') status = 'deleted';
      else if (x === 'R') status = 'renamed';
      else status = 'modified';
      return { path: filePath, status, xy };
    });

    // Get combined diff (staged + unstaged)
    let diff = '';
    try {
      const [staged, unstaged] = await Promise.all([
        execAsync('git diff --cached', { cwd: resolved, timeout: 10000, maxBuffer: 2 * 1024 * 1024 }),
        execAsync('git diff', { cwd: resolved, timeout: 10000, maxBuffer: 2 * 1024 * 1024 }),
      ]);
      diff = staged.stdout + unstaged.stdout;
    } catch {}

    return res.json({ files, diff });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Git command failed' });
  }
});

export default router;
