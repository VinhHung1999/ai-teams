---

kanban-plugin: board

---

%% sprint-id: 43 %%
%% sprint-number: 10 %%
%% sprint-status: completed %%
%% goal: Áp dụng battle-tested WS patterns từ AITeamController %%
%% started: 2026-03-26T07:55:19.916Z %%
%% completed: 2026-03-26T07:59:14.053Z %%
%% project: ai-teams (id 14) %%

# Sprint 10 — Áp dụng battle-tested WS patterns từ AITeamController

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[171]** Refactor: Áp dụng WS patterns từ AITeamController
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 209
      **Description:**
      Áp dụng battle-tested WS patterns từ AITeamController vào ai-teams.

      Cần thêm:
      1. Backend: MIN_SEND_INTERVAL 200ms — rate limit server-side, không gửi quá 5 msg/sec
      2. Backend + Frontend: 30s keepalive ping/pong — client gửi "ping", server trả "pong"
      3. Frontend: Ignore empty output khi reconnect — không clear content
      4. Backend: gửi isActive inline trong mỗi message {output, isActive} — không cần poll activity riêng
      5. Frontend: RAF batching cho rapid updates (đã có, verify)
      6. Frontend: onerror không set disconnected, chỉ onclose xử lý (tránh double state update flicker)

      Reference: /Users/hungphu/Documents/AI_Projects/AI-teams-controller/frontend/hooks/usePanePolling.ts
      Reference: /Users/hungphu/Documents/AI_Projects/AI-teams-controller/backend/app/api/routes.py (lines 181-299)

      Acceptance Criteria:
      - Server-side 200ms rate limit hoạt động
      - Keepalive 30s ping/pong
      - Không clear output khi reconnect
      - Activity indicator inline trong WS message
      - Không flicker khi error/reconnect

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
