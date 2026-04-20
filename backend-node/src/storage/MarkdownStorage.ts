/**
 * MarkdownStorage — reads/writes Obsidian Kanban MD format.
 *
 * Layout per project (at project.working_directory/docs/board/):
 *   _project.md        — human-readable project meta
 *   _meta.json         — machine IDs (next ids for backlog/sprint/sprint_item)
 *   backlog.md         — unassigned backlog items grouped by priority
 *   sprints/active/sprint-N.md
 *   sprints/archive/sprint-N.md
 *
 * Central registry (backend-node/data/registry.json):
 *   { projects, nextProjectId, nextNotificationId, notifications }
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { IStorage } from './IStorage';
import {
  Project, BacklogItem, Sprint, SprintItem,
  SprintItemWithBacklog, Notification, DashboardData,
} from './types';

const BOARD_COLUMNS = ['todo', 'in_progress', 'in_review', 'testing', 'done'];
const PRIORITY_ORDER = ['P0', 'P1', 'P2', 'P3'];
const PRIORITY_TITLES: Record<string, string> = {
  P0: '🔴 P0: Critical',
  P1: '🟠 P1: High',
  P2: '🟡 P2: Medium',
  P3: '⚪ P3: Low',
};
const COLUMN_TITLES: Record<string, string> = {
  todo: '📋 Todo',
  in_progress: '🔨 In Progress',
  in_review: '👀 In Review',
  testing: '🧪 Testing',
  done: '✅ Done',
};

// Plain-text aliases for sprint files that omit emoji prefixes
const COLUMN_PLAIN: Record<string, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  testing: 'Testing',
  done: 'Done',
};

// ── Registry ────────────────────────────────────────────────────────────────

interface Registry {
  projects: Project[];
  nextProjectId: number;
  nextNotificationId: number;
  notifications: Notification[];
}

// ── Per-project meta ────────────────────────────────────────────────────────

interface ProjectMeta {
  nextBacklogItemId: number;
  nextSprintItemId: number;
  nextSprintId: number;
}

// ── Parsed card data ────────────────────────────────────────────────────────

interface ParsedCard {
  siId: number;           // The [N] in bold — sprint_item_id for sprint files, bi.id for backlog files
  title: string;
  done: boolean;
  priority: string;
  points: number | null;
  assignee: string | null;
  boardStatus: string | null;  // board_status for sprint items
  backlogId: number;           // bi.id — always present
  description: string | null;
  acceptance: Array<{ text: string; done: boolean }>;
  notes: string | null;
  rawLines: string[];          // all lines of this card (for round-trip)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function indent(text: string, spaces = 6): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map(l => (l.length ? pad + l : l)).join('\n');
}

function cardToLines(siId: number, bi: BacklogItem, si: SprintItem | null): string[] {
  const isDone = si ? si.board_status === 'done' : bi.status === 'done';
  const checkbox = isDone ? 'x' : ' ';
  const lines: string[] = [];
  lines.push(`- [${checkbox}] **[${siId}]** ${bi.title.replace(/\n/g, ' ')}`);

  const metaParts: string[] = [
    `**Priority:** ${bi.priority}`,
  ];
  if (bi.story_points != null) metaParts.push(`**Points:** ${bi.story_points}`);
  if (si?.assignee_role) metaParts.push(`**Assignee:** ${si.assignee_role}`);
  if (si?.board_status) metaParts.push(`**Status:** ${si.board_status}`);
  else if (!si) metaParts.push(`**Status:** ${bi.status}`);
  metaParts.push(`**Backlog-ID:** ${bi.id}`);
  lines.push(indent(metaParts.join(' · ')));

  if (bi.description && bi.description.trim()) {
    lines.push(indent('**Description:**'));
    for (const l of bi.description.trim().split('\n')) {
      lines.push(indent(l));
    }
  }

  const ac = parseAcceptanceCriteria(bi.acceptance_criteria);
  if (ac.length > 0) {
    lines.push(indent('**Acceptance:**'));
    for (const c of ac) {
      lines.push(indent(`- [${c.done ? 'x' : ' '}] ${c.text}`));
    }
  }

  if (si?.notes && si.notes.trim()) {
    lines.push(indent('**Notes:**'));
    for (const l of si.notes.trim().split('\n')) {
      lines.push(indent(l));
    }
  }

  return lines;
}

function parseAcceptanceCriteria(raw: unknown): Array<{ text: string; done: boolean }> {
  if (!raw) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.criteria)) arr = obj.criteria;
    else if (Array.isArray(obj.items)) arr = obj.items;
    else return [];
  } else return [];

  return arr.map(c => {
    if (typeof c === 'string') return { text: c, done: false };
    if (typeof c === 'object' && c !== null) {
      const o = c as Record<string, unknown>;
      const text = String(o.text ?? o.title ?? o.criterion ?? '').trim();
      const done = Boolean(o.done ?? o.checked ?? o.completed);
      return text ? { text, done } : null;
    }
    return null;
  }).filter((x): x is { text: string; done: boolean } => x !== null);
}

function parseMetaLine(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  // e.g. "**Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 313"
  const parts = line.split(' · ');
  for (const part of parts) {
    const m = part.match(/^\*\*([^:]+):\*\*\s*(.*)$/);
    if (m) result[m[1].trim()] = m[2].trim();
  }
  return result;
}

/** Parse a raw block of lines (one card, starting with "- [ ] **[N]** Title"). */
function parseCard(lines: string[]): ParsedCard | null {
  if (lines.length === 0) return null;
  const firstLine = lines[0];
  const firstMatch = firstLine.match(/^- \[([ x])\] \*\*\[([A-Za-z0-9_-]+)\]\*\* (.*)$/);
  if (!firstMatch) return null;

  const done = firstMatch[1] === 'x';
  const rawId = firstMatch[2];
  const trailingDigits = rawId.match(/(\d+)$/);
  const siId = trailingDigits ? parseInt(trailingDigits[1], 10) : Math.abs(rawId.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0));
  const title = firstMatch[3].trim();

  let priority = 'P2';
  let points: number | null = null;
  let assignee: string | null = null;
  let boardStatus: string | null = null;
  let backlogId = siId; // default: same as siId (for backlog.md cards)
  let description: string | null = null;
  let acceptance: Array<{ text: string; done: boolean }> = [];
  let notes: string | null = null;

  // Parse remaining lines
  let i = 1;
  // Skip any leading blank indented lines
  while (i < lines.length && lines[i].trim() === '') i++;

  // Meta line (first non-empty indented line)
  if (i < lines.length) {
    const metaRaw = lines[i].trim();
    if (metaRaw.startsWith('**')) {
      const meta = parseMetaLine(metaRaw);
      if (meta['Priority']) priority = meta['Priority'];
      if (meta['Points']) points = parseInt(meta['Points'], 10) || null;
      if (meta['Assignee']) assignee = meta['Assignee'];
      if (meta['Status']) boardStatus = meta['Status'];
      if (meta['Backlog-ID']) backlogId = parseInt(meta['Backlog-ID'], 10) || siId;
      i++;
    }
  }

  // Parse sections: Description, Acceptance, Notes
  let currentSection: 'none' | 'description' | 'acceptance' | 'notes' = 'none';
  const descLines: string[] = [];
  const notesLines: string[] = [];

  while (i < lines.length) {
    const raw = lines[i];
    const stripped = raw.trim();
    i++;

    if (stripped === '**Description:**') {
      currentSection = 'description';
      continue;
    }
    if (stripped === '**Acceptance:**') {
      currentSection = 'acceptance';
      continue;
    }
    if (stripped === '**Notes:**') {
      currentSection = 'notes';
      continue;
    }

    if (currentSection === 'description') {
      descLines.push(stripped);
    } else if (currentSection === 'acceptance') {
      const acMatch = stripped.match(/^- \[([ x])\] (.*)$/);
      if (acMatch) {
        acceptance.push({ text: acMatch[2].trim(), done: acMatch[1] === 'x' });
      }
    } else if (currentSection === 'notes') {
      notesLines.push(stripped);
    }
  }

  if (descLines.length > 0) description = descLines.join('\n').trim() || null;
  if (notesLines.length > 0) notes = notesLines.join('\n').trim() || null;

  return {
    siId, title, done, priority, points, assignee,
    boardStatus, backlogId, description,
    acceptance, notes, rawLines: lines,
  };
}

