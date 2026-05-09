---

kanban-plugin: board

---

%% sprint-id: 45 %%
%% sprint-number: 12 %%
%% sprint-status: completed %%
%% goal: Files tab hiển thị dotfiles/dotfolders (.claude, .git, etc.) %%
%% started: 2026-03-26T20:31:37.882Z %%
%% completed: 2026-03-26T20:32:59.673Z %%
%% project: ai-teams (id 14) %%

# Sprint 12 — Files tab hiển thị dotfiles/dotfolders (.claude, .git, etc.)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[178]** Feature: Files tab hiển thị thư mục ẩn (.claude, .git, etc.)
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 216
      **Description:**
      Hiện tại Files tab không hiển thị các thư mục/file ẩn (bắt đầu bằng dấu chấm). Cần show chúng để user xem được .claude, .env, .gitignore, etc.

      Acceptance Criteria:
      - Files tab hiển thị các thư mục/file ẩn (dotfiles/dotfolders)
      - .claude, .gitignore, .env, etc. đều xuất hiện trong file tree
      - Thứ tự sắp xếp hợp lý (dotfiles có thể ở đầu hoặc xen kẽ theo alphabet)
      - Không break existing file browsing functionality

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
