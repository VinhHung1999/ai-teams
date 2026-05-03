---

kanban-plugin: board

---

%% sprint-id: 52 %%
%% sprint-number: 15 %%
%% sprint-status: completed %%
%% goal: Fix path input keyboard (Enter/Escape) %%
%% started: 2026-04-01T04:01:37.437Z %%
%% completed: 2026-04-01T04:26:01.921Z %%
%% project: ai-teams (id 14) %%

# Sprint 15 — Fix path input keyboard (Enter/Escape)

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[200]** Bug: Path input - Enter không navigate, Escape không work
      **Priority:** P1 · **Points:** 1 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 238
      **Description:**
      Thanh path input trên trang /files: bấm Enter không navigate được. Escape cũng không work.

      Cần debug và fix:
      1. Verify PM2 đang serve latest build
      2. Test Enter trên path input → phải navigate
      3. Test Escape → đóng dropdown + reset input
      4. Check history dropdown onFocus/onBlur có swallow keydown event không

      Acceptance Criteria:
      - Gõ path → Enter → navigate tới path đó
      - Escape → đóng dropdown + reset input
      - Hoạt động dù có hay không có history dropdown

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
