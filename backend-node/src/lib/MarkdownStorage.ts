/**
 * MarkdownStorage — reads/writes Obsidian Kanban MD format.
 *
 * Board files live at: <working_directory>/docs/board/
 *   backlog.md              — product backlog (grouped by priority)
 *   sprints/active/sprint-N.md
 *   sprints/archive/sprint-N.md
 *   _meta.json              — { nextBacklogItemId, nextSprintItemId, nextSprintId }
 *
 * Projects come from JsonStorage (registry.json), not from this class.
 */
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import storage from './JsonStorage';
import type { Project } from './JsonStorage';

// ── Column definitions ─────────────────────────────────────────────────────────

export const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'] as const;
export type BoardColumn = typeof BOARD_COLUMNS[number];

const COLUMN_PLAIN: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  testing: 'Testing',
  done: 'Done',
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Sprint {
  id: number;
  project_id: number;
  number: number;
  goal: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BacklogItem {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  acceptance_criteria: any;
  status: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface SprintItem {
  id: number;
  sprint_id: number;
  backlog_item_id: number;
  assignee_role: string | null;
  board_status: string;
  order: number;
  notes: string | null;
  updated_at: string;
}

export interface SprintItemFull extends SprintItem {
  backlog_item: BacklogItem;
}

interface ProjectData {
  backlogItems: BacklogItem[];
  sprints: Sprint[];
  sprintItemsBySprintId: Map<number, Array<{ si: SprintItem; bi: BacklogItem }>>;
  dirty: boolean;
}

type ProjectMeta = { nextBacklogItemId: number; nextSprintItemId: number; nextSprintId: number };

// ── Board directory helpers ────────────────────────────────────────────────────

const VAULT = process.env.SECOND_BRAIN_VAULT ?? '/Users/hungphu/Documents/Note/HungVault/brain2';

export function resolveBoardDir(p: Project): string {
  if (p.board_directory) return p.board_directory;
  const vaultPath = path.join(VAULT, 'wiki', 'projects', p.name, 'docs', 'board');
  if (fs.existsSync(vaultPath)) return vaultPath;
  return path.join(p.working_directory ?? '', 'docs', 'board');
}

function activeDir(p: Project): string { return path.join(resolveBoardDir(p), 'sprints', 'active'); }
function archiveDir(p: Project): string { return path.join(resolveBoardDir(p), 'sprints', 'archive'); }
function backlogFile(p: Project): string { return path.join(resolveBoardDir(p), 'backlog.md'); }
function metaFile(p: Project): string { return path.join(resolveBoardDir(p), '_meta.json'); }

function sprintFilePath(p: Project, sprint: Sprint): string {
  const dir = sprint.status === 'active' ? activeDir(p) : archiveDir(p);
  return path.join(dir, `sprint-${sprint.number}.md`);
}

// ── Atomic write ───────────────────────────────────────────────────────────────

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp.' + Date.now();
  await fsPromises.writeFile(tmp, content, 'utf-8');
  await fsPromises.rename(tmp, filePath);
}

// ── Parser helpers ─────────────────────────────────────────────────────────────

function parseMetaLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of line.split(' · ')) {
    const m = part.match(/^\*\*([^:]+):\*\*\s*(.*)$/);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

interface ParsedCard {
  siId: number;
  title: string;
  done: boolean;
  priority: string;
  points: number | null;
  assignee: string | null;
  boardStatus: string | null;
  backlogId: number;
  description: string | null;
  acceptance: Array<{ text: string; done: boolean }>;
  notes: string | null;
}

function parseCard(lines: string[]): ParsedCard | null {
  if (!lines.length) return null;
  const firstMatch = lines[0].match(/^- \[([ x])\] \*\*\[([A-Za-z0-9_-]+)\]\*\* (.*)$/);
  if (!firstMatch) return null;

  const done = firstMatch[1] === 'x';
  const rawId = firstMatch[2];
  const trailing = rawId.match(/(\d+)$/);
  const siId = trailing
    ? parseInt(trailing[1], 10)
    : Math.abs(rawId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));

  let priority = 'P2', points: number | null = null, assignee: string | null = null;
  let boardStatus: string | null = null, backlogId = siId;
  let description: string | null = null, notes: string | null = null;
  const acceptance: Array<{ text: string; done: boolean }> = [];

  let i = 1;
  while (i < lines.length && lines[i].trim() === '') i++;

  if (i < lines.length && lines[i].trim().startsWith('**')) {
    const meta = parseMetaLine(lines[i].trim());
    if (meta['Priority']) priority = meta['Priority'];
    if (meta['Points']) points = parseInt(meta['Points'], 10) || null;
    if (meta['Assignee']) assignee = meta['Assignee'];
    if (meta['Status']) boardStatus = meta['Status'];
    if (meta['Backlog-ID']) backlogId = parseInt(meta['Backlog-ID'], 10) || siId;
    i++;
  }

  let section = 'none';
  const descLines: string[] = [], notesLines: string[] = [];

  for (; i < lines.length; i++) {
    const s = lines[i].trim();
    if (s === '**Description:**') { section = 'description'; continue; }
    if (s === '**Acceptance:**') { section = 'acceptance'; continue; }
    if (s === '**Notes:**') { section = 'notes'; continue; }
    if (section === 'description') descLines.push(s);
    else if (section === 'acceptance') {
      const m = s.match(/^- \[([ x])\] (.*)$/);
      if (m) acceptance.push({ text: m[2].trim(), done: m[1] === 'x' });
    } else if (section === 'notes') notesLines.push(s);
  }

  if (descLines.length) description = descLines.join('\n').trim() || null;
  if (notesLines.length) notes = notesLines.join('\n').trim() || null;

  return { siId, title: firstMatch[3].trim(), done, priority, points, assignee, boardStatus, backlogId, description, acceptance, notes };
}

