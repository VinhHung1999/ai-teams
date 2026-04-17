import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { getStorage } from '../storage/factory';
import { resolveBoardDir } from '../storage/MarkdownStorage';
import { onBoardChange } from './board-ws';

let watcherInstance: FSWatcher | null = null;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] [board-watcher] ${msg}`);
}

export async function startBoardFileWatcher(): Promise<void> {
  const storage = await getStorage();
  const projects = await storage.listProjects();

  if (projects.length === 0) {
    log('No projects found, skipping watcher.');
    return;
  }

  // Map normalized boardDir → projectId for fast lookup
  const boardDirToProjectId = new Map<string, number>();
  const watchPaths: string[] = [];

  for (const p of projects) {
    if (!p.working_directory && !p.board_directory) continue;
    const boardDir = path.normalize(resolveBoardDir(p));
    boardDirToProjectId.set(boardDir, p.id);
    watchPaths.push(boardDir);
  }

  log(`Watching ${watchPaths.length} project board dir(s)...`);

  watcherInstance = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    // Ignore machine-written files to avoid feedback loops
    ignored: (p: string) => {
      const base = path.basename(p);
      return base === '_meta.json' || base.endsWith('.tmp') || base.startsWith('.');
    },
    // Wait for write to finish before firing (avoids partial-read on large files)
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    persistent: true,
  });

  watcherInstance.on('all', (_event: string, filePath: string) => {
    const normalized = path.normalize(filePath);
    for (const [boardDir, projectId] of boardDirToProjectId) {
      if (normalized.startsWith(boardDir + path.sep) || normalized === boardDir) {
        log(`Change detected in project ${projectId}: ${path.basename(filePath)}`);
        onBoardChange(projectId);
        break;
      }
    }
  });

  watcherInstance.on('error', (err: unknown) => {
    console.error(`[board-watcher] Error:`, err);
  });
}

export function stopBoardFileWatcher(): void {
  if (watcherInstance) {
    watcherInstance.close();
    watcherInstance = null;
    log('Watcher stopped.');
  }
}