/** Extract card line groups from MD content. Returns array of line-groups. */
function extractCardGroups(content: string): string[][] {
  const lines = content.split('\n');
  const groups: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^- \[[ x]\] \*\*\[[A-Za-z0-9_-]+\]\*\*/.test(line)) {
      if (current) groups.push(current);
      current = [line];
    } else if (current) {
      // Continuation: indented or blank line before next card/section
      if (line.startsWith('  ') || line.trim() === '') {
        current.push(line);
      } else {
        // End of card
        groups.push(current);
        current = null;
      }
    }
  }
  if (current) groups.push(current);
  return groups;
}

// ── Atomic write ─────────────────────────────────────────────────────────────

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tmp = filePath + '.tmp.' + Date.now();
  await fsp.writeFile(tmp, content, 'utf-8');
  await fsp.rename(tmp, filePath);
}

// ── Sprint MD serialization ──────────────────────────────────────────────────

interface SprintFileData {
  sprint: Sprint;
  items: Array<{ si: SprintItem; bi: BacklogItem }>;
}

function serializeSprintFile(project: Project, data: SprintFileData): string {
  const { sprint, items } = data;
  const lines: string[] = [
    '---', '', 'kanban-plugin: board', '', '---', '',
    `%% sprint-id: ${sprint.id} %%`,
    `%% sprint-number: ${sprint.number} %%`,
    `%% sprint-status: ${sprint.status} %%`,
  ];
  if (sprint.goal) lines.push(`%% goal: ${sprint.goal.replace(/\n/g, ' ')} %%`);
  if (sprint.started_at) lines.push(`%% started: ${sprint.started_at} %%`);
  if (sprint.completed_at) lines.push(`%% completed: ${sprint.completed_at} %%`);
  lines.push(`%% project: ${project.name} (id ${project.id}) %%`);
  lines.push('');
  lines.push(`# Sprint ${sprint.number}${sprint.goal ? ` — ${sprint.goal.replace(/\n/g, ' ')}` : ''}`);
  lines.push('');

  for (const col of BOARD_COLUMNS) {
    lines.push(`## ${COLUMN_TITLES[col]}`);
    lines.push('');
    const inCol = items.filter(({ si }) => si.board_status === col);
    inCol.sort((a, b) => a.si.order - b.si.order || a.si.id - b.si.id);
    for (const { si, bi } of inCol) {
      lines.push(...cardToLines(si.id, bi, si));
      lines.push('');
    }
  }

  lines.push('%% kanban:settings');
  lines.push('```');
  lines.push('{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}');
  lines.push('```');
  lines.push('%%');
  lines.push('');
  return lines.join('\n');
}

