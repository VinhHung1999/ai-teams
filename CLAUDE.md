# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Jira-like Kanban board for managing tmux-based AI agent teams. Each project has sprints with a board. Assignees are tmux pane roles (BE, FE, QA, TL, PO, SM) — not humans. Agents interact with the board via an MCP server.

## Commands

### Backend (from `backend/`)
```bash
uv sync --all-extras          # Install deps
uv run uvicorn app.main:app --host 0.0.0.0 --port 17070  # Run server
uv run pytest app/tests/ -v   # Run all tests
uv run pytest app/tests/test_board.py -v                  # Single test file
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

Backend (FastAPI + SQLAlchemy async + SQLite)
  ├── app/main.py                     → FastAPI app with CORS + lifespan
  ├── app/models/                     → SQLAlchemy models (Project, BacklogItem, Sprint, SprintItem)
  ├── app/api/                        → Route modules (projects, backlog, sprints, board, tmux)
  ├── app/mcp_server.py               → MCP server for agent board interaction
  └── app/tests/                      → pytest-asyncio tests with in-memory SQLite

MCP Server (stdio, same DB)
  Tools: list_backlog, list_sprints, get_board, get_my_tasks, update_task_status, add_task_note, create_backlog_item, add_item_to_sprint
```

## Key Design Decisions

- **SQLite as source of truth** — markdown files are hard to parse for drag-drop reordering; SQLite enables fast queries and relationships.
- **MCP over REST for agents** — tmux agents (Claude instances) natively support MCP; no curl/httpx hacking needed. MCP server shares the same SQLite DB file.
- **Next.js rewrites as API proxy** — frontend uses relative URLs (`/api/...`), Next.js proxies to backend. This makes the app work identically through cloudflare tunnel and locally.
- **Board auto-refresh** — project board page polls every 5 seconds for updates (WebSocket available but polling used for simplicity).
- **Sprint lifecycle**: planning → active → completed. Only one active sprint per project. Incomplete items return to backlog on sprint completion.

## Board Columns

`todo` → `in_progress` → `in_review` → `testing` → `done`

## Testing

Backend tests use an in-memory SQLite database (`sqlite+aiosqlite://`) with per-test fixtures. The conftest overrides `get_db` dependency. All tests are async (`asyncio_mode = "auto"`).
