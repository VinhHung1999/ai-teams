---

kanban-plugin: board

---

%% sprint-id: 44 %%
%% sprint-number: 11 %%
%% sprint-status: completed %%
%% goal: 1 WS per pane, 1 active at a time, keep cache %%
%% started: 2026-03-26T08:12:10.358Z %%
%% completed: 2026-03-26T08:20:21.190Z %%
%% project: ai-teams (id 14) %%

# Sprint 11 — 1 WS per pane, 1 active at a time, keep cache

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[172]** Refactor: 1 WS per pane, chỉ 1 active tại 1 thời điểm, giữ cache
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 210
      **Description:**
      Đổi từ 1 WS per project sang 1 WS per pane (role). Chỉ 1 WS actively polling tại 1 thời điểm.

      Architecture:
      - Mỗi role (PO, DEV, SM...) có 1 WS riêng connect tới /ws/tmux-pane
      - Chỉ role đang xem mới active poll (subscribe)
      - Switch role → pause WS cũ (unsubscribe), activate WS mới (subscribe)
      - Switch project → pause hết WS project cũ, activate WS project mới
      - Output cache giữ nguyên — KHÔNG clear khi switch, hiện cached data ngay
      - WS pool: Map<session:role, WS> thay vì Map<session, WS>

      Frontend: useTmuxWs hook quản lý WS pool per pane
      Backend: không đổi (đã hỗ trợ subscribe/unsubscribe per role)

      Acceptance Criteria:
      - Mỗi pane 1 WS connection
      - Chỉ 1 WS poll tại 1 thời điểm
      - Switch role/project = instant từ cache
      - Output cache không bị clear
      - Keepalive + rate limit giữ nguyên từ Sprint 10

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