function serializeBacklogFile(project: Project, items: BacklogItem[]): string {
  const lines: string[] = [
    '---', '', 'kanban-plugin: board', '', '---', '',
    `%% project: ${project.name} (id ${project.id}) %%`,
    '%% kind: product-backlog %%',
    '',
    `# Product Backlog — ${project.name}`,
    '',
  ];

  for (const p of PRIORITY_ORDER) {
    lines.push(`## ${PRIORITY_TITLES[p]}`);
    lines.push('');
    const inP = items.filter(i => i.priority === p).sort((a, b) => a.order - b.order || a.id - b.id);
    for (const bi of inP) {
      lines.push(...cardToLines(bi.id, bi, null));
      lines.push('');
    }
  }

  lines.push('%% kanban:settings');
  lines.push('```');
  lines.push('{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}');
  lines.push('```');
  lines.push('%%');
  lines.push('');
  return lines.join('\n');
}

// ── Parse sprint MD file ──────────────────────────────────────────────────────

interface ParsedSprint {
  sprint: Sprint;
  items: Array<{ si: SprintItem; bi: BacklogItem }>;
}

function parseSprintFile(content: string, projectId: number, projectName: string): ParsedSprint | null {
  // Parse sprint meta from %% key: value %% comments
  const metaMatch = (key: string) => {
    const m = content.match(new RegExp(`^%% ${key}: (.+?) %%`, 'm'));
    return m ? m[1].trim() : null;
  };

  const sprintIdStr = metaMatch('sprint-id');
  const sprintNumberStr = metaMatch('sprint-number');
  const sprintStatus = metaMatch('sprint-status') ?? 'planning';
  const goal = metaMatch('goal');
  const started = metaMatch('started');
  const completed = metaMatch('completed');
  const projStr = metaMatch('project');

  if (!sprintIdStr || !sprintNumberStr) return null;

  // Derive projectId from file meta if possible (fall back to param)
  let resolvedProjectId = projectId;
  if (projStr) {
    const m = projStr.match(/id (\d+)/);
    if (m) resolvedProjectId = parseInt(m[1], 10);
  }

  const sprint: Sprint = {
    id: parseInt(sprintIdStr, 10),
    project_id: resolvedProjectId,
    number: parseInt(sprintNumberStr, 10),
    goal: goal ?? null,
    status: sprintStatus,
    started_at: started ?? null,
    completed_at: completed ?? null,
    created_at: started ?? new Date().toISOString(),
  };

  // Find cards per column
  const items: Array<{ si: SprintItem; bi: BacklogItem }> = [];
  const lines = content.split('\n');

  let currentColumn: string | null = null;
  let cardStartIdx: number | null = null;
  let cardLinesList: string[] = [];
  let order = 0;

  const flushCard = () => {
    if (cardLinesList.length === 0) return;
    const card = parseCard(cardLinesList);
    if (card && currentColumn) {
      const now = new Date().toISOString();
      const si: SprintItem = {
        id: card.siId,
        sprint_id: sprint.id,
        backlog_item_id: card.backlogId,
        assignee_role: card.assignee,
        board_status: (() => {
          if (card.boardStatus && BOARD_COLUMNS.includes(card.boardStatus)) return card.boardStatus;
          if (card.boardStatus) console.warn(`[parser] Unknown Status "${card.boardStatus}" in sprint ${sprint.id} card [${card.siId}], falling back to ${currentColumn}`);
          return currentColumn;
        })(),
        order: order++,
        notes: card.notes,
        updated_at: now,
      };
      const bi: BacklogItem = {
        id: card.backlogId,
        project_id: resolvedProjectId,
        title: card.title,
        description: card.description,
        priority: card.priority,
        story_points: card.points,
        acceptance_criteria: card.acceptance.length > 0
          ? card.acceptance
          : null,
        status: 'in_sprint',
        order: 0,
        created_at: now,
        updated_at: now,
      };
      items.push({ si, bi });
    }
    cardLinesList = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect column header (emoji or plain)
    const colMatch =
      Object.entries(COLUMN_TITLES).find(([, title]) => line === `## ${title}`) ??
      Object.entries(COLUMN_PLAIN).find(([, title]) => line === `## ${title}`);
    if (colMatch) {
      flushCard();
      currentColumn = colMatch[0];
      order = 0;
      continue;
    }

    // Skip trailing kanban settings
    if (line.startsWith('%% kanban:settings') || line.startsWith('```') || line === '%%') continue;

    if (currentColumn) {
      if (/^- \[[ x]\] \*\*\[[A-Za-z0-9_-]+\]\*\*/.test(line)) {
        flushCard();
        cardLinesList = [line];
      } else if (cardLinesList.length > 0) {
        cardLinesList.push(line);
      }
    }
  }
  flushCard();

  return { sprint, items };
}

function parseBacklogFile(content: string, projectId: number): BacklogItem[] {
  const groups = extractCardGroups(content);
  const items: BacklogItem[] = [];
  const now = new Date().toISOString();

  for (const group of groups) {
    const card = parseCard(group);
    if (!card) continue;
    // Determine backlog status: use boardStatus if present, else 'ready'
    const biStatus = card.boardStatus ?? 'ready';
    items.push({
      id: card.backlogId,
      project_id: projectId,
      title: card.title,
      description: card.description,
      priority: card.priority,
      story_points: card.points,
      acceptance_criteria: card.acceptance.length > 0 ? card.acceptance : null,
      status: biStatus,
      order: items.length,
      created_at: now,
      updated_at: now,
    });
  }
  return items;
}

