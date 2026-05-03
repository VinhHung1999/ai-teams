---

kanban-plugin: board

---

%% sprint-id: 86 %%
%% sprint-number: 36 %%
%% sprint-status: completed %%
%% goal: notify_boss outbound image support — agents share screenshots/mockups via Telegram %%
%% started: 2026-04-19T08:00:00.000Z %%
%% completed: 2026-04-19T08:15:00.000Z %%
%% project: ai-teams (id 14) %%

# Sprint 36 — notify_boss outbound image

**Context (Boss spec):**
Sprint 34 đã làm INBOUND image (Boss/collab gửi ảnh trong group → bot download → push path vào PO pane). Còn thiếu OUTBOUND: team không gửi được ảnh cho Boss (mockup, screenshot, design preview). PO/DEV chỉ có text qua `notify_boss`.

**Decision (Boss confirmed: "Làm cái này giúp tôi đi xong rồi update MCP"):**
Extend `notify_boss` thêm optional `image_path` — KHÔNG tạo tool mới (giữ nguyên tắc "1 tool, smart-route" từ Sprint 35).

**Defaults (suy luận từ Boss greenlight, không hỏi lại):**
- `image_path` = absolute local path trên máy backend đọc được
- 1 ảnh / call (multiple images → backlog nếu cần sau)
- Image only (PDF/document → backlog nếu cần)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[306]** Extend `notify_boss` với optional `image_path` + backend sendPhoto branch
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done
      **Description:**
      MCP schema: image_path optional added. Backend: file existence + 10MB validation → 400 early; sendPhoto multipart/form-data; text fallback on error. Dashboard notification always created. Smoke: love_scrum ✓, missing file 400 ✓, text-only ✓. Commit 21be1d7.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
