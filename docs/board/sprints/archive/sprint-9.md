---

kanban-plugin: board

---

%% sprint-id: 42 %%
%% sprint-number: 9 %%
%% sprint-status: completed %%
%% goal: Optimize first load - gộp API calls + WS connect sớm %%
%% started: 2026-03-26T07:24:23.836Z %%
%% completed: 2026-03-26T07:27:24.651Z %%
%% project: ai-teams (id 14) %%

# Sprint 9 — Optimize first load - gộp API calls + WS connect sớm

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[170]** Optimize: Giảm waterfall khi load project lần đầu
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 208
      **Description:**
      Lần đầu load project mất 4 round trips tuần tự: getProject → checkTeamStatus → createWS → subscribe. Gây delay 500ms-1s+.

      Fix:
      1. Backend: gộp tmux status vào GET /api/projects/:id response (has_setup_file, tmux_active, roles) → bớt 1 API call
      2. Frontend: useTmuxWs connect WS ngay khi có sessionName, không đợi tmuxSessionActive. Subscribe sau khi xác nhận active.
      3. Frontend: getProject response có tmux status luôn → không cần gọi checkTeamStatus riêng

      Result: 1 API call + WS connect song song thay vì 4 bước tuần tự. Nhanh 2-3x.

      Files:
      - backend-node/src/routes/projects.ts (gộp tmux status vào GET /:id)
      - frontend/app/project/page.tsx (bỏ checkTeamStatus riêng, dùng data từ getProject)
      - frontend/lib/useTmuxWs.ts (connect sớm hơn, không đợi tmuxSessionActive)

      Acceptance Criteria:
      - Load project lần đầu nhanh hơn rõ rệt
      - Chỉ 1 API call để có project + tmux status
      - WS connect song song với API call
      - Không break existing functionality

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