// ── Cache ─────────────────────────────────────────────────────────────────────

interface ProjectData {
  backlogItems: BacklogItem[];          // items in backlog.md only
  sprints: Sprint[];
  sprintItemsBySprintId: Map<number, { si: SprintItem; bi: BacklogItem }[]>;
  meta: ProjectMeta;
  dirty: boolean;
}

// ── Board directory resolver ───────────────────────────────────────────────────

const VAULT = process.env.SECOND_BRAIN_VAULT ?? '/Users/hungphu/Documents/Note/HungVault/brain2';

export function resolveBoardDir(p: Project): string {
  if (p.board_directory) return p.board_directory;
  const vaultPath = path.join(VAULT, 'wiki', 'projects', p.name, 'docs', 'board');
  if (fs.existsSync(vaultPath)) return vaultPath;
  return path.join(p.working_directory!, 'docs', 'board');
}

// ── MarkdownStorage ───────────────────────────────────────────────────────────

export class MarkdownStorage implements IStorage {
  private registryPath: string;
  private registry!: Registry;
  private cache: Map<number, ProjectData> = new Map();
  private watchers: Map<number, fs.FSWatcher> = new Map();
  private initialized = false;

  constructor(dataDir: string) {
    this.registryPath = path.join(dataDir, 'registry.json');
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await this.loadRegistry();
    this.initialized = true;
  }

  // ── Registry I/O ──────────────────────────────────────────

  private async loadRegistry(): Promise<void> {
    try {
      const raw = await fsp.readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(raw);
    } catch {
      this.registry = { projects: [], nextProjectId: 1, nextNotificationId: 1, notifications: [] };
      await this.saveRegistry();
    }
  }

  private async saveRegistry(): Promise<void> {
    await fsp.mkdir(path.dirname(this.registryPath), { recursive: true });
    await writeAtomic(this.registryPath, JSON.stringify(this.registry, null, 2));
  }

  // ── Project board dir helpers ──────────────────────────────

  private boardDir(p: Project): string {
    return resolveBoardDir(p);
  }

  private activeDir(p: Project): string {
    return path.join(this.boardDir(p), 'sprints', 'active');
  }

  private archiveDir(p: Project): string {
    return path.join(this.boardDir(p), 'sprints', 'archive');
  }

  private sprintFile(p: Project, sprint: Sprint): string {
    const dir = sprint.status === 'active' ? this.activeDir(p) : this.archiveDir(p);
    return path.join(dir, `sprint-${sprint.number}.md`);
  }

  private backlogFile(p: Project): string {
    return path.join(this.boardDir(p), 'backlog.md');
  }

  private metaFile(p: Project): string {
    return path.join(this.boardDir(p), '_meta.json');
  }

  // ── Project meta (next IDs) ────────────────────────────────

