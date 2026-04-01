import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { globSync } from 'fs';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const router = Router();

// Limit concurrent exec calls to prevent process explosion
let activeExecs = 0;
const MAX_CONCURRENT = 3;
const execQueue: Array<{ resolve: (v: string) => void; reject: (e: any) => void; cmd: string; timeout: number }> = [];

function processQueue() {
  while (execQueue.length > 0 && activeExecs < MAX_CONCURRENT) {
    const item = execQueue.shift()!;
    activeExecs++;
    execAsync(item.cmd, { timeout: item.timeout, encoding: 'utf-8' })
      .then(({ stdout }) => item.resolve(stdout))
      .catch(item.reject)
      .finally(() => { activeExecs--; processQueue(); });
  }
}

async function runCmd(cmd: string, timeout = 5000): Promise<string> {
  if (activeExecs < MAX_CONCURRENT) {
    activeExecs++;
    try {
      const { stdout } = await execAsync(cmd, { timeout, encoding: 'utf-8' });
      return stdout;
    } finally {
      activeExecs--;
      processQueue();
    }
  }
  return new Promise((resolve, reject) => {
    execQueue.push({ resolve, reject, cmd, timeout });
  });
}

async function findPaneIdx(sessionName: string, role: string): Promise<string | null> {
  const result = await runCmd(
    `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`
  );
  for (const line of result.trim().split('\n')) {
    const parts = line.trim().split(' ', 2);
    if (parts.length === 2 && parts[1] === role) {
      return parts[0];
    }
  }
  return null;
}

router.get('/api/tmux/session/:sessionName', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  const workingDir = (req.query.working_dir as string) || '';

  let hasSetupFile = false;
  let setupFilePath = '';
  if (workingDir && fs.existsSync(workingDir) && fs.statSync(workingDir).isDirectory()) {
    try {
      const matches = globSync(path.join(workingDir, 'docs/tmux/*/setup-team.sh'));
      if (matches.length > 0) {
        hasSetupFile = true;
        setupFilePath = matches[0];
      }
    } catch {}
  }

  let tmuxActive = false;
  const roles: string[] = [];
  try {
    const result = await runCmd(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`
    );
    tmuxActive = true;
    for (const line of result.trim().split('\n')) {
      const parts = line.trim().split(' ', 2);
      if (parts.length === 2 && parts[1]) {
        roles.push(parts[1]);
      }
    }
  } catch {}

  res.json({
    has_setup_file: hasSetupFile,
    setup_file_path: setupFilePath,
    tmux_active: tmuxActive,
    roles,
  });
});

// Send text to a specific pane by role (with Enter)
router.post('/api/tmux/session/:sessionName/send', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  const { role, text, keys } = req.body;

  // Support both {text} (send + Enter) and {keys} (send literally)
  if (!role || (!text && !keys)) {
    return res.status(400).json({ error: 'role and text/keys required' });
  }

  try {
    const paneIdx = await findPaneIdx(sessionName, role);
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    if (text) {
      await runCmd(`tmux send-keys -t ${sessionName}:0.${paneIdx} ${JSON.stringify(text)} C-m`);
      await runCmd(`tmux send-keys -t ${sessionName}:0.${paneIdx} C-m`);
    } else {
      await runCmd(`tmux send-keys -t ${sessionName}:0.${paneIdx} -l ${JSON.stringify(keys)}`);
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Check activity for all panes
const paneHashes = new Map<string, string>();

router.get('/api/tmux/session/:sessionName/activity', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  try {
    const listResult = await runCmd(
      `tmux list-panes -t ${sessionName} -F "#{pane_index} #{@role_name}"`
    );

    const activity: Record<string, boolean> = {};
    const promises = listResult.trim().split('\n').map(async (line) => {
      const parts = line.trim().split(' ', 2);
      if (parts.length !== 2 || !parts[1]) return;
      const [paneIdx, roleName] = parts;

      try {
        const output = await runCmd(
          `tmux capture-pane -p -t ${sessionName}:0.${paneIdx} -S -5`,
          3000
        );
        const key = `${sessionName}:${paneIdx}`;
        const prevHash = paneHashes.get(key);
        const currentHash = simpleHash(output);
        activity[roleName] = prevHash !== undefined && prevHash !== currentHash;
        paneHashes.set(key, currentHash);
      } catch {
        activity[roleName] = false;
      }
    });

    await Promise.all(promises);
    res.json(activity);
  } catch {
    res.json({});
  }
});

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// Kill tmux session
router.post('/api/tmux/session/:sessionName/kill', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  try {
    await runCmd(`tmux kill-session -t ${sessionName} 2>/dev/null`);
  } catch {}
  res.json({ ok: true });
});

// Capture pane output
router.get('/api/tmux/session/:sessionName/pane/:role', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string; const role = req.params.role as string;
  const lines = parseInt(req.query.lines as string) || 200;

  try {
    const paneIdx = await findPaneIdx(sessionName, role);
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    const output = await runCmd(
      `tmux capture-pane -p -e -t ${sessionName}:0.${paneIdx} -S -${lines}`
    );
    res.json({ output, pane_index: paneIdx });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Send special key (Enter, C-c, Up, Down, etc.)
router.post('/api/tmux/session/:sessionName/send-key', async (req: Request, res: Response) => {
  const sessionName = req.params.sessionName as string;
  const { role, key } = req.body;

  if (!role || !key) {
    return res.status(400).json({ error: 'role and key required' });
  }

  try {
    const paneIdx = await findPaneIdx(sessionName, role);
    if (paneIdx === null) {
      return res.status(404).json({ error: `Role ${role} not found` });
    }

    await runCmd(`tmux send-keys -t ${sessionName}:0.${paneIdx} ${key}`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
