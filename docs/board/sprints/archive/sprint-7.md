---

kanban-plugin: board

---

%% sprint-id: 39 %%
%% sprint-number: 7 %%
%% sprint-status: completed %%
%% goal: Fix activity detection (hash capture-pane + Board WS) %%
%% started: 2026-03-26T07:08:20.320Z %%
%% completed: 2026-03-26T07:09:50.041Z %%
%% project: ai-teams (id 14) %%

# Sprint 7 — Fix activity detection (hash capture-pane + Board WS)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[166]** Fix: Activity detection quay lại hash capture-pane, giữ Board WS push
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 206
      **Description:**
      pane_last_activity không detect activity đúng. Quay lại logic hash capture-pane cũ nhưng giữ Board WS push (không dùng REST poll).

      Fix:
      - Board WS pollActivity: chạy capture-pane -S -5 cho tất cả roles (Promise.all, song song)
      - Hash output mỗi role, so sánh với hash trước → detect activity
      - Push {type: activity} qua Board WS khi có thay đổi
      - Bỏ logic pane_last_activity

      Files: backend-node/src/routes/board-ws.ts (pollActivity function)

      Acceptance Criteria:
      - Activity indicator (nút xanh) hoạt động đúng
      - Dùng hash capture-pane logic
      - Push qua Board WS (không REST poll)

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
