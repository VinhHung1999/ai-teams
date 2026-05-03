---

kanban-plugin: board

---

%% sprint-id: 41 %%
%% sprint-number: 8 %%
%% sprint-status: completed %%
%% goal: Restore WS status text UI trong team panel %%
%% started: 2026-03-26T07:19:27.053Z %%
%% completed: 2026-03-26T07:20:27.207Z %%
%% project: ai-teams (id 14) %%

# Sprint 8 — Restore WS status text UI trong team panel

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[169]** Bug: Mất text hiển thị WS status (Connected/Connecting) trong team panel
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 207
      **Description:**
      Hồi trước AgentPaneView tự quản lý WS nên có hiện text trạng thái "Connected"/"Connecting"/"Disconnected". Sau refactor WS lên page level (useTmuxWs hook), UI text status bị mất, chỉ còn chấm nhỏ 1.5px khó thấy.

      Fix: Thêm lại text WS status vào team panel header, giống style cũ. Lấy tmuxWsStatus từ useTmuxWs hook.

      Acceptance Criteria:
      - Hiện text Connected/Connecting/Disconnected rõ ràng trong team panel
      - Style giống hồi trước (có màu + text)

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