function extractCardGroups(content: string): string[][] {
  const lines = content.split('\n');
  const groups: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^- \[[ x]\] \*\*\[[A-Za-z0-9_-]+\]\*\*/.test(line)) {
      if (current) groups.push(current);
      current = [line];
    } else if (current) {
      if (line.startsWith('  ') || line.trim() === '') {
        current.push(line);
      } else {
        groups.push(current);
        current = null;
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

function parseSprintFile(
  content: string,
  fallbackProjectId: number,
): { sprint: Sprint; items: Array<{ si: SprintItem; bi: BacklogItem }> } | null {
  const metaVal = (key: string): string | null => {
    // Obsidian comment format: %% key: value %%
    const obs = content.match(new RegExp(`^%% ${key}: (.+?) %%`, 'm'));
    if (obs) return obs[1].trim();
    // YAML frontmatter fallback: between --- markers
    const fm = content.match(/^---\n([\s\S]*?)\n---/m);
    if (fm) {
      const yl = fm[1].match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      if (yl) return yl[1].trim();
    }
    return null;
  };

  const sprintIdStr = metaVal('sprint-id');
  const sprintNumStr = metaVal('sprint-number');
  if (!sprintIdStr || !sprintNumStr) return null;

  let projectId = fallbackProjectId;
  const projStr = metaVal('project');
  if (projStr) {
    const m = projStr.match(/id (\d+)/);
    if (m) projectId = parseInt(m[1], 10);
  }

  const sprint: Sprint = {
    id: parseInt(sprintIdStr, 10),
    project_id: projectId,
    number: parseInt(sprintNumStr, 10),
    goal: metaVal('goal'),
    status: metaVal('sprint-status') ?? 'planning',
    started_at: metaVal('started'),
    completed_at: metaVal('completed'),
    created_at: metaVal('started') ?? new Date().toISOString(),
  };

  const items: Array<{ si: SprintItem; bi: BacklogItem }> = [];
  const lines = content.split('\n');
  let currentColumn: string | null = null;
  let cardLines: string[] = [];
  let order = 0;

  const flushCard = () => {
    if (!cardLines.length) return;
    const card = parseCard(cardLines);
    if (card && currentColumn) {
      const effectiveStatus =
        card.boardStatus && BOARD_COLUMNS.includes(card.boardStatus as BoardColumn)
          ? card.boardStatus
          : currentColumn;
      const now = new Date().toISOString();
      items.push({
        si: {
          id: card.siId,
          sprint_id: sprint.id,
          backlog_item_id: card.backlogId,
          assignee_role: card.assignee,
          board_status: effectiveStatus,
          order: order++,
          notes: card.notes,
          updated_at: now,
        },
        bi: {
          id: card.backlogId,
          project_id: projectId,
          title: card.title,
          description: card.description,
          priority: card.priority,
          story_points: card.points,
          acceptance_criteria: card.acceptance.length > 0 ? card.acceptance : null,
          status: 'in_sprint',
          order: 0,
          created_at: now,
          updated_at: now,
        },
      });
    }
    cardLines = [];
  };

  for (const line of lines) {
    const colMatch = Object.entries(COLUMN_PLAIN).find(([, title]) => line === `## ${title}`);
    if (colMatch) { flushCard(); currentColumn = colMatch[0]; order = 0; continue; }
    if (line.startsWith('%% kanban:settings') || line.startsWith('```') || line === '%%') continue;
    if (currentColumn) {
      if (/^- \[[ x]\] \*\*\[[A-Za-z0-9_-]+\]\*\*/.test(line)) { flushCard(); cardLines = [line]; }
      else if (cardLines.length > 0) cardLines.push(line);
    }
  }
  flushCard();
  return { sprint, items };
}

function parseBacklogFile(content: string, projectId: number): BacklogItem[] {
  const now = new Date().toISOString();
  const items: BacklogItem[] = [];
  for (const group of extractCardGroups(content)) {
    const card = parseCard(group);
    if (!card) continue;
    items.push({
      id: card.backlogId,
      project_id: projectId,
      title: card.title,
      description: card.description,
      priority: card.priority,
      story_points: card.points,
      acceptance_criteria: card.acceptance.length > 0 ? card.acceptance : null,
      status: card.boardStatus ?? 'ready',
      order: items.length,
      created_at: now,
      updated_at: now,
    });
  }
  return items;
}

// ── Serialization ──────────────────────────────────────────────────────────────

function indent(text: string, spaces = 6): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l.length ? pad + l : l)).join('\n');
}

