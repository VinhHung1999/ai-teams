---

kanban-plugin: board

---

%% sprint-id: 38 %%
%% sprint-number: 6 %%
%% sprint-status: completed %%
%% goal: Activity via Board WS + Notification system (MCP notify_boss + bell + toast) %%
%% started: 2026-03-26T06:49:07.961Z %%
%% completed: 2026-03-26T06:59:56.822Z %%
%% project: ai-teams (id 14) %%

# Sprint 6 — Activity via Board WS + Notification system (MCP notify_boss + bell + toast)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[164]** Optimize: Activity check qua Board WS thay vì REST poll
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 204
      **Description:**
      Hiện tại activity poll mỗi 5s gọi REST /activity → backend chạy 7 exec commands (list-panes + 6x capture-pane). Rất tốn resource, gây lag khi có 6 roles.

      Fix: 
      - Bỏ REST endpoint /activity và frontend setInterval poll
      - Backend dùng 1 lệnh tmux list-panes -F "#{pane_index} #{@role_name} #{pane_last_activity}" để check activity (1 exec thay vì 7)
      - Push activity data qua Board WS đã có sẵn (đang dùng cho board updates)
      - Backend poll activity nhẹ (1 exec) mỗi 5s, push qua WS khi có thay đổi

      Files: 
      - backend-node/src/routes/tmux.ts (bỏ /activity endpoint)
      - backend-node/src/routes/board-ws.ts (thêm activity push)
      - frontend/app/project/page.tsx (nhận activity từ Board WS thay vì REST poll)

      Acceptance Criteria:
      - Không còn REST /activity poll
      - Activity check dùng 1 exec command thay vì 7
      - Activity data push qua Board WS
      - Activity indicators vẫn hoạt động đúng trên UI

- [x] **[165]** Feature: Notification system (MCP notify_boss + bell icon + browser toast)
      **Priority:** P2 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 205
      **Description:**
      Thêm notification system để Boss biết khi agent cần attention.

      Components:
      1. MCP tool notify_boss(session_name, message, urgency?) — agent gọi khi cần Boss review/decision
      2. Backend: lưu notification record + push qua Board WS
      3. Frontend: Bell icon góc trên header với badge đỏ (số unread)
      4. Frontend: Browser toast notification (Notification API)
      5. Update role prompts (PO_PROMPT.md, DEV_PROMPT.md) để agents biết gọi notify_boss khi:
         - Hoàn thành sprint
         - Cần Boss review/decision  
         - Bị block cần Boss input

      Files:
      - backend-node/src/routes/board-ws.ts (push notifications)
      - backend-node/prisma/schema.prisma (Notification model)
      - MCP server (thêm notify_boss tool)
      - frontend/app/project/page.tsx (bell icon + toast)
      - docs/tmux/ai-teams/prompts/PO_PROMPT.md (update)
      - docs/tmux/ai-teams/prompts/DEV_PROMPT.md (update)

      Acceptance Criteria:
      - Agent gọi notify_boss → Boss thấy bell badge + browser toast
      - Click bell → dropdown danh sách notifications
      - Mark as read
      - Prompts updated để agents biết dùng notify_boss

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
