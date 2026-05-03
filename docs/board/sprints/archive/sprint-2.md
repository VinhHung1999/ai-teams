---

kanban-plugin: board

---

%% sprint-id: 28 %%
%% sprint-number: 2 %%
%% sprint-status: completed %%
%% goal: Fix input focus bug (P0) %%
%% started: 2026-03-25T21:31:46.094Z %%
%% completed: 2026-03-25T21:32:42.114Z %%
%% project: ai-teams (id 14) %%

# Sprint 2 — Fix input focus bug (P0)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[134]** Bug: Input vẫn mất focus sau khi gửi message (chưa fix xong)
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 176
      **Description:**
      Input textarea vẫn mất focus sau khi nhấn Enter/Send. Root cause: textarea có disabled={isPending}, khi setIsPending(false) + focus() trong setTimeout(500ms) có thể bị race condition - browser chưa kịp enable lại textarea thì focus() đã chạy.

      Fix approach: 
      - Dùng useEffect watch isPending chuyển từ true→false thì focus
      - Hoặc requestAnimationFrame sau setIsPending(false) rồi mới focus
      - Đảm bảo focus hoạt động trên cả desktop và mobile

      Acceptance Criteria:
      - Sau khi gửi message, input tự động focus lại
      - Hoạt động trên cả desktop và mobile
      - User có thể gõ tiếp ngay mà không cần click lại

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