  private async loadProjectMeta(p: Project): Promise<ProjectMeta> {
    try {
      const raw = await fsp.readFile(this.metaFile(p), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return { nextBacklogItemId: 1, nextSprintItemId: 1, nextSprintId: 1 };
    }
  }

  private async inferProjectMeta(p: Project): Promise<ProjectMeta> {
    const data = await this.loadProjectData(p);
    let maxBiId = 0;
    let maxSiId = 0;
    let maxSprintId = 0;

    for (const bi of data.backlogItems) {
      if (bi.id > maxBiId) maxBiId = bi.id;
    }
    for (const sprint of data.sprints) {
      if (sprint.id > maxSprintId) maxSprintId = sprint.id;
      for (const { si, bi } of (data.sprintItemsBySprintId.get(sprint.id) ?? [])) {
        if (si.id > maxSiId) maxSiId = si.id;
        if (bi.id > maxBiId) maxBiId = bi.id;
      }
    }

    return {
      nextBacklogItemId: maxBiId + 1,
      nextSprintItemId: maxSiId + 1,
      nextSprintId: maxSprintId + 1,
    };
  }

  private async saveProjectMeta(p: Project, meta: ProjectMeta): Promise<void> {
    await writeAtomic(this.metaFile(p), JSON.stringify(meta, null, 2));
  }

  // ── Project data loading ───────────────────────────────────

  private async loadProjectData(p: Project): Promise<ProjectData> {
    const boardDir = this.boardDir(p);
    const backlogPath = this.backlogFile(p);
    const activeDir = this.activeDir(p);
    const archiveDir = this.archiveDir(p);

    // Load backlog
    let backlogItems: BacklogItem[] = [];
    try {
      const content = await fsp.readFile(backlogPath, 'utf-8');
      backlogItems = parseBacklogFile(content, p.id);
    } catch { /* no backlog file yet */ }

    // Load sprints
    const sprints: Sprint[] = [];
    const sprintItemsBySprintId = new Map<number, { si: SprintItem; bi: BacklogItem }[]>();

    for (const [dir, isActive] of [[activeDir, true], [archiveDir, false]] as [string, boolean][]) {
      let files: string[] = [];
      try { files = await fsp.readdir(dir); } catch { continue; }
      for (const f of files) {
        if (!f.startsWith('sprint-') || !f.endsWith('.md')) continue;
        const content = await fsp.readFile(path.join(dir, f), 'utf-8').catch(() => '');
        if (!content) continue;
        const parsed = parseSprintFile(content, p.id, p.name);
        if (!parsed) continue;
        // Override status from directory location
        if (isActive && parsed.sprint.status !== 'active') {
          parsed.sprint.status = 'active';
        }
        sprints.push(parsed.sprint);
        sprintItemsBySprintId.set(parsed.sprint.id, parsed.items);
      }
    }
    sprints.sort((a, b) => b.number - a.number);

    const meta = await this.loadProjectMeta(p).catch(() => ({
      nextBacklogItemId: 1,
      nextSprintItemId: 1,
      nextSprintId: 1,
    }));

    return { backlogItems, sprints, sprintItemsBySprintId, meta, dirty: false };
  }

  /** Get (or load) cached project data. */
  private async getProjectData(p: Project): Promise<ProjectData> {
    const cached = this.cache.get(p.id);
    if (cached && !cached.dirty) return cached;
    const data = await this.loadProjectData(p);
    this.cache.set(p.id, data);
    this.watchProjectDir(p);
    return data;
  }

  private watchProjectDir(p: Project): void {
    if (this.watchers.has(p.id)) return;
    const boardDir = this.boardDir(p);
    try {
      const watcher = fs.watch(boardDir, { recursive: true }, () => {
        const cached = this.cache.get(p.id);
        if (cached) cached.dirty = true;
      });
      this.watchers.set(p.id, watcher);
    } catch { /* no-op if dir doesn't exist */ }
  }

  private invalidateCache(projectId: number): void {
    this.cache.delete(projectId);
  }

  // ── All sprint items (across sprints) ─────────────────────

  private async getAllSprintItemsForProject(p: Project): Promise<{ si: SprintItem; bi: BacklogItem }[]> {
    const data = await this.getProjectData(p);
    const all: { si: SprintItem; bi: BacklogItem }[] = [];
    for (const [, items] of data.sprintItemsBySprintId) {
      all.push(...items);
    }
    return all;
  }

  // ── Find project by id ──────────────────────────────────────

  private requireProject(id: number): Project {
    const p = this.registry.projects.find(p => p.id === id);
    if (!p) throw new Error(`Project ${id} not found`);
    return p;
  }

  // ── Projects ────────────────────────────────────────────────

  async listProjects(): Promise<Project[]> {
    return [...this.registry.projects].sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  async getProject(id: number): Promise<Project | null> {
    return this.registry.projects.find(p => p.id === id) ?? null;
  }

  async findProjectBySession(sessionName: string): Promise<Project | null> {
    return this.registry.projects.find(p => p.tmux_session_name === sessionName) ?? null;
  }

  async findProjectByChatId(chatId: number): Promise<Project | null> {
    return this.registry.projects.find(p => p.telegram_chat_id === chatId) ?? null;
  }

  async updateProjectTelegramChatId(projectId: number, chatId: number): Promise<void> {
    const p = this.registry.projects.find(p => p.id === projectId);
    if (!p) throw new Error(`Project ${projectId} not found`);
    p.telegram_chat_id = chatId;
    await this.saveRegistry();
  }

  async createProject(data: {
    name: string;
    tmux_session_name?: string | null;
    working_directory?: string | null;
  }): Promise<Project> {
    const id = this.registry.nextProjectId++;
    const project: Project = {
      id,
      name: data.name,
      tmux_session_name: data.tmux_session_name ?? null,
      working_directory: data.working_directory ?? null,
      pinned: false,
      created_at: new Date().toISOString(),
    };
    this.registry.projects.push(project);
    await this.saveRegistry();

    if (project.working_directory) {
      await this.initProjectBoardDir(project);
    }
    return project;
  }

  async updateProject(id: number, data: Partial<Pick<Project, 'name' | 'tmux_session_name' | 'working_directory' | 'pinned'>>): Promise<Project> {
    const idx = this.registry.projects.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Project ${id} not found`);
    Object.assign(this.registry.projects[idx], data);
    await this.saveRegistry();
    return this.registry.projects[idx];
  }

  async deleteProject(id: number): Promise<void> {
    this.registry.projects = this.registry.projects.filter(p => p.id !== id);
    this.registry.notifications = this.registry.notifications.filter(n => n.project_id !== id);
    this.invalidateCache(id);
    await this.saveRegistry();
  }

  private async initProjectBoardDir(p: Project): Promise<void> {
    const boardDir = this.boardDir(p);
    await fsp.mkdir(path.join(boardDir, 'sprints', 'active'), { recursive: true });
    await fsp.mkdir(path.join(boardDir, 'sprints', 'archive'), { recursive: true });

    // _project.md
    const projectMd = `# Project: ${p.name}

| Field | Value |
|---|---|
| ID | ${p.id} |
| Tmux session | ${p.tmux_session_name ?? '(none)'} |
| Working directory | ${p.working_directory ?? '(none)'} |
| Pinned | ${p.pinned ? '✅' : '❌'} |

## Board files

- [[backlog]] — product backlog
- Active sprints: \`sprints/active/\`
- Archived sprints: \`sprints/archive/\`
`;
    await writeAtomic(path.join(boardDir, '_project.md'), projectMd);

    // backlog.md
    await writeAtomic(this.backlogFile(p), serializeBacklogFile(p, []));

    // _meta.json
    const meta: ProjectMeta = { nextBacklogItemId: 1, nextSprintItemId: 1, nextSprintId: 1 };
    await this.saveProjectMeta(p, meta);
  }

  // ── Backlog ─────────────────────────────────────────────────

  async listBacklog(projectId: number): Promise<BacklogItem[]> {
    const p = this.requireProject(projectId);
    const data = await this.getProjectData(p);

    // Collect all backlog items: from backlog.md + embedded in sprint items
    const byId = new Map<number, BacklogItem>();
    for (const bi of data.backlogItems) byId.set(bi.id, bi);

    for (const [, items] of data.sprintItemsBySprintId) {
      for (const { bi } of items) {
        if (!byId.has(bi.id)) byId.set(bi.id, bi);
      }
    }

    return [...byId.values()].sort((a, b) => a.order - b.order || a.id - b.id);
  }

  async getBacklogItem(id: number): Promise<BacklogItem | null> {
    // Search all projects since we only have the bi.id
    for (const p of this.registry.projects) {
      const data = await this.getProjectData(p);
      const fromBacklog = data.backlogItems.find(bi => bi.id === id);
      if (fromBacklog) return fromBacklog;
      for (const [, items] of data.sprintItemsBySprintId) {
        const found = items.find(({ bi }) => bi.id === id);
        if (found) return found.bi;
      }
    }
    return null;
  }

  async createBacklogItem(projectId: number, data: {
    title: string;
    description?: string | null;
    priority?: string;
    story_points?: number | null;
    acceptance_criteria?: unknown;
  }): Promise<BacklogItem> {
    const p = this.requireProject(projectId);
    const meta = await this.loadProjectMeta(p);
    const id = meta.nextBacklogItemId++;
    await this.saveProjectMeta(p, meta);

    const now = new Date().toISOString();
    const pData = await this.getProjectData(p);
    const maxOrder = pData.backlogItems.reduce((m, bi) => Math.max(m, bi.order), 0);

    const bi: BacklogItem = {
      id,
      project_id: projectId,
      title: data.title,
      description: data.description ?? null,
      priority: data.priority ?? 'P2',
      story_points: data.story_points ?? null,
      acceptance_criteria: data.acceptance_criteria ?? null,
      status: 'new',
      order: maxOrder + 1,
      created_at: now,
      updated_at: now,
    };

    pData.backlogItems.push(bi);
    await this.writeBacklogFile(p, pData);
    return bi;
  }

  async updateBacklogItem(id: number, data: Partial<{
    title: string;
    description: string | null;
    priority: string;
    story_points: number | null;
    acceptance_criteria: unknown;
    status: string;
    order: number;
  }>): Promise<BacklogItem> {
    const now = new Date().toISOString();

    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);

      // Check backlog.md
      const biIdx = pData.backlogItems.findIndex(bi => bi.id === id);
      if (biIdx !== -1) {
        Object.assign(pData.backlogItems[biIdx], data, { updated_at: now });
        await this.writeBacklogFile(p, pData);
        return pData.backlogItems[biIdx];
      }

      // Check sprint items
      for (const [sprintId, items] of pData.sprintItemsBySprintId) {
        const found = items.find(({ bi }) => bi.id === id);
        if (found) {
          Object.assign(found.bi, data, { updated_at: now });
          const sprint = pData.sprints.find(s => s.id === sprintId)!;
          await this.writeSprintFile(p, sprint, pData.sprintItemsBySprintId.get(sprintId)!);
          return found.bi;
        }
      }
    }
    throw new Error(`BacklogItem ${id} not found`);
  }