function cardToLines(siId: number, bi: BacklogItem, si: SprintItem | null): string[] {
  const isDone = si ? si.board_status === 'done' : bi.status === 'done';
  const lines: string[] = [];
  lines.push(`- [${isDone ? 'x' : ' '}] **[${siId}]** ${bi.title.replace(/\n/g, ' ')}`);
  const meta = [`**Priority:** ${bi.priority}`];
  if (bi.story_points != null) meta.push(`**Points:** ${bi.story_points}`);
  if (si?.assignee_role) meta.push(`**Assignee:** ${si.assignee_role}`);
  meta.push(`**Status:** ${si?.board_status ?? bi.status}`);
  meta.push(`**Backlog-ID:** ${bi.id}`);
  lines.push(indent(meta.join(' · ')));
  if (bi.description?.trim()) {
    lines.push(indent('**Description:**'));
    for (const l of bi.description.trim().split('\n')) lines.push(indent(l));
  }
  if (si?.notes?.trim()) {
    lines.push(indent('**Notes:**'));
    for (const l of si.notes.trim().split('\n')) lines.push(indent(l));
  }
  return lines;
}

function serializeBacklogFile(p: Project, items: BacklogItem[]): string {
  const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'];
  const PRIORITY_TITLES: Record<string, string> = {
    P0: '🔴 P0: Critical', P1: '🟠 P1: High', P2: '🟡 P2: Medium', P3: '⚪ P3: Low',
  };
  const lines = [
    '---', '', 'kanban-plugin: board', '', '---', '',
    `%% project: ${p.name} (id ${p.id}) %%`, '%% kind: product-backlog %%', '',
    `# Product Backlog — ${p.name}`, '',
  ];
  for (const pr of PRIORITY_ORDER) {
    lines.push(`## ${PRIORITY_TITLES[pr]}`, '');
    const inP = items.filter(i => i.priority === pr).sort((a, b) => a.order - b.order || a.id - b.id);
    for (const bi of inP) { lines.push(...cardToLines(bi.id, bi, null)); lines.push(''); }
  }
  lines.push('%% kanban:settings', '```', '{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}', '```', '%%', '');
  return lines.join('\n');
}

