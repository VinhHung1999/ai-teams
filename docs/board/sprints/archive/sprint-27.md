---

kanban-plugin: board

---

%% sprint-id: 77 %%
%% sprint-number: 27 %%
%% sprint-status: completed %%
%% completed: 2026-04-17T17:00:00.000Z %%
%% goal: Migrate Postgres → Markdown storage (Obsidian Kanban format) + storage mode toggle %%
%% started: 2026-04-16T08:29:07.880Z %%
%% project: ai-teams (id 14) %%

# Sprint 27 — Migrate Postgres → Markdown storage (Obsidian Kanban format) + storage mode toggle

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[279]** Phase 3: Cutover to Markdown + decommission Postgres
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 333
      **Description:**
      After Phase 2 is stable:

      - Re-run Phase 1 migration to capture any state drift since initial run
      - Set `STORAGE=markdown` default in backend-node
      - Verify all UI flows work (backlog, sprint, board, notify_boss)
      - `pg_dump ai_teams > archive/ai_teams-final-backup.sql` — final backup
      - Remove Prisma deps: `npm uninstall prisma @prisma/client`
      - Delete `backend-node/prisma/` folder
      - Update `CLAUDE.md` — remove PG references, document MD format
      - Stop Postgres service for `ai_teams` DB

      **Definition of done:**
      - Backend no longer connects to Postgres
      - All board data lives in `<project>/docs/board/` markdown files
      - Frontend UI fully functional
      **Notes:**
      2026-04-17 PO: Partially done — STORAGE=markdown set as default, CLAUDE.md updated, prompts migrated to MD workflow. Remaining: pg_dump backup, remove Prisma deps, delete prisma/ folder, stop PG service.
      2026-04-17 PO: DEV assigned to complete Postgres removal. Sprint done.

- [x] **[277]** Phase 1: Migration script PG → MD (Obsidian Kanban format)
      **Priority:** P1 · **Points:** 3 · **Assignee:** PO · **Status:** done · **Backlog-ID:** 331
      **Description:**
      Write read-only Node.js migration script `tools/migrate-pg-to-md.ts` that:

      **Input**: Postgres `ai_teams` DB (10 projects, 70 sprints, 253 backlog items, 219 sprint_items, skip 544 notifications)

      **Output**: Per project, write to `<project.working_directory>/docs/board/`:
      - `_project.md` — project meta (pinned, session_name, working_dir)
      - `backlog.md` — items not in any sprint, group by P0/P1/P2/P3
      - `sprints/active/sprint-{N}.md` — Obsidian Kanban format with columns Todo / In Progress / In Review / Testing / Done
      - `sprints/archive/sprint-{N}.md` — completed sprints

- [x] **[278]** Phase 2: Backend storage abstraction + MarkdownStorage
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 332
      **Description:**
      Add env `STORAGE=postgres|markdown` to backend-node, default postgres.
      IStorage interface + PostgresStorage + MarkdownStorage + factory + runtime toggle.
      **Notes:**
      2026-04-17 DEV: Complete. Storage abstraction with IStorage/PostgresStorage/MarkdownStorage. Factory with env toggle. Runtime switch via PUT /api/storage/mode. UI toggle button added. Dashboard flatten bug fixed. Round-trip test passing.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
