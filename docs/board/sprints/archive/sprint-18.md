---

kanban-plugin: board

---

%% sprint-id: 56 %%
%% sprint-number: 18 %%
%% sprint-status: completed %%
%% goal: Fix upload crash (webkitRelativePath read-only) %%
%% started: 2026-04-01T07:46:43.489Z %%
%% completed: 2026-04-01T07:48:11.397Z %%
%% project: ai-teams (id 14) %%

# Sprint 18 — Fix upload crash (webkitRelativePath read-only)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[208]** Bug: Upload file bị crash — Cannot set webkitRelativePath (read-only)
      **Priority:** P0 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 270
      **Description:**
      Drag & drop file thường vào upload zone bị lỗi: Cannot set property webkitRelativePath of File which has only a getter.

      Root cause: FileManager.tsx line 235 dùng Object.assign set webkitRelativePath lên File object nhưng property này read-only.

      Fix: Không set webkitRelativePath lên File. Thay bằng truyền relativePaths riêng qua FormData (đã có ở line 124). Hoặc wrap file trong object { file, relativePath } thay vì modify File trực tiếp.

      Acceptance Criteria:
      - Drag & drop file thường không crash
      - Drag & drop folder vẫn hoạt động, giữ cấu trúc
      - Upload qua nút cũng OK

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
