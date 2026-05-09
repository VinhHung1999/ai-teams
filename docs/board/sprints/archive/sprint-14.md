---

kanban-plugin: board

---

%% sprint-id: 49 %%
%% sprint-number: 14 %%
%% sprint-status: completed %%
%% goal: UX: Gộp upload thành 1 nút + drag & drop zone %%
%% started: 2026-03-31T01:05:19.062Z %%
%% completed: 2026-03-31T09:26:05.411Z %%
%% project: ai-teams (id 14) %%

# Sprint 14 — UX: Gộp upload thành 1 nút + drag & drop zone

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[193]** UX: Gộp upload thành 1 nút duy nhất với drag & drop zone
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 231
      **Description:**
      Hiện tại có 2 nút upload riêng (file + folder) gây confuse. Đổi thành:

      1. Chỉ 1 nút Upload — click vào mở modal/overlay với drag & drop zone
      2. Drag & drop zone lớn, rõ ràng — kéo file hoặc folder vào đều được
      3. Bỏ 2 nút upload riêng, bỏ file picker (chọn bằng dialog bị lâu)
      4. Drag & drop tự detect file vs folder, giữ cấu trúc thư mục khi drop folder
      5. Hiện progress khi upload

      Acceptance Criteria:
      - Chỉ 1 nút Upload trên toolbar
      - Click → hiện drag & drop zone (modal hoặc overlay)
      - Kéo file đơn, nhiều file, hoặc folder vào đều hoạt động
      - Folder giữ nguyên cấu trúc thư mục
      - Không còn file picker dialog
      - UI clean, không confuse
      **Notes:**
      PO update: Thêm yêu cầu preview file .html — render HTML trong iframe thay vì hiển thị source code. Có thể toggle giữa Preview mode và Source mode.
      PO update: Bỏ preview inline trong FileManager. Thay bằng nút "Open in new tab" — click vào mở file HTML trên tab browser mới (full screen). Backend serve raw HTML qua endpoint riêng (vd: GET /api/files/preview?path=...).
      PO update: Trang /files cần nút Back/Home để quay về dashboard AI Teams (trang chủ /).

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
