---

kanban-plugin: board

---

%% sprint-id: 72 %%
%% sprint-number: 25 %%
%% sprint-status: completed %%
%% goal: Drag resize team panel trong trang project %%
%% started: 2026-04-12T04:53:31.871Z %%
%% completed: 2026-04-14T08:50:18.978Z %%
%% project: ai-teams (id 14) %%

# Sprint 25 — Drag resize team panel trong trang project

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[264]** Feature: Drag resize team panel (AgentPaneView) trong trang project
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 308
      **Description:**
      Trang project hiện tại: kanban board ở trên, team panel (AgentPaneView) ở dưới. Chiều cao cố định.

      Boss muốn kéo resize chiều cao team panel:
      1. **Drag handle** ở giữa (border giữa board và team panel) — kéo lên/xuống
      2. Kéo lên → terminal to hơn, board nhỏ hơn
      3. Kéo xuống → board to hơn, terminal nhỏ hơn
      4. Cursor thay đổi khi hover drag handle (ns-resize)
      5. Persist chiều cao (localStorage) — quay lại vẫn giữ size đã chọn

      Acceptance Criteria:
      - Có drag handle giữa board và team panel
      - Kéo lên/xuống thay đổi chiều cao 2 phần
      - Cursor ns-resize khi hover handle
      - Smooth drag, không giật
      - Persist size qua localStorage
      - Áp dụng cho trang project (và /assistant nếu có layout tương tự)
      **Notes:**
      DONE. Added vertical drag handle at the top of the boss terminal panel (bottom of center column). terminalHeight state with localStorage persistence (key: boss-terminal-height). Drag up → terminal taller (min 80px), drag down → board bigger (max 600px). cursor-ns-resize, dot visual hint on hover, document-level mousemove/mouseup for smooth drag, userSelect disabled during drag. Build pass, PM2 restarted.

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
