---

kanban-plugin: board

---

%% sprint-id: 48 %%
%% sprint-number: 13 %%
%% sprint-status: completed %%
%% goal: File Manager độc lập — trang /files với full CRUD + upload/download %%
%% started: 2026-03-31T00:44:32.394Z %%
%% completed: 2026-03-31T01:01:08.033Z %%
%% project: ai-teams (id 14) %%

# Sprint 13 — File Manager độc lập — trang /files với full CRUD + upload/download

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[192]** Feature: File Manager độc lập - browse, upload, create, delete, rename, download
      **Priority:** P1 · **Points:** 8 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 230
      **Description:**
      Trang File Manager riêng biệt (/files), không gắn với project/team nào. Quản lý file trên máy.

      Scope:
      1. Trang riêng /files trên dashboard — standalone, không thuộc project
      2. Browse toàn bộ filesystem (chọn root path tùy ý, nhớ last path)
      3. Upload file + folder (drag & drop + button click)
      4. Create file/folder mới
      5. Delete file/folder (có confirmation)
      6. Rename file/folder
      7. Download file

      Backend APIs cần thêm:
      - POST /api/files/upload (multipart, hỗ trợ folder structure)
      - POST /api/files/create (tạo file/folder mới)
      - DELETE /api/files/delete (xóa file/folder)
      - PATCH /api/files/rename (đổi tên)
      - GET /api/files/download (download file)

      Frontend:
      - Trang /files mới với sidebar nav
      - File tree browser (reuse/enhance FileViewer)
      - Upload zone (drag & drop overlay + upload button)
      - Context menu hoặc action buttons (create, rename, delete, download)
      - Progress indicator cho upload
      - Breadcrumb navigation

      Acceptance Criteria:
      - Có trang /files riêng, truy cập từ dashboard
      - Browse filesystem tự do, chọn root path
      - Upload file đơn lẻ + multiple files
      - Upload folder giữ nguyên cấu trúc thư mục
      - Drag & drop upload hoạt động
      - Tạo file/folder mới
      - Xóa file/folder có confirm dialog
      - Rename file/folder inline
      - Download file
      - UI consistent với style hiện tại (dark theme, emerald accents)
      **Notes:**
      PO update: Các tính năng mới (upload, create, delete, rename, download) cũng phải hoạt động trong tab Files của project. Reuse component/logic — File Manager page và project Files tab dùng chung component, chỉ khác root path.
      PO update thêm: 
      1. Edit file trực tiếp trên UI (code editor với save) — không chỉ view-only
      2. Xem được hình ảnh (png, jpg, gif, svg, webp) — hiển thị preview thay vì báo "binary file"
      DONE. Implemented full File Manager:

      Backend (files.ts):
      - GET /api/files/tree — browse filesystem
      - GET /api/files/read — read text files
      - GET /api/files/image — serve images for preview (png/jpg/gif/svg/webp)
      - PUT /api/files/save — save edited file content
      - POST /api/files/upload — multipart upload (multer, 100MB limit)
      - POST /api/files/create — create file or dir
      - DELETE /api/files — delete file/dir (recursive)
      - PATCH /api/files/rename — rename within same dir
      - GET /api/files/download — stream file download

      Frontend:
      - FileManager.tsx — shared component with full CRUD:
        - Browse tree, syntax-highlighted read
        - Image preview (png/jpg/gif/svg/webp)
        - Edit + save (textarea editor, Ctrl+S)
        - Upload (drag & drop onto tree + button + per-dir)
        - Create file/folder (dialog)
        - Delete with confirm dialog
        - Rename (inline input)
        - Download button
      - /files/page.tsx — standalone page with path input + history
      - AppSidebar — added File Manager link
      - project/page.tsx — Files tab now uses FileManager instead of FileViewer

      All builds pass. Backend smoke tests pass. PM2 restarted.
      Security fixes + folder upload:

      CRITICAL 1 & 2 FIXED — validatePath() added:
      - path.resolve() normalises all paths
      - root param required on write ops, optional on reads
      - startsWith(root + sep) check blocks any traversal
      - Null-byte injection blocked
      - Upload filename sanitised with path.basename()
      - Folder upload relativePath parts stripped of '..' / '.'

      IMPORTANT FIXED:
      - DELETE endpoint logs: [ISO] FILES DELETE: /path (file|dir)
      - Image endpoint: 50MB size limit, returns 400 if exceeded

      BONUS:
      - Folder upload support: webkitdirectory input + relativePaths[] array preserves dir structure
      - Upload filename traversal fixed (memoryStorage + validate each target path)

      Smoke tests: traversal blocked (403), valid ops pass, delete logged.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