  async deleteBacklogItem(id: number): Promise<void> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);

      const biIdx = pData.backlogItems.findIndex(bi => bi.id === id);
      if (biIdx !== -1) {
        pData.backlogItems.splice(biIdx, 1);
        await this.writeBacklogFile(p, pData);
        return;
      }

      for (const [sprintId, items] of pData.sprintItemsBySprintId) {
        const siIdx = items.findIndex(({ bi }) => bi.id === id);
        if (siIdx !== -1) {
          items.splice(siIdx, 1);
          const sprint = pData.sprints.find(s => s.id === sprintId)!;
          await this.writeSprintFile(p, sprint, items);
          return;
        }
      }
    }
    throw new Error(`BacklogItem ${id} not found`);
  }

  async reorderBacklog(projectId: number, itemIds: number[]): Promise<void> {
    const p = this.requireProject(projectId);
    const pData = await this.getProjectData(p);
    for (let i = 0; i < itemIds.length; i++) {
      const bi = pData.backlogItems.find(b => b.id === itemIds[i]);
      if (bi) bi.order = i;
    }
    await this.writeBacklogFile(p, pData);
  }

  // ── Sprints ─────────────────────────────────────────────────

  async listSprints(projectId: number): Promise<Sprint[]> {
    const p = this.requireProject(projectId);
    const data = await this.getProjectData(p);
    return [...data.sprints];
  }

  async getSprint(id: number): Promise<Sprint | null> {
    for (const p of this.registry.projects) {
      const data = await this.getProjectData(p);
      const s = data.sprints.find(s => s.id === id);
      if (s) return s;
    }
    return null;
  }

  async findActiveSprint(projectId: number): Promise<Sprint | null> {
    const p = this.requireProject(projectId);
    const data = await this.getProjectData(p);
    return data.sprints.find(s => s.status === 'active') ?? null;
  }

  async createSprint(projectId: number, data: { goal?: string | null }): Promise<Sprint> {
    const p = this.requireProject(projectId);
    const meta = await this.loadProjectMeta(p);
    const id = meta.nextSprintId++;
    const pData = await this.getProjectData(p);
    const maxNum = pData.sprints.reduce((m, s) => Math.max(m, s.number), 0);
    const now = new Date().toISOString();

    const sprint: Sprint = {
      id,
      project_id: projectId,
      number: maxNum + 1,
      goal: data.goal ?? null,
      status: 'planning',
      started_at: null,
      completed_at: null,
      created_at: now,
    };

    await this.saveProjectMeta(p, meta);
    pData.sprints.unshift(sprint);
    pData.sprintItemsBySprintId.set(id, []);

    // Write new sprint file (in active/ since it's in planning, we put it there)
    await fsp.mkdir(this.activeDir(p), { recursive: true });
    await writeAtomic(
      path.join(this.activeDir(p), `sprint-${sprint.number}.md`),
      serializeSprintFile(p, { sprint, items: [] })
    );

    return sprint;
  }

  async updateSprint(id: number, data: Partial<{
    status: string;
    started_at: string | null;
    completed_at: string | null;
    goal: string | null;
  }>): Promise<Sprint> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      const sprintIdx = pData.sprints.findIndex(s => s.id === id);
      if (sprintIdx === -1) continue;

      const oldSprint = { ...pData.sprints[sprintIdx] };
      Object.assign(pData.sprints[sprintIdx], data);
      const updatedSprint = pData.sprints[sprintIdx];

      const oldFile = this.sprintFile(p, oldSprint);
      const newFile = this.sprintFile(p, updatedSprint);
      const items = pData.sprintItemsBySprintId.get(id) ?? [];

      if (oldFile !== newFile) {
        // Sprint status changed — move file
        await fsp.mkdir(path.dirname(newFile), { recursive: true });
        await writeAtomic(newFile, serializeSprintFile(p, { sprint: updatedSprint, items }));
        try { await fsp.unlink(oldFile); } catch { /* already gone */ }
      } else {
        await writeAtomic(oldFile, serializeSprintFile(p, { sprint: updatedSprint, items }));
      }

      return updatedSprint;
    }
    throw new Error(`Sprint ${id} not found`);
  }

  async deleteSprint(id: number): Promise<void> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      const sprintIdx = pData.sprints.findIndex(s => s.id === id);
      if (sprintIdx === -1) continue;

      const sprint = pData.sprints[sprintIdx];
      const file = this.sprintFile(p, sprint);
      try { await fsp.unlink(file); } catch { /* already gone */ }

      pData.sprints.splice(sprintIdx, 1);
      pData.sprintItemsBySprintId.delete(id);
      return;
    }
    throw new Error(`Sprint ${id} not found`);
  }

  // ── Sprint Items ─────────────────────────────────────────────

  async listSprintItems(sprintId: number): Promise<SprintItemWithBacklog[]> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      const items = pData.sprintItemsBySprintId.get(sprintId);
      if (items !== undefined) {
        return items.map(({ si, bi }) => ({ ...si, backlog_item: bi }));
      }
    }
    return [];
  }

  async listSprintItemsRaw(sprintId: number): Promise<SprintItem[]> {
    const items = await this.listSprintItems(sprintId);
    return items.map(({ backlog_item: _, ...si }) => si);
  }

  async getSprintItem(id: number, _sprintId?: number): Promise<SprintItemWithBacklog | null> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      for (const [, items] of pData.sprintItemsBySprintId) {
        const found = items.find(({ si }) => si.id === id);
        if (found) return { ...found.si, backlog_item: found.bi };
      }
    }
    return null;
  }

  async getSprintItemRaw(id: number): Promise<SprintItem | null> {
    const si = await this.getSprintItem(id);
    if (!si) return null;
    const { backlog_item: _, ...raw } = si;
    return raw;
  }

  async createSprintItem(sprintId: number, data: {
    backlog_item_id: number;
    assignee_role?: string | null;
  }): Promise<SprintItem> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      const sprint = pData.sprints.find(s => s.id === sprintId);
      if (!sprint) continue;

      // Get backlog item
      const bi = await this.getBacklogItem(data.backlog_item_id);
      if (!bi) throw new Error(`BacklogItem ${data.backlog_item_id} not found`);

      const meta = await this.loadProjectMeta(p);
      const id = meta.nextSprintItemId++;
      await this.saveProjectMeta(p, meta);

      const items = pData.sprintItemsBySprintId.get(sprintId) ?? [];
      const maxOrder = items.reduce((m, { si }) => Math.max(m, si.order), 0);
      const now = new Date().toISOString();

      const si: SprintItem = {
        id,
        sprint_id: sprintId,
        backlog_item_id: data.backlog_item_id,
        assignee_role: data.assignee_role ?? null,
        board_status: 'todo',
        order: maxOrder + 1,
        notes: null,
        updated_at: now,
      };

      // Update bi status to in_sprint
      const updatedBi = { ...bi, status: 'in_sprint', updated_at: now };
      items.push({ si, bi: updatedBi });
      pData.sprintItemsBySprintId.set(sprintId, items);

      // Remove from backlog.md if present
      const biIdx = pData.backlogItems.findIndex(b => b.id === data.backlog_item_id);
      if (biIdx !== -1) {
        pData.backlogItems.splice(biIdx, 1);
        await this.writeBacklogFile(p, pData);
      }

      await this.writeSprintFile(p, sprint, items);
      return si;
    }
    throw new Error(`Sprint ${sprintId} not found`);
  }

  async updateSprintItem(id: number, data: Partial<{
    board_status: string;
    order: number;
    assignee_role: string | null;
    notes: string | null;
  }>): Promise<SprintItem> {
    const now = new Date().toISOString();
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      for (const [sprintId, items] of pData.sprintItemsBySprintId) {
        const found = items.find(({ si }) => si.id === id);
        if (!found) continue;
        Object.assign(found.si, data, { updated_at: now });
        const sprint = pData.sprints.find(s => s.id === sprintId)!;
        await this.writeSprintFile(p, sprint, items);
        return found.si;
      }
    }
    throw new Error(`SprintItem ${id} not found`);
  }

  async deleteSprintItem(id: number): Promise<void> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      for (const [sprintId, items] of pData.sprintItemsBySprintId) {
        const idx = items.findIndex(({ si }) => si.id === id);
        if (idx === -1) continue;
        const [removed] = items.splice(idx, 1);
        const sprint = pData.sprints.find(s => s.id === sprintId)!;
        await this.writeSprintFile(p, sprint, items);

        // Return backlog item to backlog.md
        const now = new Date().toISOString();
        const restoredBi = { ...removed.bi, status: 'ready', updated_at: now };
        pData.backlogItems.push(restoredBi);
        pData.backlogItems.sort((a, b) => a.order - b.order);
        await this.writeBacklogFile(p, pData);
        return;
      }
    }
    throw new Error(`SprintItem ${id} not found`);
  }

  async deleteSprintItemsBySprintId(sprintId: number): Promise<void> {
    for (const p of this.registry.projects) {
      const pData = await this.getProjectData(p);
      if (!pData.sprintItemsBySprintId.has(sprintId)) continue;
      const items = pData.sprintItemsBySprintId.get(sprintId) ?? [];
      const now = new Date().toISOString();

      // Return all backlog items to backlog.md
      for (const { bi } of items) {
        const restoredBi = { ...bi, status: 'ready', updated_at: now };
        if (!pData.backlogItems.find(b => b.id === bi.id)) {
          pData.backlogItems.push(restoredBi);
        }
      }
      pData.sprintItemsBySprintId.set(sprintId, []);
      await this.writeBacklogFile(p, pData);

      const sprint = pData.sprints.find(s => s.id === sprintId);
      if (sprint) {
        await this.writeSprintFile(p, sprint, []);
      }
      return;
    }
  }

  // ── Notifications ─────────────────────────────────────────

  async createNotification(data: {
    project_id: number;
    session_name: string;
    from_role?: string | null;
    message: string;
    urgency?: string;
  }): Promise<Notification> {
    const id = this.registry.nextNotificationId++;
    const n: Notification = {
      id,
      project_id: data.project_id,
      session_name: data.session_name,
      from_role: data.from_role ?? null,
      message: data.message,
      urgency: data.urgency ?? 'normal',
      read: false,
      created_at: new Date().toISOString(),
    };
    this.registry.notifications.unshift(n);
    // Keep last 200 notifications
    if (this.registry.notifications.length > 200) {
      this.registry.notifications = this.registry.notifications.slice(0, 200);
    }
    await this.saveRegistry();
    return n;
  }

  async listNotifications(projectId: number, unreadOnly?: boolean): Promise<Notification[]> {
    let ns = this.registry.notifications.filter(n => n.project_id === projectId);
    if (unreadOnly) ns = ns.filter(n => !n.read);
    return ns.slice(0, 50);
  }

  async markAllNotificationsRead(projectId: number): Promise<void> {
    let changed = false;
    for (const n of this.registry.notifications) {
      if (n.project_id === projectId && !n.read) {
        n.read = true;
        changed = true;
      }
    }
    if (changed) await this.saveRegistry();
  }

  // ── Dashboard ─────────────────────────────────────────────

  async getDashboard(projectId: number): Promise<DashboardData | null> {
    const p = this.registry.projects.find(pr => pr.id === projectId);
    if (!p) return null;

    const pData = await this.getProjectData(p);
    const allBiIds = new Set<number>();
    const boards: Record<string, Record<string, SprintItemWithBacklog[]>> = {};

    for (const sprint of pData.sprints) {
      const sid = String(sprint.id);
      boards[sid] = {};
      for (const col of BOARD_COLUMNS) boards[sid][col] = [];

      const items = pData.sprintItemsBySprintId.get(sprint.id) ?? [];
      for (const { si, bi } of items) {
        const col = BOARD_COLUMNS.includes(si.board_status) ? si.board_status : 'todo';
        boards[sid][col].push({ ...si, backlog_item: bi });
        allBiIds.add(bi.id);
      }
    }

    // All backlog items = backlog.md + embedded in sprint items
    const allBi = new Map<number, BacklogItem>();
    for (const bi of pData.backlogItems) allBi.set(bi.id, bi);
    for (const [, items] of pData.sprintItemsBySprintId) {
      for (const { bi } of items) {
        if (!allBi.has(bi.id)) allBi.set(bi.id, bi);
      }
    }

    return {
      project: {
        id: p.id,
        name: p.name,
        tmux_session_name: p.tmux_session_name,
        working_directory: p.working_directory,
        created_at: p.created_at,
      },
      sprints: pData.sprints,
      backlog: [...allBi.values()].sort((a, b) => a.order - b.order),
      boards,
    };
  }

  // ── File writers ──────────────────────────────────────────

  private async writeBacklogFile(p: Project, pData: ProjectData): Promise<void> {
    const content = serializeBacklogFile(p, pData.backlogItems);
    await fsp.mkdir(this.boardDir(p), { recursive: true });
    await writeAtomic(this.backlogFile(p), content);
    this.cache.set(p.id, pData);
  }

  private async writeSprintFile(
    p: Project,
    sprint: Sprint,
    items: Array<{ si: SprintItem; bi: BacklogItem }>
  ): Promise<void> {
    const filePath = this.sprintFile(p, sprint);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    const content = serializeSprintFile(p, { sprint, items });
    await writeAtomic(filePath, content);
  }
}
