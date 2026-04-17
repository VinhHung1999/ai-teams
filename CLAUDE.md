# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Jira-like Kanban board for managing tmux-based AI agent teams. Each project has sprints with a board. Assignees are tmux pane roles (BE, FE, QA, TL, PO, SM) — not humans. Agents read/edit Markdown board files directly (Obsidian Kanban format).

## Commands

### Backend Node.js (from `backend-node/`) — PRIMARY BACKEND
```bash
npm install                   # Install deps
npm run build                 # Build TypeScript
npm start                     # Run server on port 17070
```

### Frontend (from `frontend/`)
```bash
npm install                   # Install deps
npm run dev                   # Dev server on port 3340
npm run build                 # Type-check + build
npm run lint                  # ESLint
```

## Ports & Tunnel

| Service | Port | Tunnel |
|---------|------|--------|
| Frontend | 3340 | scrum-team.hungphu.work |
| Backend API | 17070 | proxied via Next.js rewrites |

Frontend proxies `/api/*` and `/ws/*` to backend via `next.config.ts` rewrites — no direct backend tunnel needed.

## Architecture

```
Frontend (Next.js 15 + React 19)
  ├── app/page.tsx                    → Dashboard (list projects)
  ├── app/project/page.tsx            → Kanban board (main view)
  ├── app/assistant/page.tsx          → Assistant chat
  ├── components/board/               → KanbanBoard, BoardColumn, TaskCard, TaskDetail
  ├── lib/api.ts                      → API client (relative URLs, works through proxy)
  └── lib/types.ts                    → Shared TypeScript types

Backend Node.js (Express + MarkdownStorage)
  ├── backend-node/src/               → TypeScript source
  ├── backend-node/src/storage/       → IStorage, MarkdownStorage, factory
  ├── backend-node/dist/index.js      → Compiled entry point
  └── Storage mode: Markdown only (STORAGE env var accepted but only markdown supported)

Board Data (Markdown — Obsidian Kanban format, stored in brain2 vault)
  ├── ~/Documents/Note/HungVault/brain2/wiki/projects/<slug>/docs/board/
  │     backlog.md, sprints/active/sprint-N.md, sprints/archive/sprint-N.md
  └── Board dir resolver (resolveBoardDir in MarkdownStorage.ts):
        1. project.board_directory override (registry.json)
        2. VAULT/wiki/projects/{project.name}/docs/board if path exists
        3. {working_directory}/docs/board (legacy fallback)

MCP Server (stdio)
  Tools: notify_boss (primary), plus legacy board tools for compatibility
```

## Key Design Decisions

- **Markdown as source of truth** — Board data lives in the brain2 vault at `~/Documents/Note/HungVault/brain2/wiki/projects/<slug>/docs/board/`. Agents edit MD directly.
- **Vault-first board resolver** — `resolveBoardDir()` in `MarkdownStorage.ts`: explicit `board_directory` override → vault path by project name → legacy `{wd}/docs/board`. Add `board_directory` to `registry.json` only for projects whose `name` doesn't match the vault slug.
- **Next.js rewrites as API proxy** — frontend uses relative URLs (`/api/...`), Next.js proxies to backend.
- **Board auto-refresh** — WebSocket push from backend on board changes.
- **Sprint lifecycle**: planning → active → completed. Only one active sprint per project. Incomplete items return to backlog on sprint completion.

## Board Format

Files use Obsidian Kanban plugin format. See `docs/tmux/ai-teams/workflow.md` for full card format reference.

### Card Format
```
- [ ] **[SPRINT_ITEM_ID]** Task title
      **Priority:** P1 · **Points:** 3 · **Assignee:** DEV · **Status:** todo · **Backlog-ID:** 123
      **Description:**
      Description here...
```

### Board Columns
`todo` → `in_progress` → `in_review` → `testing` → `done`

## Project Memory

Project memories are stored in `.claude/memory/`.

| Topic | Content |
|-------|---------|
| [bugs-and-lessons](.claude/memory/bugs-and-lessons/README.md) | Bugs encountered and lessons learned |
| [design-decisions](.claude/memory/design-decisions/README.md) | UI/UX decisions, color palette, layout |
| [api-design](.claude/memory/api-design/README.md) | API endpoints, auth patterns, conventions |
| [data-model](.claude/memory/data-model/README.md) | Database schema, ORM patterns, migrations |
| [architecture](.claude/memory/architecture/README.md) | System structure, module boundaries |
| [team](.claude/memory/team/README.md) | Team roles, workflow, communication |
