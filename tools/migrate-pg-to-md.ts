#!/usr/bin/env tsx
/**
 * Migrate Postgres ai_teams → Markdown (Obsidian Kanban format).
 * Read-only on Postgres. Idempotent (safe to re-run).
 *
 * Usage:
 *   tsx tools/migrate-pg-to-md.ts               # migrate all projects
 *   tsx tools/migrate-pg-to-md.ts --dry         # list counts, don't write
 *   tsx tools/migrate-pg-to-md.ts --only=ai_teams  # one project (by session_name or name)
 *   tsx tools/migrate-pg-to-md.ts --verify      # count PG vs MD, assert equal
 */
import { Client } from "pg";
import * as fs from "fs/promises";
import * as path from "path";

const PG_URL = "postgresql://hungphu@localhost:5432/ai_teams";

const STATUS_COLUMNS = [
  { key: "todo", title: "📋 Todo" },
  { key: "in_progress", title: "🔨 In Progress" },
  { key: "in_review", title: "👀 In Review" },
  { key: "testing", title: "🧪 Testing" },
  { key: "done", title: "✅ Done" },
];

const PRIORITY_TITLES: Record<string, string> = {
  P0: "🔴 P0: Critical",
  P1: "🟠 P1: High",
  P2: "🟡 P2: Medium",
  P3: "⚪ P3: Low",
};
const PRIORITIES = ["P0", "P1", "P2", "P3"];

interface Project {
  id: number;
  name: string;
  tmux_session_name: string | null;
  working_directory: string | null;
  pinned: boolean;
}
interface BacklogItem {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  priority: string;
  story_points: number | null;
  acceptance_criteria: unknown;
  status: string;
  order: number;
  created_at: Date;
  updated_at: Date;
}
interface Sprint {
  id: number;
  project_id: number;
  number: number;
  goal: string | null;
  status: string;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}
interface SprintItem {
  id: number;
  sprint_id: number;
  backlog_item_id: number;
  assignee_role: string | null;
  board_status: string;
  order: number;
  notes: string | null;
  updated_at: Date;
}

function indent(text: string, spaces = 6): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => (l.length ? pad + l : l))
    .join("\n");
}

function parseAcceptance(raw: unknown): Array<{ text: string; done: boolean }> {
  if (!raw) return [];
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.criteria)) arr = obj.criteria;
    else if (Array.isArray(obj.items)) arr = obj.items;
    else return [];
  } else return [];
  return arr
    .map((c) => {
      if (typeof c === "string") return { text: c, done: false };
      if (typeof c === "object" && c !== null) {
        const o = c as Record<string, unknown>;
        const text = String(o.text ?? o.title ?? o.criterion ?? "").trim();
        const done = Boolean(o.done ?? o.checked ?? o.completed);
        return text ? { text, done } : null;
      }
      return null;
    })
    .filter(Boolean) as Array<{ text: string; done: boolean }>;
}

function cardText(siId: number, bi: BacklogItem, si: SprintItem | null): string {
  const isDone =
    si?.board_status === "done" || (!si && bi.status === "done");
  const checkbox = isDone ? "x" : " ";
  const lines: string[] = [];
  lines.push(`- [${checkbox}] **[${siId}]** ${bi.title.replace(/\n/g, " ")}`);

  const metaParts = [
    `**Priority:** ${bi.priority}`,
    bi.story_points != null ? `**Points:** ${bi.story_points}` : null,
    si?.assignee_role ? `**Assignee:** ${si.assignee_role}` : null,
    si?.board_status ? `**Status:** ${si.board_status}` : null,
    `**Backlog-ID:** ${bi.id}`,
  ].filter(Boolean);
  lines.push(indent(metaParts.join(" · ")));

  if (bi.description && bi.description.trim()) {
    lines.push(indent("**Description:**"));
    lines.push(indent(bi.description.trim()));
  }

  const ac = parseAcceptance(bi.acceptance_criteria);
  if (ac.length > 0) {
    lines.push(indent("**Acceptance:**"));
    for (const c of ac) {
      lines.push(indent(`- [${c.done ? "x" : " "}] ${c.text}`));
    }
  }

  if (si?.notes && si.notes.trim()) {
    lines.push(indent("**Notes:**"));
    lines.push(indent(si.notes.trim()));
  }

  return lines.join("\n");
}

