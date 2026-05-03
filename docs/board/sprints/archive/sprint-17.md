---

kanban-plugin: board

---

%% sprint-id: 54 %%
%% sprint-number: 17 %%
%% sprint-status: completed %%
%% goal: setup.sh tự install + config MCP server %%
%% started: 2026-04-01T05:08:23.584Z %%
%% completed: 2026-04-01T05:10:29.623Z %%
%% project: ai-teams (id 14) %%

# Sprint 17 — setup.sh tự install + config MCP server

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[202]** Enhance setup.sh: tự install + config MCP server cho Claude Code
      **Priority:** P1 · **Points:** 2 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 240
      **Description:**
      Thêm vào setup.sh:

      1. Auto install Python MCP deps (uv sync --all-extras trong backend/)
      2. Tự generate MCP config JSON với đúng path + DATABASE_URL
      3. Hỏi user có muốn tự động thêm vào Claude Code settings không:
         - Nếu yes → ghi vào ~/.claude/settings.json (mcpServers section)
         - Nếu no → in ra config để user tự copy
      4. Verify MCP server chạy được (quick test: uv run python -m app.mcp_server --help hoặc tương tự)

      Acceptance Criteria:
      - setup.sh có section MCP setup
      - Tự install Python deps
      - Tự generate config với đúng paths
      - Option tự ghi vào Claude Code settings.json
      - User clone + ./setup.sh = có MCP server sẵn sàng dùng

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
