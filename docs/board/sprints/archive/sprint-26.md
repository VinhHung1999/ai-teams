---

kanban-plugin: board

---

%% sprint-id: 74 %%
%% sprint-number: 26 %%
%% sprint-status: completed %%
%% goal: Thêm terminal vào trang File Manager (giống pattern project/assistant) %%
%% started: 2026-04-14T08:50:29.036Z %%
%% completed: 2026-04-16T08:28:58.754Z %%
%% project: ai-teams (id 14) %%

# Sprint 26 — Thêm terminal vào trang File Manager (giống pattern project/assistant)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[269]** Feature: Thêm terminal (AgentPaneView) vào trang File Manager
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 313
      **Description:**
      Thêm terminal ở dưới trang /files, giống pattern của trang project.

      Yêu cầu:
      1. **Terminal ở bottom** của trang /files — dùng AgentPaneView như trang project
      2. **Persistent tmux session** — tên "files", tạo nếu chưa có (dùng pattern ensure-session giống /assistant)
      3. **Drag resize** chiều cao — kéo lên/xuống, persist localStorage key "files-terminal-height"
      4. **Input gửi command** qua tm-send hoặc API /api/tmux/session/files/send
      5. **CWD**: terminal start ở home dir (giống /assistant). Optional: nếu Boss muốn sync theo path đang browse thì làm thêm sau.

      Implementation:
      - Backend: POST /api/files/ensure-terminal-session (hoặc reuse pattern ensure-session, đổi tên session)
      - Frontend: thêm AgentPaneView component vào /files page
      - Reuse drag resize logic từ trang project

      Acceptance Criteria:
      - Trang /files có terminal ở dưới
      - Kéo resize chiều cao được, persist
      - Tmux session "files" persistent
      - Input gửi command hoạt động
      - Layout clean, không break File Manager hiện tại

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