function sprintMd(
  project: Project,
  sprint: Sprint,
  items: Array<{ si: SprintItem; bi: BacklogItem }>
): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("");
  lines.push("kanban-plugin: board");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`%% sprint-id: ${sprint.id} %%`);
  lines.push(`%% sprint-number: ${sprint.number} %%`);
  lines.push(`%% sprint-status: ${sprint.status} %%`);
  if (sprint.goal) lines.push(`%% goal: ${sprint.goal.replace(/\n/g, " ")} %%`);
  if (sprint.started_at)
    lines.push(`%% started: ${sprint.started_at.toISOString()} %%`);
  if (sprint.completed_at)
    lines.push(`%% completed: ${sprint.completed_at.toISOString()} %%`);
  lines.push(`%% project: ${project.name} (id ${project.id}) %%`);
  lines.push("");
  lines.push(
    `# Sprint ${sprint.number}${sprint.goal ? ` — ${sprint.goal.replace(/\n/g, " ")}` : ""}`
  );
  lines.push("");

  for (const col of STATUS_COLUMNS) {
    lines.push(`## ${col.title}`);
    lines.push("");
    const inCol = items.filter(({ si }) => si.board_status === col.key);
    inCol.sort((a, b) => a.si.order - b.si.order || a.si.id - b.si.id);
    for (const { si, bi } of inCol) {
      lines.push(cardText(si.id, bi, si));
      lines.push("");
    }
  }

  lines.push("%% kanban:settings");
  lines.push("```");
  lines.push(
    '{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}'
  );
  lines.push("```");
  lines.push("%%");
  lines.push("");
  return lines.join("\n");
}

function backlogMd(project: Project, items: BacklogItem[]): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("");
  lines.push("kanban-plugin: board");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(`%% project: ${project.name} (id ${project.id}) %%`);
  lines.push(`%% kind: product-backlog %%`);
  lines.push("");
  lines.push(`# Product Backlog — ${project.name}`);
  lines.push("");

  for (const p of PRIORITIES) {
    lines.push(`## ${PRIORITY_TITLES[p]}`);
    lines.push("");
    const inP = items
      .filter((i) => i.priority === p)
      .sort((a, b) => a.order - b.order || a.id - b.id);
    for (const bi of inP) {
      lines.push(cardText(bi.id, bi, null));
      lines.push("");
    }
  }

  lines.push("%% kanban:settings");
  lines.push("```");
  lines.push(
    '{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}'
  );
  lines.push("```");
  lines.push("%%");
  lines.push("");
  return lines.join("\n");
}

function projectMd(p: Project): string {
  return `# Project: ${p.name}

| Field | Value |
|---|---|
| ID | ${p.id} |
| Tmux session | ${p.tmux_session_name ?? "(none)"} |
| Working directory | ${p.working_directory ?? "(none)"} |
| Pinned | ${p.pinned ? "✅" : "❌"} |

## Board files

- [[backlog]] — product backlog
- Active sprints: \`sprints/active/\`
- Archived sprints: \`sprints/archive/\`
`;
}

async function loadProjectData(client: Client, p: Project) {
  const { rows: backlog } = await client.query<BacklogItem>(
    `SELECT * FROM backlog_items WHERE project_id=$1 ORDER BY "order", id`,
    [p.id]
  );
  const { rows: sprints } = await client.query<Sprint>(
    "SELECT * FROM sprints WHERE project_id=$1 ORDER BY number",
    [p.id]
  );
  const sprintIds = sprints.map((s) => s.id);
  const { rows: sprintItemsAll } =
    sprintIds.length > 0
      ? await client.query<SprintItem>(
          `SELECT * FROM sprint_items WHERE sprint_id = ANY($1) ORDER BY sprint_id, "order", id`,
          [sprintIds]
        )
      : { rows: [] as SprintItem[] };
  return { backlog, sprints, sprintItemsAll };
}

async function migrate(
  client: Client,
  projects: Project[],
  opts: { dry: boolean; only: string | null }
) {
  let itemsWritten = 0;
  let sprintsWritten = 0;
  let filesWritten = 0;

  for (const p of projects) {
    if (opts.only && p.tmux_session_name !== opts.only && p.name !== opts.only)
      continue;
    if (!p.working_directory) {
      console.warn(`  SKIP ${p.name} (id ${p.id}): no working_directory`);
      continue;
    }

    const { backlog, sprints, sprintItemsAll } = await loadProjectData(
      client,
      p
    );
    const biById = new Map(backlog.map((bi) => [bi.id, bi]));
    const siBySprintId = new Map<number, SprintItem[]>();
    for (const si of sprintItemsAll) {
      const arr = siBySprintId.get(si.sprint_id) ?? [];
      arr.push(si);
      siBySprintId.set(si.sprint_id, arr);
    }
    const assignedBiIds = new Set(sprintItemsAll.map((si) => si.backlog_item_id));
    const unassignedBacklog = backlog.filter((bi) => !assignedBiIds.has(bi.id));

    console.log(
      `  ${p.name} (id ${p.id}): ${backlog.length} items, ${sprints.length} sprints, ${sprintItemsAll.length} assigned, ${unassignedBacklog.length} in backlog`
    );

    if (opts.dry) continue;

    const boardDir = path.join(p.working_directory, "docs", "board");
    const activeDir = path.join(boardDir, "sprints", "active");
    const archiveDir = path.join(boardDir, "sprints", "archive");
    await fs.mkdir(activeDir, { recursive: true });
    await fs.mkdir(archiveDir, { recursive: true });

    await fs.writeFile(path.join(boardDir, "_project.md"), projectMd(p));
    await fs.writeFile(
      path.join(boardDir, "backlog.md"),
      backlogMd(p, unassignedBacklog)
    );
    filesWritten += 2;

    // Remove stale sprint files (for idempotency)
    for (const dir of [activeDir, archiveDir]) {
      const existing = await fs.readdir(dir).catch(() => []);
      for (const f of existing) {
        if (f.startsWith("sprint-") && f.endsWith(".md")) {
          await fs.unlink(path.join(dir, f));
        }
      }
    }

    for (const s of sprints) {
      const items = (siBySprintId.get(s.id) ?? [])
        .map((si) => ({ si, bi: biById.get(si.backlog_item_id)! }))
        .filter((x) => x.bi);
      const md = sprintMd(p, s, items);
      const targetDir = s.status === "active" ? activeDir : archiveDir;
      const file = path.join(targetDir, `sprint-${s.number}.md`);
      await fs.writeFile(file, md);
      sprintsWritten++;
      filesWritten++;
    }
    itemsWritten += backlog.length;
  }

  console.log(
    `\nMigration summary: ${filesWritten} files, ${itemsWritten} items, ${sprintsWritten} sprints`
  );
}

