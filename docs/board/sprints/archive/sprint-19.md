---

kanban-plugin: board

---

%% sprint-id: 59 %%
%% sprint-number: 19 %%
%% sprint-status: completed %%
%% goal: Implement Boss-to-Agent messaging + keyboard (Enter, Ctrl+C, Shift+Tab) %%
%% started: 2026-04-01T20:11:28.121Z %%
%% completed: 2026-04-01T20:14:57.998Z %%
%% project: ai-teams (id 14) %%

# Sprint 19 — Implement Boss-to-Agent messaging + keyboard (Enter, Ctrl+C, Shift+Tab)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[224]** Bug: Boss-to-Agent messaging chưa implement (chỉ console.log) + keyboard fixes
      **Priority:** P0 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 278
      **Description:**
      AgentInput component (project/page.tsx line 769-776):
      - handleSend chỉ console.log, KHÔNG gửi message thật tới agent
      - Cần gọi API backend để tm-send message tới đúng role/pane

      Cần implement:
      1. Backend API: POST /api/tmux/send — nhận {sessionName, role, message}, chạy tm-send
      2. Frontend: handleSend gọi API thay vì console.log
      3. Enter → gửi message
      4. Ctrl+C → gửi Ctrl+C tới agent pane (interrupt)
      5. Shift+Tab: prevent browser default tab navigation trong input

      Acceptance Criteria:
      - Gõ message + Enter → gửi thật tới agent pane
      - Agent nhận được message từ Boss
      - Ctrl+C trong input → gửi interrupt signal tới agent
      - Shift+Tab không nhảy ra ngoài input
      - Input clear sau khi gửi

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
