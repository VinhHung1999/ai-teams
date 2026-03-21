import { Router, Request, Response } from 'express';
import { execSync } from 'child_process';
import { globSync } from 'fs';
import path from 'path';
import fs from 'fs';

const router = Router();

router.get('/api/tmux/session/:sessionName', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  const workingDir = (req.query.working_dir as string) || '';

  // 1. Check if setup-team.sh exists in working dir
  let hasSetupFile = false;
  let setupFilePath = '';
  if (workingDir && fs.existsSync(workingDir) && fs.statSync(workingDir).isDirectory()) {
    const pattern = path.join(workingDir, 'docs/tmux/*/setup-team.sh');
    try {
      const matches = globSync(pattern);
      if (matches.length > 0) {
        hasSetupFile = true;
        setupFilePath = matches[0];
      }
    } catch {
      // glob error, ignore
    }
  }

  // 2. Check if tmux session is running
  let tmuxActive = false;
  const roles: string[] = [];
  try {
    const result = execSync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    tmuxActive = true;
    for (const line of result.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1]) {
        roles.push(parts[1]);
      }
    }
  } catch {
    // tmux not running or command failed
  }

  res.json({
    has_setup_file: hasSetupFile,
    setup_file_path: setupFilePath,
    tmux_active: tmuxActive,
    roles,
  });
});

export default router;