// ── In-memory cache ────────────────────────────────────────────────────────────

const cache = new Map<number, ProjectData>();
const watchers = new Map<number, fs.FSWatcher>();

function invalidateCache(projectId: number): void {
  cache.delete(projectId);
}

function watchProject(p: Project): void {
  if (watchers.has(p.id)) return;
  try {
    const watcher = fs.watch(resolveBoardDir(p), { recursive: true }, () => {
      const c = cache.get(p.id);
      if (c) c.dirty = true;
    });
    watchers.set(p.id, watcher);
  } catch { /* dir might not exist */ }
}

async function loadProjectData(p: Project): Promise<ProjectData> {
  let backlogItems: BacklogItem[] = [];
  try {
    const content = await fsPromises.readFile(backlogFile(p), 'utf-8');
    backlogItems = parseBacklogFile(content, p.id);
  } catch {}

  const sprints: Sprint[] = [];
  const sprintItemsBySprintId = new Map<number, Array<{ si: SprintItem; bi: BacklogItem }>>();

  for (const [dir, isActive] of [[activeDir(p), true], [archiveDir(p), false]] as [string, boolean][]) {
    let files: string[] = [];
    try { files = await fsPromises.readdir(dir); } catch { continue; }
    for (const f of files) {
      if (!f.startsWith('sprint-') || !f.endsWith('.md')) continue;
      const content = await fsPromises.readFile(path.join(dir, f), 'utf-8').catch(() => '');
      if (!content) continue;
      const parsed = parseSprintFile(content, p.id);
      if (!parsed) continue;
      parsed.sprint.status = isActive ? 'active' : 'completed';
      sprints.push(parsed.sprint);
      sprintItemsBySprintId.set(parsed.sprint.id, parsed.items);
    }
  }
  sprints.sort((a, b) => b.number - a.number);
  return { backlogItems, sprints, sprintItemsBySprintId, dirty: false };
}

async function getProjectData(p: Project): Promise<ProjectData> {
  const cached = cache.get(p.id);
  if (cached && !cached.dirty) return cached;
  const data = await loadProjectData(p);
  cache.set(p.id, data);
  watchProject(p);
  return data;
}

// ── Project meta helpers ───────────────────────────────────────────────────────

async function loadMeta(p: Project): Promise<ProjectMeta> {
  try {
    return JSON.parse(await fsPromises.readFile(metaFile(p), 'utf-8')) as ProjectMeta;
  } catch {
    return { nextBacklogItemId: 1, nextSprintItemId: 1, nextSprintId: 1 };
  }
}

async function saveMeta(p: Project, meta: ProjectMeta): Promise<void> {
  await fsPromises.mkdir(path.dirname(metaFile(p)), { recursive: true });
  await writeAtomic(metaFile(p), JSON.stringify(meta, null, 2));
}

