---

kanban-plugin: board

---

%% sprint-id: 66 %%
%% sprint-number: 21 %%
%% sprint-status: completed %%
%% goal: notify_boss gửi Telegram bot %%
%% started: 2026-04-02T21:44:42.656Z %%
%% completed: 2026-04-02T21:50:26.794Z %%
%% project: ai-teams (id 14) %%

# Sprint 21 — notify_boss gửi Telegram bot

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[248]** Feature: notify_boss gửi Telegram + env config
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 290
      **Description:**
      Khi notify_boss được gọi, ngoài push qua Board WS (UI), gửi thêm lên Telegram bot.

      Config:
      - TELEGRAM_BOT_TOKEN=8455437190:AAGiJcF2lcamlMq0URhDY4yvm6xX0Bf3YWY
      - TELEGRAM_CHAT_ID=6189969956

      Implementation:
      1. Backend Node.js: POST /api/notifications — sau khi push WS, gọi thêm Telegram sendMessage API
      2. Format message đẹp: emoji theo urgency, from_role, session_name, message
      3. Env: thêm TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID vào backend-node/.env
      4. setup.sh: thêm prompt Telegram config (optional)
      5. Nếu không có token → skip Telegram, chỉ push WS như cũ

      Acceptance Criteria:
      - notify_boss → nhận trên cả UI (bell) lẫn Telegram
      - Message format đẹp trên Telegram
      - Không có token → vẫn hoạt động bình thường (chỉ UI)
      - setup.sh hỏi Telegram config (optional)

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
