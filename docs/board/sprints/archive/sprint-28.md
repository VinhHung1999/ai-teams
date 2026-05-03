---

kanban-plugin: board

---

%% sprint-id: 78 %%
%% sprint-number: 28 %%
%% sprint-status: completed %%
%% completed: 2026-04-17T10:30:00.000Z %%
%% goal: Realtime board updates via file watcher %%
%% started: 2026-04-17T10:15:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 28 — Realtime board updates via file watcher

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[281]** Download file/folder button
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done
      **Acceptance:**
      - [x] Click download trên file → browser tải file về
      - [x] Click download trên folder → browser tải zip về
      - [x] Hiển thị loading state khi đang zip folder lớn
      **Notes:**
      2026-04-17 DEV: Backend /api/files/download extended to handle both files (stream) and dirs (archiver zip). Frontend: Download button added to dir nodes in FileManager tree. Toast "Preparing zip..." shown before folder download. Both builds clean, API tested (200 + Content-Type: application/zip for folder).

- [x] **[280]** File watcher for realtime board updates
      **Priority:** P1 · **Points:** 5 · **Assignee:** DEV · **Status:** done
      **Description:**
      Khi agent hoặc Obsidian edit MD files trong `docs/board/`, dashboard phải tự cập nhật realtime qua WebSocket.

      **Approach:**
      - Dùng `chokidar` (hoặc `fs.watch`) watch `docs/board/` folder recursively
      - Khi file thay đổi (backlog.md, sprint-*.md), parse xem thuộc project nào
      - Push WebSocket update cho project đó (reuse existing `pushToProject()` trong board-ws.ts)
      - Debounce để tránh spam khi file đang được write

      **Scope:**
      - Watch: `docs/board/backlog.md`, `docs/board/sprints/active/*.md`, `docs/board/sprints/archive/*.md`
      - Trigger: file change, file create, file delete, file move
      - Action: re-read board data → push via WebSocket to subscribed clients

      **Acceptance:**
      - [x] Edit sprint MD file → dashboard updates within 1-2 seconds without page reload
      - [x] Move sprint file to archive → dashboard reflects completion
      - [x] Edit backlog.md → backlog view updates
      - [x] No duplicate/spam pushes (debounced)
      - [x] Works when agents edit via Claude Code Read/Edit tools
      **Notes:**
      2026-04-17 DEV: board-file-watcher.ts with chokidar v5. Watches 10 project board dirs. awaitWriteFinish:150ms + onBoardChange debounce:300ms. Tested: touch sprint-28.md → "Change detected in project 14" in logs. Build clean, PM2 running.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
