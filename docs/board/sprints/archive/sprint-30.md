---

kanban-plugin: board

---

%% sprint-id: 80 %%
%% sprint-number: 30 %%
%% sprint-status: completed %%
%% completed: 2026-04-17T12:20:00.000Z %%
%% goal: Project list from tmux + local registry (no database) %%
%% started: 2026-04-17T11:00:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 30 — Project list from tmux + local registry (no database)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[283]** Replace project storage with tmux + local registry
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done
      **Acceptance:**
      - [x] Project list comes from registry + tmux, not from _project.md or database
      - [x] New tmux team session auto-registers into registry
      - [x] Dashboard shows running/stopped status per project
      - [x] Can view board of stopped projects (reads MD files from working_directory)
      - [x] No more _project.md dependency
      **Notes:**
      2026-04-17 DEV: GET /api/projects now calls tmux list-sessions once (O(1) subprocess), merges running status into each project as tmux_active. Auto-registers unknown AI team sessions (detects via @role_name pane options). Frontend: green/gray status dot on project avatar. API verified: 12 projects, correct tmux_active values. Build clean, PM2 running.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