async function writeBacklogFile(p: Project, items: BacklogItem[]): Promise<void> {
  await fsPromises.mkdir(resolveBoardDir(p), { recursive: true });
  await writeAtomic(backlogFile(p), serializeBacklogFile(p, items));
  invalidateCache(p.id);
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface DashboardData {
  project: { id: number; name: string; tmux_session_name: string | null; working_directory: string | null; created_at: string };
  sprints: Sprint[];
  backlog: BacklogItem[];
  boards: Record<string, Record<string, any[]>>;
}

export async function getDashboard(projectId: number): Promise<DashboardData | null> {
  const p = storage.getProject(projectId);
  if (!p) return null;

  const data = await getProjectData(p);

  const boards: Record<string, Record<string, any[]>> = {};
  for (const [sprintId, items] of data.sprintItemsBySprintId) {
    const sid = String(sprintId);
    boards[sid] = Object.fromEntries(BOARD_COLUMNS.map(c => [c, []]));
    for (const { si, bi } of items) {
      const col = BOARD_COLUMNS.includes(si.board_status as BoardColumn) ? si.board_status : 'todo';
      boards[sid][col].push({
        id: si.id, sprint_id: si.sprint_id, backlog_item_id: si.backlog_item_id,
        title: bi.title, description: bi.description, priority: bi.priority,
        story_points: bi.story_points, assignee_role: si.assignee_role,
        board_status: si.board_status, order: si.order,
      });
    }
  }

  return {
    project: { id: p.id, name: p.name, tmux_session_name: p.tmux_session_name, working_directory: p.working_directory, created_at: p.created_at },
    sprints: data.sprints,
    backlog: data.backlogItems,
    boards,
  };
}

export async function getSprintItems(sprintId: number): Promise<SprintItemFull[]> {
  for (const p of storage.getProjects()) {
    const data = await getProjectData(p);
    const items = data.sprintItemsBySprintId.get(sprintId);
    if (items !== undefined) {
      return items.map(({ si, bi }) => ({ ...si, backlog_item: bi }));
    }
  }
  return [];
}

export async function moveSprintItem(itemId: number, newStatus: string, order?: number): Promise<boolean> {
  for (const p of storage.getProjects()) {
    const data = await getProjectData(p);
    for (const [sprintId, items] of data.sprintItemsBySprintId) {
      const found = items.find(({ si }) => si.id === itemId);
      if (!found) continue;

      found.si.board_status = newStatus;
      if (order !== undefined) found.si.order = order;

      const sprint = data.sprints.find(s => s.id === sprintId);
      if (!sprint) return false;

      // Update Status field in the MD file
      const filePath = sprintFilePath(p, sprint);
      let content = await fsPromises.readFile(filePath, 'utf-8').catch(() => '');
      if (!content) return false;

      content = updateCardStatus(content, itemId, newStatus);
      await writeAtomic(filePath, content);
      invalidateCache(p.id);
      return true;
    }
  }
  return false;
}

function updateCardStatus(content: string, itemId: number, newStatus: string): string {
  const lines = content.split('\n');
  let inTargetCard = false;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- \[([ x])\] \*\*\[([A-Za-z0-9_-]+)\]\*\*/);
    if (m) {
      const rawId = m[2];
      const trailing = rawId.match(/(\d+)$/);
      const lineId = trailing ? parseInt(trailing[1], 10) : -1;
      inTargetCard = (lineId === itemId);
      continue;
    }
    if (inTargetCard) {
      if (lines[i].trim().startsWith('**Priority:**')) {
        lines[i] = lines[i].replace(/\*\*Status:\*\* \w+/, `**Status:** ${newStatus}`);
        inTargetCard = false;
      } else if (/^- \[/.test(lines[i])) {
        inTargetCard = false; // next card started
      }
    }
  }
  return lines.join('\n');
}

// ── Backlog CRUD ───────────────────────────────────────────────────────────────

export async function listBacklog(projectId: number): Promise<BacklogItem[]> {
  const p = storage.getProject(projectId);
  if (!p) return [];
  const data = await getProjectData(p);
  const byId = new Map<number, BacklogItem>();
  for (const bi of data.backlogItems) byId.set(bi.id, bi);
  for (const [, items] of data.sprintItemsBySprintId) {
    for (const { bi } of items) { if (!byId.has(bi.id)) byId.set(bi.id, bi); }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id - b.id);
}

export async function createBacklogItem(projectId: number, data: {
  title: string; description?: string | null; priority?: string;
  story_points?: number | null; acceptance_criteria?: any;
}): Promise<BacklogItem> {
  const p = storage.getProject(projectId);
  if (!p) throw new Error(`Project ${projectId} not found`);
  const meta = await loadMeta(p);
  const id = meta.nextBacklogItemId++;
  await saveMeta(p, meta);
  const pData = await getProjectData(p);
  const maxOrder = pData.backlogItems.reduce((m, bi) => Math.max(m, bi.order), 0);
  const now = new Date().toISOString();
  const bi: BacklogItem = {
    id, project_id: projectId, title: data.title,
    description: data.description ?? null, priority: data.priority ?? 'P2',
    story_points: data.story_points ?? null, acceptance_criteria: data.acceptance_criteria ?? null,
    status: 'new', order: maxOrder + 1, created_at: now, updated_at: now,
  };
  pData.backlogItems.push(bi);
  await writeBacklogFile(p, pData.backlogItems);
  return bi;
}

