---

kanban-plugin: board

---

%% sprint-id: 36 %%
%% sprint-number: 4 %%
%% sprint-status: completed %%
%% goal: Optimize: 1 WS per project, giảm resource + fix lag %%
%% started: 2026-03-26T06:17:04.525Z %%
%% completed: 2026-03-26T06:23:23.294Z %%
%% project: ai-teams (id 14) %%

# Sprint 4 — Optimize: 1 WS per project, giảm resource + fix lag

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[162]** Optimize: 1 WS per project thay vì 1 WS per role tab
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 202
      **Description:**
      Hiện tại mỗi AgentPaneView tạo 1 WS riêng → 6 roles = 6 WS + 6 poll intervals. Quá tốn resource.

      Architecture mới:
      - 1 WS per project, giữ connection khi switch (không disconnect)
      - Chỉ poll role ĐANG XEM của project ĐANG FOCUS
      - Switch role tab → gửi subscribe(session, role) → backend poll role mới
      - Switch project → WS project cũ idle (0 poll), WS project mới subscribe role đang active
      - Kết quả: chỉ 1 poll chạy tại bất kỳ thời điểm nào

      Frontend:
      - Lift WS management lên page level, 1 WS per project (Map<projectId, WS>)
      - Khi switch project: pause WS cũ (send unsubscribe hoặc backend tự pause khi không nhận subscribe), activate WS mới
      - Khi switch role tab: send subscribe(session, newRole) trên WS đang active
      - AgentPaneView nhận output qua prop, giữ outputCache cho instant display
      - Kết hợp cache từ Sprint 3

      Backend:
      - subscribe message: {session, role} → start poll cho role đó, stop poll role cũ
      - Hoặc thêm unsubscribe/pause message
      - Mỗi WS connection chỉ poll 1 role tại 1 thời điểm

      Acceptance Criteria:
      - 1 WS per project (giữ connection khi switch)
      - Chỉ 1 poll interval chạy tại bất kỳ thời điểm
      - Switch role = instant (cache) + poll mới ngay
      - Switch project = instant (cache) + activate WS + poll mới ngay
      - 0 resource cho projects/roles không đang xem

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
