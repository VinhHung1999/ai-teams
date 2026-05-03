---

kanban-plugin: board

---

%% sprint-id: 1079 %%
%% sprint-number: 29 %%
%% sprint-status: completed %%
%% completed: 2026-04-17T10:55:00.000Z %%
%% goal: Migrate all remaining teams from MCP to MD board format %%
%% started: 2026-04-17T10:35:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 29 — Migrate all remaining teams from MCP to MD board format

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[282]** Migrate all team prompts + workflows from MCP → MD
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done
      **Acceptance:**
      - [x] All 9 teams have zero MCP board tool references in prompts (except notify_boss)
      - [x] All prompts reference docs/board/ MD files for board operations
      - [x] All workflow.md files updated with MD board management section
      - [x] grep confirms no remaining get_board/update_task_status/create_sprint references
      **Notes:**
      2026-04-17 DEV: 32 files updated across 8 repos (assistant had no MCP refs). 2 remaining matches are archival SM log files (MIGRATION_CHECKLIST.md, IMPROVEMENT_BACKLOG.md) — not agent instruction files. All 8 repos committed.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
