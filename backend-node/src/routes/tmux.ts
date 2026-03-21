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

// Send keys to a specific pane by role
router.post('/api/tmux/session/:sessionName/send', async (req: Request, res: Response) => {
  const { sessionName } = req.params;
  const { role, text } = req.body;

  if (!role || !text) {
    return res.status(400).json({ error: 'role and text required' });
  }

  try {
    // Find pane index for role
    const result = execSync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let paneIdx: string | null = null;
    for (const line of result.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) {
        paneIdx = parts[0];
        break;
      }
    }

    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    // Send keys + Enter
    execSync(
      `tmux send-keys -t ${sessionName}:0.${paneIdx} ${JSON.stringify(text)} C-m`,
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    // Two-enter rule
    execSync(
      `tmux send-keys -t ${sessionName}:0.${paneIdx} C-m`,
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Capture pane output
router.get('/api/tmux/session/:sessionName/pane/:role', async (req: Request, res: Response) => {
  const { sessionName, role } = req.params;
  const lines = parseInt(req.query.lines as string) || 200;

  try {
    // Find pane index for role
    const listResult = execSync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let paneIdx: string | null = null;
    for (const line of listResult.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) {
        paneIdx = parts[0];
        break;
      }
    }
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    // Capture pane content with ANSI colors
    const output = execSync(
      `tmux capture-pane -p -e -t ${sessionName}:0.${paneIdx} -S -${lines}`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );

    res.json({ output, pane_index: paneIdx });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Send keys to a specific pane by role
router.post('/api/tmux/session/:sessionName/send', async (req: Request, res: Response) => {
  const { sessionName } = req.params;
  const { role, keys } = req.body;

  if (!role || !keys) {
    return res.status(400).json({ error: 'role and keys required' });
  }

  try {
    const listResult = execSync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let paneIdx: string | null = null;
    for (const line of listResult.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) {
        paneIdx = parts[0];
        break;
      }
    }
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    // Send keys literally
    execSync(
      `tmux send-keys -t ${sessionName}:0.${paneIdx} -l ${JSON.stringify(keys)}`,
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Send special key (Enter, C-c, Up, Down, etc.)
router.post('/api/tmux/session/:sessionName/send-key', async (req: Request, res: Response) => {
  const { sessionName } = req.params;
  const { role, key } = req.body;

  if (!role || !key) {
    return res.status(400).json({ error: 'role and key required' });
  }

  try {
    const listResult = execSync(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`,
      { timeout: 5000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    let paneIdx: string | null = null;
    for (const line of listResult.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1] === role) {
        paneIdx = parts[0];
        break;
      }
    }
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    // Send special key (C-c, Enter, Up, Down, etc.)
    execSync(
      `tmux send-keys -t ${sessionName}:0.${paneIdx} ${key}`,
      { timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] }
    );

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
