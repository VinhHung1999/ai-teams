---

kanban-plugin: board

---

%% sprint-id: 85 %%
%% sprint-number: 35 %%
%% sprint-status: completed %%
%% goal: Replace broken Python MCP server with thin Node MCP server (notify_boss + send_to_team_chat) %%
%% started: 2026-04-19T07:00:00.000Z %%
%% completed: 2026-04-19T07:55:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 35 — Node MCP server (replace broken Python)

**Context (Boss spec: "Làm đàng hoàng đi"):**
Python MCP server (`backend/app/mcp_server.py`) currently fails to boot because it tries to connect to Postgres `ai_teams` DB — but project migrated to markdown-only storage. `notify_boss` + `send_to_team_chat` tools are dead. Sprint 34 Telegram work can't be used end-to-end without these tools.

**Decision (proper fix, not patch):**
Build a thin Node MCP server in `backend-node/src/mcp/` that exposes ONLY the two HTTP-wrapping tools we actually use. No DB. Update `~/.claude.json` config to point to it. Retire the Python MCP server.

**Existing API endpoints (already work):**
- `POST /api/notifications` — push notification to dashboard + DM to Boss
- `POST /api/telegram/send` — send message to bound team Telegram group

**Scope OUT:**
- Migrating legacy board-CRUD MCP tools (get_board, update_task_status, etc.) — agents do MD-direct now, those are dead weight
- Backlog [343] parser hardening (separate item)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[305]** Standardize `[via Telegram]` handling rule across ALL Boss-facing prompts
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done
      **Description:**
      31 files updated (PO/TL/SM/CMO/ASSISTANT across all teams). Section inserted before "## Starting Your Role". _archive/ untouched. 31/31 verified. Commit 535366d.

- [x] **[304]** notify_boss smart-route → registered group; xoá send_to_team_chat
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done
      **Description:**
      sendTelegram() routes to project.telegram_chat_id when set, falls back to DM. send_to_team_chat removed from MCP + /api/telegram/send endpoint removed. PO_PROMPT.md updated. Commit e4392dd.

- [x] **[301]** Scaffold Node MCP server (stdio) in `backend-node/src/mcp/server.ts` + both tools
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done
      **Description:**
      @modelcontextprotocol/sdk@1.29.0 installed. server.ts: stdio MCP server exposing notify_boss + send_to_team_chat, both proxying to localhost:17070. tools/list verified, dist/mcp/server.js builds clean.

- [x] **[302]** Update `~/.claude.json` MCP config: switch `ai-teams` server from Python → Node
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done
      **Description:**
      Backed up ~/.claude.json. Switched ai-teams from uv/python → node dist/mcp/server.js.

- [x] **[303]** End-to-end smoke test from a fresh Claude Code session
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done
      **Description:**
      notify_boss stdio smoke test: returned "Notification sent to Boss" + dashboard notification confirmed created. send_to_team_chat pending Boss Telegram group bind (Sprint 34 smoke).

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
