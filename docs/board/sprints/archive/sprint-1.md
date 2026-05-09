---

kanban-plugin: board

---

%% sprint-id: 26 %%
%% sprint-number: 1 %%
%% sprint-status: completed %%
%% goal: Fix bugs (input focus, team tab reset) + Feature (git changes tab, kill team button) %%
%% started: 2026-03-25T21:12:43.682Z %%
%% completed: 2026-03-25T21:20:19.175Z %%
%% project: ai-teams (id 14) %%

# Sprint 1 — Fix bugs (input focus, team tab reset) + Feature (git changes tab, kill team button)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[125]** Bug: Input mất focus sau khi nhấn Enter
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 147
      **Description:**
      Khi user nhập text vào input field và nhấn Enter, input bị mất focus. User phải click lại vào input để tiếp tục gõ. Cần giữ focus trên input sau khi submit.

      Acceptance Criteria:
      - Sau khi nhấn Enter (submit), input field vẫn giữ focus
      - User có thể tiếp tục gõ ngay mà không cần click lại

- [x] **[126]** Bug: Team tab không reset về PO khi chuyển project
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 165
      **Description:**
      Khi user chuyển sang project khác, tab đang chọn trong phần Team vẫn giữ nguyên (ví dụ đang xem DEV) thay vì reset về PO (tab mặc định).

      Acceptance Criteria:
      - Khi chuyển project, team tab tự động reset về PO
      - Hoặc reset về tab đầu tiên có trong project mới

- [x] **[127]** Feature: Tab hiển thị git changes
      **Priority:** P2 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 148
      **Description:**
      Thêm tab "Git Changes" đặt kế bên tab "Files" hiện có. Tab này hiển thị git changes (git diff/status) để user xem thay đổi code trực tiếp trên giao diện.

      Acceptance Criteria:
      - Tab "Git Changes" nằm kế bên tab "Files" trong cùng tab group
      - Hiện danh sách files changed (added/modified/deleted)
      - Hiện diff content của từng file
      - UI consistent với tab Files hiện tại

- [x] **[128]** Feature: Nút Kill Team
      **Priority:** P2 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 164
      **Description:**
      Thêm nút để kill toàn bộ tmux team (stop tất cả agents trong session).

      Acceptance Criteria:
      - Có nút Kill Team trên UI
      - Click vào sẽ kill tmux session của team
      - Có confirmation dialog trước khi kill
      - UI cập nhật trạng thái sau khi kill

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
