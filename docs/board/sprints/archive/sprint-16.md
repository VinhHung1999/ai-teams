---

kanban-plugin: board

---

%% sprint-id: 53 %%
%% sprint-number: 16 %%
%% sprint-status: completed %%
%% goal: Release: Push GitHub + setup.sh + README + skill bundled %%
%% started: 2026-04-01T04:28:54.267Z %%
%% completed: 2026-04-01T04:34:22.089Z %%
%% project: ai-teams (id 14) %%

# Sprint 16 — Release: Push GitHub + setup.sh + README + skill bundled

## 📋 Todo

## 🔨 In Progress

## 👀 In Review

## 🧪 Testing

## ✅ Done

- [x] **[201]** Push project lên GitHub + setup.sh + README + copy skill tmux-team-creator-mcp
      **Priority:** P1 · **Points:** 5 · **Assignee:** DEV · **Status:** done · **Backlog-ID:** 239
      **Description:**
      4 việc:

      1. Push lên GitHub: git@github.com:VinhHung1999/ai-teams.git
         - Clean up .gitignore (node_modules, .next, dist, .env, etc.)
         - Push toàn bộ source code

      2. setup.sh — script setup từ đầu:
         - Install dependencies (Node.js, npm, PostgreSQL)
         - Setup database (createdb, migrate)
         - Setup environment (.env files)
         - Install frontend + backend deps
         - Google OAuth setup hướng dẫn
         - Build + start services
         - Có interactive prompts cho user nhập config

      3. README.md — cập nhật đầy đủ:
         - Giới thiệu project
         - Prerequisites
         - Setup từ đầu (step by step)
         - Cấu hình auth (Google OAuth)
         - Chạy dev / production
         - Architecture overview
         - Ports & URLs
         - Hướng dẫn dùng MCP tools
         - Hướng dẫn tạo tmux team

      4. Copy skill tmux-team-creator-mcp vào source:
         - Copy từ /Users/hungphu/.claude/skills/tmux-team-creator-mcp/ vào repo (vd: skills/tmux-team-creator-mcp/)
         - Để user clone repo là có skill luôn

      Acceptance Criteria:
      - Repo public trên GitHub
      - Clone + chạy setup.sh = chạy được ngay
      - README rõ ràng, từ đầu tới cuối
      - Skill tmux-team-creator-mcp nằm trong repo

%% kanban:settings
```
{"kanban-plugin":"board","show-checkboxes":true,"lane-width":300}
```
%%
