#!/usr/bin/env tsx
/**
 * Initialize backend-node/data/registry.json from existing _project.md files.
 * Run this once before switching to STORAGE=markdown.
 *
 * Usage:
 *   cd /path/to/ai-teams && npx tsx tools/init-md-registry.ts [--projects-dir dir1,dir2,...]
 *
 * Scans known project working directories for docs/board/_project.md
 * to build the project registry. Also initializes per-project _meta.json.
 *
 * If no --projects-dir given, reads the list from backend-node/data/registry.json
 * if it exists, otherwise uses a hardcoded list.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '../backend-node/data');
const REGISTRY_PATH = path.join(DATA_DIR, 'registry.json');

// Hardcoded base paths to scan for _project.md files.
// Add more here if needed.
const SCAN_BASE_DIRS: string[] = [
  '/Users/hungphu/Documents/AI_Projects',
  '/Users/hungphu/Documents',
];

interface Project {
  id: number;
  name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  pinned: boolean;
  created_at: string;
}

interface Registry {
  projects: Project[];
  nextProjectId: number;
  nextNotificationId: number;
  notifications: any[];
}

async function findProjectMdFiles(baseDirs: string[]): Promise<string[]> {
  const results: string[] = [];
  for (const base of baseDirs) {
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const candidate = path.join(base, entry.name, 'docs', 'board', '_project.md');
          try {
            await fs.access(candidate);
            results.push(candidate);
          } catch {}
        }
      }
    } catch {}
  }
  return results;
}

function parseProjectMd(content: string, filePath: string): Project | null {
  // Parse table rows like: | ID | 14 |
  const idMatch = content.match(/\| ID \| (\d+) \|/);
  const nameMatch = content.match(/# Project: (.+)/);
  const sessionMatch = content.match(/\| Tmux session \| (.+?) \|/);
  const workingDirMatch = content.match(/\| Working directory \| (.+?) \|/);
  const pinnedMatch = content.match(/\| Pinned \| (.+?) \|/);

  if (!idMatch || !nameMatch) return null;

  const wd = path.dirname(path.dirname(path.dirname(filePath))); // remove /docs/board/_project.md
  const workingDir = workingDirMatch?.[1]?.trim() ?? wd;
  const session = sessionMatch?.[1]?.trim();

  return {
    id: parseInt(idMatch[1], 10),
    name: nameMatch[1].trim(),
    tmux_session_name: session && session !== '(none)' ? session : null,
    working_directory: workingDir && workingDir !== '(none)' ? workingDir : null,
    pinned: pinnedMatch?.[1]?.includes('✅') ?? false,
    created_at: new Date().toISOString(),
  };
}

async function findMaxIds(boardDir: string): Promise<{ maxBiId: number; maxSiId: number; maxSprintId: number }> {
  let maxBiId = 0;
  let maxSiId = 0;
  let maxSprintId = 0;

  const sprintIdPat = /^%% sprint-id: (\d+) %%/m;
  const cardPat = /^- \[[ x]\] \*\*\[(\d+)\]\*\*/gm;
  const backlogIdPat = /\*\*Backlog-ID:\*\* (\d+)/g;

  async function scanDir(dir: string, isSprint: boolean) {
    let files: string[] = [];
    try { files = await fs.readdir(dir); } catch { return; }
    for (const f of files) {
      if (!f.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(dir, f), 'utf-8').catch(() => '');
      if (!content) continue;

      if (isSprint) {
        const sidM = content.match(sprintIdPat);
        if (sidM) { const id = parseInt(sidM[1]); if (id > maxSprintId) maxSprintId = id; }
        for (const m of content.matchAll(new RegExp(cardPat.source, 'gm'))) {
          const id = parseInt(m[1]); if (id > maxSiId) maxSiId = id;
        }
        for (const m of content.matchAll(new RegExp(backlogIdPat.source, 'g'))) {
          const id = parseInt(m[1]); if (id > maxBiId) maxBiId = id;
        }
      } else {
        for (const m of content.matchAll(new RegExp(cardPat.source, 'gm'))) {
          const id = parseInt(m[1]); if (id > maxBiId) maxBiId = id;
        }
      }
    }
  }

  await scanDir(boardDir, false);
  await scanDir(path.join(boardDir, 'sprints', 'active'), true);
  await scanDir(path.join(boardDir, 'sprints', 'archive'), true);

  return { maxBiId, maxSiId, maxSprintId };
}

async function main() {
  console.log('Initializing MD registry...\n');

  const projectFiles = await findProjectMdFiles(SCAN_BASE_DIRS);
  console.log(`Found ${projectFiles.length} _project.md files:`);
  for (const f of projectFiles) console.log(`  ${f}`);
  console.log('');

  const projects: Project[] = [];
  for (const f of projectFiles) {
    const content = await fs.readFile(f, 'utf-8');
    const p = parseProjectMd(content, f);
    if (p) {
      projects.push(p);
      console.log(`  parsed: ${p.name} (id ${p.id})`);
    }
  }

  projects.sort((a, b) => a.id - b.id);
  const maxId = projects.reduce((m, p) => Math.max(m, p.id), 0);

  const registry: Registry = {
    projects,
    nextProjectId: maxId + 1,
    nextNotificationId: 1,
    notifications: [],
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  console.log(`\n✅ Registry written: ${REGISTRY_PATH} (${projects.length} projects)`);

  // Per-project _meta.json
  for (const p of projects) {
    if (!p.working_directory) continue;
    const boardDir = path.join(p.working_directory, 'docs', 'board');
    const metaPath = path.join(boardDir, '_meta.json');

    // Check if _meta.json already exists
    try {
      await fs.access(metaPath);
      console.log(`  ${p.name}: _meta.json already exists, skipping`);
      continue;
    } catch {}

    const { maxBiId, maxSiId, maxSprintId } = await findMaxIds(boardDir);
    const meta = {
      nextBacklogItemId: maxBiId + 1,
      nextSprintItemId: maxSiId + 1,
      nextSprintId: maxSprintId + 1,
    };
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    console.log(`  ${p.name}: _meta.json written (biId=${meta.nextBacklogItemId} siId=${meta.nextSprintItemId} sId=${meta.nextSprintId})`);
  }

  console.log('\nDone. To use markdown storage, set STORAGE=markdown before starting the backend.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
