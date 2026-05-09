---

kanban-plugin: board

---

%% sprint-id: 62 %%
%% sprint-number: 20 %%
%% sprint-status: completed %%
%% goal: Pin project lên đầu danh sách %%
%% started: 2026-04-02T02:16:26.542Z %%
%% completed: 2026-04-02T02:20:07.175Z %%
%% project: ai-teams (id 14) %%

# Sprint 20 — Pin project lên đầu danh sách

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[237]** Feature: Pin project để đưa lên đầu danh sách
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 283
      **Description:**
      Danh sách project bắt đầu nhiều, cần pin project đang làm lên đầu.

      Cần:
      1. DB: thêm field `pinned` (boolean, default false) vào Project model
      2. Backend: API toggle pin (PATCH /api/projects/:id/pin)
      3. Backend: GET /api/projects sort pinned trước, rồi mới theo tên/date
      4. Frontend: Icon pin trên mỗi project card, click toggle
      5. Pinned projects hiển thị ở đầu danh sách với visual indicator (icon pin hoặc border highlight)

      Acceptance Criteria:
      - Click pin → project lên đầu danh sách
      - Click unpin → project về vị trí bình thường
      - Pinned projects có visual indicator rõ ràng
      - Sort: pinned first, rồi theo thứ tự cũ
      - Persist qua reload (lưu DB)

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