export async function findBacklogItem(id: number): Promise<{ bi: BacklogItem; p: Project } | null> {
  for (const p of storage.getProjects()) {
    const data = await getProjectData(p);
    const bi = data.backlogItems.find(bi => bi.id === id);
    if (bi) return { bi, p };
    for (const [, items] of data.sprintItemsBySprintId) {
      const found = items.find(({ bi }) => bi.id === id);
      if (found) return { bi: found.bi, p };
    }
  }
  return null;
}

export async function updateBacklogItem(id: number, patch: Partial<BacklogItem>): Promise<BacklogItem | null> {
  const now = new Date().toISOString();
  for (const p of storage.getProjects()) {
    const pData = await getProjectData(p);
    const biIdx = pData.backlogItems.findIndex(bi => bi.id === id);
    if (biIdx !== -1) {
      Object.assign(pData.backlogItems[biIdx], patch, { updated_at: now });
      await writeBacklogFile(p, pData.backlogItems);
      return pData.backlogItems[biIdx];
    }
    for (const [, items] of pData.sprintItemsBySprintId) {
      const found = items.find(({ bi }) => bi.id === id);
      if (found) {
        Object.assign(found.bi, patch, { updated_at: now });
        invalidateCache(p.id); // sprint file rewrite is complex — just invalidate
        return found.bi;
      }
    }
  }
  return null;
}

export async function deleteBacklogItem(id: number): Promise<boolean> {
  for (const p of storage.getProjects()) {
    const pData = await getProjectData(p);
    const idx = pData.backlogItems.findIndex(bi => bi.id === id);
    if (idx !== -1) {
      pData.backlogItems.splice(idx, 1);
      await writeBacklogFile(p, pData.backlogItems);
      return true;
    }
  }
  return false;
}

export async function reorderBacklog(projectId: number, itemIds: number[]): Promise<void> {
  const p = storage.getProject(projectId);
  if (!p) return;
  const pData = await getProjectData(p);
  for (let i = 0; i < itemIds.length; i++) {
    const bi = pData.backlogItems.find(b => b.id === itemIds[i]);
    if (bi) bi.order = i;
  }
  await writeBacklogFile(p, pData.backlogItems);
}

// ── Sprint CRUD (for sprints.ts route) ────────────────────────────────────────

export async function listSprints(projectId: number): Promise<Sprint[]> {
  const p = storage.getProject(projectId);
  if (!p) return [];
  const data = await getProjectData(p);
  return [...data.sprints];
}

export async function findSprint(id: number): Promise<{ sprint: Sprint; p: Project } | null> {
  for (const p of storage.getProjects()) {
    const data = await getProjectData(p);
    const sprint = data.sprints.find(s => s.id === id);
    if (sprint) return { sprint, p };
  }
  return null;
}

export async function createSprint(projectId: number, data: { goal?: string | null }): Promise<Sprint> {
  const p = storage.getProject(projectId);
  if (!p) throw new Error(`Project ${projectId} not found`);
  const meta = await loadMeta(p);
  const pData = await getProjectData(p);
  const maxNum = pData.sprints.reduce((m, s) => Math.max(m, s.number), 0);
  const now = new Date().toISOString();
  const sprint: Sprint = {
    id: meta.nextSprintId++,
    project_id: projectId,
    number: maxNum + 1,
    goal: data.goal ?? null,
    status: 'planning',
    started_at: null, completed_at: null, created_at: now,
  };
  await saveMeta(p, meta);
  await fsPromises.mkdir(activeDir(p), { recursive: true });
  const filePath = path.join(activeDir(p), `sprint-${sprint.number}.md`);
  await writeAtomic(filePath, serializeSprintShell(p, sprint));
  invalidateCache(projectId);
  return sprint;
}

