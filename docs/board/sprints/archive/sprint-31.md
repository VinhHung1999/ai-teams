---

kanban-plugin: board

---

%% sprint-id: 81 %%
%% sprint-number: 31 %%
%% sprint-status: completed %%
%% completed: 2026-04-17T14:32:00.000Z %%
%% goal: Switch team creation from tmux-team-creator-mcp to tmux-team-creator-md %%
%% started: 2026-04-17T14:00:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 31 — Switch team creation to tmux-team-creator-md

## 📋 Todo

## 🔨 In Progress


## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[285]** Move memory from .claude/memory/ to memory/ for all projects
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done
      **Description:**
      15/15 projects migrated. memory/ at root, .claude/memory/ removed, settings.local.json updated.

- [x] **[284]** Replace tmux-team-creator-mcp refs with tmux-team-creator-md
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done
      **Description:**
      Full MCP cleanup: 3 frontend refs → tmux-team-creator-md; deleted skills/tmux-team-creator-mcp/;
      cleaned settings.local.json; updated README.md (no Postgres/MCP server); updated .claude/memory/
      architecture + team docs. notify_boss retained. Build clean.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
