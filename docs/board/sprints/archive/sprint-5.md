---

kanban-plugin: board

---

%% sprint-id: 37 %%
%% sprint-number: 5 %%
%% sprint-status: completed %%
%% goal: Persistent WS connections - switch project instant %%
%% started: 2026-03-26T06:30:22.146Z %%
%% completed: 2026-03-26T06:33:02.682Z %%
%% project: ai-teams (id 14) %%

# Sprint 5 — Persistent WS connections - switch project instant

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[163]** Optimize: Giữ WS connections alive cho tất cả projects đã mở
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 203
      **Description:**
      Hiện tại switch project = disconnect WS cũ + connect WS mới → delay 1-2s. User thấy team cũ rồi mới cập nhật.

      Approach: Persistent WS connections
      - Lift WS management lên level cao hơn (module-level hoặc context), dùng Map<sessionName, WS>
      - Mở project nào → tạo WS, giữ connection vĩnh viễn (không disconnect khi switch)
      - Switch project → gửi subscribe trên WS có sẵn → instant, không cần reconnect
      - Chỉ project đang focus + role đang xem mới poll
      - Project không focus → WS idle, giữ connection + output cache

      Implementation:
      - useTmuxWs hook: thay vì disconnect/reconnect khi sessionName thay đổi, quản lý Map<sessionName, WS>
      - Khi sessionName thay đổi: pause poll WS cũ (unsubscribe), activate WS mới (subscribe role)
      - Cache output per session+role, persist across project switches
      - Cleanup: chỉ disconnect khi project bị xóa hoặc component unmount hoàn toàn

      Acceptance Criteria:
      - Switch project = instant (hiện cached output ngay, không reconnect)
      - Tất cả WS đã mở giữ connection (idle khi không focus)
      - Chỉ 1 poll chạy tại mọi thời điểm (project đang focus + role đang xem)
      - Không còn hiện team cũ khi switch project

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
