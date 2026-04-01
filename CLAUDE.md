# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Jira-like Kanban board for managing tmux-based AI agent teams. Each project has sprints with a board. Assignees are tmux pane roles (BE, FE, QA, TL, PO, SM) — not humans. Agents interact with the board via an MCP server.

## Commands

### Backend Node.js (from `backend-node/`) — PRIMARY BACKEND
```bash
npm install                   # Install deps
npm run build                 # Build TypeScript
npm start                     # Run server on port 17070
```

### Backend Python (from `backend/`) — LEGACY, not in use
```bash
uv sync --all-extras          # Install deps
uv run uvicorn app.main:app --host 0.0.0.0 --port 17070  # Run server
uv run pytest app/tests/ -v   # Run all tests
uv run python -m app.mcp_server                           # Run MCP server (stdio)
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
  ├── app/project/[id]/page.tsx       → Kanban board (main view)
  ├── app/project/[id]/backlog/       → Backlog management
  ├── components/board/               → KanbanBoard, BoardColumn, TaskCard, TaskDetail
  ├── lib/api.ts                      → API client (relative URLs, works through proxy)
  └── lib/types.ts                    → Shared TypeScript types

Backend Node.js (Express + Prisma + PostgreSQL) ← PRIMARY
  ├── backend-node/src/               → TypeScript source
  ├── backend-node/dist/index.js      → Compiled entry point
  └── DB: postgresql://postgres:postgres@localhost:5432/ai_teams

Backend Python (FastAPI + SQLAlchemy) ← LEGACY, not in use
  ├── backend/app/                    → Python source
  └── backend/app/tests/              → pytest-asyncio tests

MCP Server (stdio, same DB)
  Tools: list_backlog, create_backlog_item, update_backlog_item, delete_backlog_item, list_sprints, create_sprint, start_sprint, complete_sprint, delete_sprint, get_board, get_my_tasks, update_task_status, add_task_note, add_item_to_sprint, remove_item_from_sprint
```

## Key Design Decisions

- **PostgreSQL as source of truth** — DB: `postgresql://postgres:postgres@localhost:5432/ai_teams`. Backend is Node.js (`backend-node/`), NOT the Python backend.
- **MCP over REST for agents** — tmux agents (Claude instances) natively support MCP; no curl/httpx hacking needed. MCP server shares the same PostgreSQL DB.
- **Next.js rewrites as API proxy** — frontend uses relative URLs (`/api/...`), Next.js proxies to backend. This makes the app work identically through cloudflare tunnel and locally.
- **Board auto-refresh** — project board page polls every 5 seconds for updates (WebSocket available but polling used for simplicity).
- **Sprint lifecycle**: planning → active → completed. Only one active sprint per project. Incomplete items return to backlog on sprint completion.

## Board Columns

`todo` → `in_progress` → `in_review` → `testing` → `done`

## Testing

Backend tests use an in-memory SQLite database (`sqlite+aiosqlite://`) with per-test fixtures (not PostgreSQL). The conftest overrides `get_db` dependency. All tests are async (`asyncio_mode = "auto"`).

## Project Memory

Project memories are stored in `.claude/memory/`. Use `--project-recall` before complex tasks, `--project-store` after meaningful work.

| Topic | Content |
|-------|---------|
| [bugs-and-lessons](.claude/memory/bugs-and-lessons/README.md) | Bugs encountered and lessons learned |
| [design-decisions](.claude/memory/design-decisions/README.md) | UI/UX decisions, color palette, layout |
| [api-design](.claude/memory/api-design/README.md) | API endpoints, auth patterns, conventions |
| [data-model](.claude/memory/data-model/README.md) | Database schema, ORM patterns, migrations |
| [architecture](.claude/memory/architecture/README.md) | System structure, module boundaries |
| [team](.claude/memory/team/README.md) | Team roles, workflow, communication |