function serializeSprintShell(p: Project, sprint: Sprint): string {
  const lines = [
    '---', '', 'kanban-plugin: board', '', '---', '',
    `%% sprint-id: ${sprint.id} %%`,
    `%% sprint-number: ${sprint.number} %%`,
    `%% sprint-status: ${sprint.status} %%`,
  ];
  if (sprint.goal) lines.push(`%% goal: ${sprint.goal.replace(/\n/g, ' ')} %%`);
  if (sprint.started_at) lines.push(`%% started: ${sprint.started_at} %%`);
  lines.push(`%% project: ${p.name} (id ${p.id}) %%`, '');
  lines.push(`# Sprint ${sprint.number}${sprint.goal ? ` — ${sprint.goal}` : ''}`, '');
  for (const col of Object.values(COLUMN_PLAIN)) { lines.push(`## ${col}`, ''); }
  lines.push('%% kanban:settings', '```', '{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}', '```', '%%', '');
  return lines.join('\n');
}

export async function updateSprint(id: number, patch: Partial<Sprint>): Promise<Sprint | null> {
  const found = await findSprint(id);
  if (!found) return null;
  const { sprint, p } = found;
  const oldFile = sprintFilePath(p, sprint);
  Object.assign(sprint, patch);
  const newFile = sprintFilePath(p, sprint);
  if (oldFile !== newFile) {
    await fsPromises.mkdir(path.dirname(newFile), { recursive: true });
    try {
      await fsPromises.rename(oldFile, newFile);
    } catch {
      await fsPromises.copyFile(oldFile, newFile);
      await fsPromises.unlink(oldFile).catch(() => {});
    }
  }
  // Update meta in file
  let content = await fsPromises.readFile(newFile, 'utf-8').catch(() => '');
  content = updateSprintMeta(content, sprint);
  await writeAtomic(newFile, content);
  invalidateCache(p.id);
  return sprint;
}

function updateSprintMeta(content: string, sprint: Sprint): string {
  const replacements: [RegExp, string][] = [
    [/^%% sprint-status: .+ %%$/m, `%% sprint-status: ${sprint.status} %%`],
  ];
  if (sprint.started_at) replacements.push([/^%% started: .+ %%$/m, `%% started: ${sprint.started_at} %%`]);
  if (sprint.completed_at) replacements.push([/^%% completed: .+ %%$/m, `%% completed: ${sprint.completed_at} %%`]);
  let out = content;
  for (const [re, val] of replacements) {
    if (re.test(out)) { out = out.replace(re, val); }
    else { out = out.replace(/^%% sprint-id:/m, `${val}\n%% sprint-id:`); }
  }
  return out;
}

export async function deleteSprint(id: number): Promise<boolean> {
  const found = await findSprint(id);
  if (!found) return false;
  const { sprint, p } = found;
  await fsPromises.unlink(sprintFilePath(p, sprint)).catch(() => {});
  invalidateCache(p.id);
  return true;
}

// ── Sprint items (add/remove for sprints.ts route) ─────────────────────────────

export async function addItemToSprint(sprintId: number, data: {
  backlog_item_id: number; assignee_role?: string | null;
}): Promise<SprintItem | null> {
  const found = await findSprint(sprintId);
  if (!found) return null;
  const { sprint, p } = found;
  const meta = await loadMeta(p);
  const id = meta.nextSprintItemId++;
  await saveMeta(p, meta);
  const pData = await getProjectData(p);
  const bi = pData.backlogItems.find(b => b.id === data.backlog_item_id);
  if (!bi) throw new Error(`BacklogItem ${data.backlog_item_id} not found`);

  const items = pData.sprintItemsBySprintId.get(sprintId) ?? [];
  const si: SprintItem = {
    id, sprint_id: sprintId, backlog_item_id: data.backlog_item_id,
    assignee_role: data.assignee_role ?? null, board_status: 'todo',
    order: items.length, notes: null, updated_at: new Date().toISOString(),
  };
  items.push({ si, bi });
  pData.sprintItemsBySprintId.set(sprintId, items);
  invalidateCache(p.id); // will re-read from file next time
  return si;
}

export async function removeItemFromSprint(sprintId: number, itemId: number): Promise<boolean> {
  for (const p of storage.getProjects()) {
    const data = await getProjectData(p);
    const items = data.sprintItemsBySprintId.get(sprintId);
    if (!items) continue;
    const idx = items.findIndex(({ si }) => si.id === itemId);
    if (idx !== -1) {
      items.splice(idx, 1);
      invalidateCache(p.id);
      return true;
    }
  }
  return false;
}