async function verify(client: Client, projects: Project[]) {
  let ok = true;
  let pgSprintItemsTotal = 0;
  let mdCheckboxTotal = 0;
  let pgBacklogOnly = 0;
  let mdBacklogOnly = 0;

  for (const p of projects) {
    if (!p.working_directory) continue;
    const { backlog, sprints, sprintItemsAll } = await loadProjectData(
      client,
      p
    );
    const assignedBiIds = new Set(sprintItemsAll.map((si) => si.backlog_item_id));
    const unassignedPg = backlog.filter((bi) => !assignedBiIds.has(bi.id)).length;

    const boardDir = path.join(p.working_directory, "docs", "board");
    const backlogFile = path.join(boardDir, "backlog.md");
    const activeDir = path.join(boardDir, "sprints", "active");
    const archiveDir = path.join(boardDir, "sprints", "archive");

    const backlogContent = await fs
      .readFile(backlogFile, "utf-8")
      .catch(() => "");
    const backlogCount = countCards(backlogContent);

    let sprintCardsCount = 0;
    let sprintFilesCount = 0;
    for (const dir of [activeDir, archiveDir]) {
      const files = await fs.readdir(dir).catch(() => []);
      for (const f of files) {
        if (f.startsWith("sprint-") && f.endsWith(".md")) {
          const content = await fs.readFile(path.join(dir, f), "utf-8");
          sprintCardsCount += countCards(content);
          sprintFilesCount++;
        }
      }
    }

    const projectOk =
      unassignedPg === backlogCount &&
      sprintItemsAll.length === sprintCardsCount &&
      sprintFilesCount === sprints.length;
    const mark = projectOk ? "✅" : "❌";
    console.log(
      `  ${mark} ${p.name}: backlog PG=${unassignedPg} MD=${backlogCount} · sprint_items PG=${sprintItemsAll.length} MD=${sprintCardsCount} · sprint_files PG=${sprints.length} MD=${sprintFilesCount}`
    );
    if (!projectOk) ok = false;
    pgSprintItemsTotal += sprintItemsAll.length;
    mdCheckboxTotal += sprintCardsCount;
    pgBacklogOnly += unassignedPg;
    mdBacklogOnly += backlogCount;
  }

  console.log(
    `\nTotals: sprint_items PG=${pgSprintItemsTotal} MD=${mdCheckboxTotal} · backlog PG=${pgBacklogOnly} MD=${mdBacklogOnly}`
  );
  return ok;
}

// Count top-level `- [ ]` / `- [x]` cards (not indented acceptance sub-checkboxes).
function countCards(md: string): number {
  const lines = md.split("\n");
  let count = 0;
  for (const l of lines) {
    // Match "- [ ]" or "- [x]" at start of line (no leading whitespace)
    if (/^- \[[ x]\] \*\*\[\d+\]\*\*/.test(l)) count++;
  }
  return count;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const verifyMode = args.includes("--verify");
  const only =
    args.find((a) => a.startsWith("--only="))?.split("=")[1] ?? null;

  const client = new Client({ connectionString: PG_URL });
  await client.connect();
  try {
    const { rows: projects } = await client.query<Project>(
      "SELECT id, name, tmux_session_name, working_directory, pinned FROM projects ORDER BY id"
    );
    console.log(`Loaded ${projects.length} projects from PG\n`);

    if (verifyMode) {
      const ok = await verify(client, projects);
      process.exit(ok ? 0 : 1);
    } else {
      await migrate(client, projects, { dry, only });
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
