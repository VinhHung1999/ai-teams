---

kanban-plugin: board

---

%% sprint-id: 35 %%
%% sprint-number: 3 %%
%% sprint-status: completed %%
%% goal: Fix agent pane lag khi chuyển project (hybrid WS + cache) %%
%% started: 2026-03-26T06:07:54.635Z %%
%% completed: 2026-03-26T06:10:53.279Z %%
%% project: ai-teams (id 14) %%

# Sprint 3 — Fix agent pane lag khi chuyển project (hybrid WS + cache)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[161]** Bug: Agent pane lag/stale khi chuyển project lúc đang streaming
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 177
      **Description:**
      Khi agent đang streaming output và user chuyển sang project khác, output bị lag - vẫn hiện data team cũ.

      Approach: Hybrid WS architecture
      - 1 WS per project, nhưng chỉ project đang active mới poll
      - Cache last output per project trong state → switch thì hiện ngay từ cache
      - Khi switch: project mới resume poll, project cũ pause poll
      - Quay lại project cũ → hiện cached data ngay, rồi poll update sau

      Implementation:
      - Frontend: quản lý Map<projectId, {ws, lastOutput}> thay vì 1 WS dùng chung
      - Frontend: project đang xem → send subscribe với active=true, project cũ → active=false
      - Backend: khi nhận active=false → pause poll (clearInterval), active=true → resume
      - Hoặc đơn giản hơn: FE chỉ cần cache output per project, WS vẫn 1 cái nhưng clear + show cache khi switch

      Files: frontend/components/AgentPaneView.tsx, backend-node/src/routes/terminal.ts

      Acceptance Criteria:
      - Chuyển project → hiện cached output ngay, không lag
      - Chỉ 1 project poll tại 1 thời điểm (không tốn resource)
      - Quay lại project cũ cũng thấy data ngay từ cache
      - Data mới update trong vòng <500ms sau khi switch

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
