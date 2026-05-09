---

kanban-plugin: board

---

%% sprint-id: 69 %%
%% sprint-number: 23 %%
%% sprint-status: completed %%
%% goal: Telegram bot mega upgrade: /status, /board, voice, /broadcast, daily summary, photo + UI upload %%
%% started: 2026-04-03T00:06:20.490Z %%
%% completed: 2026-04-03T00:12:09.744Z %%
%% project: ai-teams (id 14) %%

# Sprint 23 — Telegram bot mega upgrade: /status, /board, voice, /broadcast, daily summary, photo + UI upload

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[253]** Telegram bot: /status, /board, voice, /broadcast, daily summary, photo forward + UI upload image
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 295
      **Description:**
      6 features cho Telegram bot + 1 UI feature:

      1. /status — hiện tất cả team: session name, sprint hiện tại, số task (done/total), active/idle
      2. /board session_name — hiện kanban board trên Telegram (columns: todo, in_progress, in_review, testing, done với task titles)
      3. Voice message — Boss gửi voice note → transcribe (Whisper API hoặc Telegram getFile + speech-to-text) → forward text cho đúng team (dùng pending state hoặc reply)
      4. /broadcast message — gửi cho PO tất cả team cùng lúc. Confirm: 'Sent to X teams ✓'
      5. Daily summary — scheduled job cuối ngày (19:00) gửi tổng kết: mỗi team sprint status, tasks completed today, blockers
      6. Photo/file forward — Boss gửi hình/file (reply hoặc /team_name) → save vào project dir + forward path cho team. Bot download file từ Telegram API, lưu vào project working dir.

      7. UI: AgentInput thêm nút upload hình — click chọn/paste image → upload lên project dir → gửi path cho agent

      Acceptance Criteria:
      - /status hiện đúng tất cả team + sprint info
      - /board hiện kanban columns với task names
      - Voice → text → forward hoạt động
      - /broadcast gửi tất cả PO
      - Daily summary 19:00 tự động
      - Photo reply đúng team, file saved
      - UI có nút upload image bên cạnh input
      **Notes:**
      PO update: BỎ voice message (item 3). Chỉ còn 6 features: /status, /board, /broadcast, photo forward, daily summary, UI upload image.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
