---

kanban-plugin: board

---

%% sprint-id: 84 %%
%% sprint-number: 34 %%
%% sprint-status: completed %%
%% goal: Telegram team channels — multi-person, image-capable, conversational PO bridge %%
%% started: 2026-04-19T02:05:00.000Z %%
%% completed: 2026-04-19T07:55:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 34 — Telegram team channels — multi-person, image-capable, conversational PO bridge

**Context (Boss spec):**
Boss + collaborators muốn chat với PO của từng team trong **Telegram group riêng** — feel như "PO là 1 người trong group", không phải notification bot. Mỗi team 1 group. Gửi được ảnh. Bot tự pick tên người gửi (Telegram first_name) cho prefix.

**Decisions (Boss confirmed a/a/a):**
- 1 bot chung cho tất cả teams (route bằng chat_id)
- `/register <team-name>` slash command bind group → team
- Auto sender attribution từ `from.first_name` / `username` — zero manual setup khi invite người mới

**Scope OUT:**
- Chat trực tiếp với DEV/BE/QA (chỉ PO bridge cho Sprint 34) — backlog if needed
- `/setname` override display name — backlog P2 if recurs
- Bot tự reply (LLM) khi PO chưa rep — out, PO là người drive

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[296]** Bot listen Telegram groups + route message by `chat_id` → project (PO pane)
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 344
      **Description:**
      Group/supergroup messages bypass ALLOWED_CHAT_ID gate → routed by telegram_chat_id → project → PO pane. DM flow untouched.

- [x] **[297]** Image receipt — Telegram photo → download → push vào PO pane
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 345
      **Description:**
      Group photo/document → downloaded to uploads/telegram/<chat_id>/ → forwarded as [via Telegram] Sender [image]: path.

- [x] **[298]** Multi-sender attribution — auto pick `first_name` / `username`, prefix `[Name]:`
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 346
      **Description:**
      getSenderName() extracts first_name ?? username ?? user_<id>. DM path keeps BOSS:.

- [x] **[299]** Reply tool `send_to_team_chat(team, message)` — PO post lại group, conversational
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 347
      **Description:**
      sendToGroupChat() in telegram-bot.ts + POST /api/telegram/send + send_to_team_chat MCP tool in mcp_server.py.

- [x] **[300]** `/register <team-name>` slash command — bind chat_id ↔ team trong registry
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 348
      **Description:**
      /register <name> in group → lookup project by name/session → updateProjectTelegramChatId → persisted to registry.json → reply confirmation.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
