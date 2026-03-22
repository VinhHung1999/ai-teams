# Architecture

## System Overview

IDE-like web app for managing tmux-based AI agent teams with Kanban board.

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Frontend    │────→│  Backend     │────→│ PostgreSQL │
│  Next.js 15  │     │  Express/Node│     │ ai_teams   │
│  port 3340   │     │  port 17070  │     │ port 5432  │
└─────────────┘     └──────────────┘     └────────────┘
                          │
                    ┌─────┴─────┐
                    │ node-pty  │  WebSocket PTY
                    │ terminals │  (persistent sessions)
                    └───────────┘

┌─────────────┐     ┌──────────────┐
│  MCP Server  │────→│ PostgreSQL   │  (same DB)
│  Python/stdio│     │              │
└─────────────┘     └──────────────┘

┌─────────────┐
│ Cloudflare   │  scrum-team.hungphu.work → :3340
│ Tunnel       │  scrum-api.hungphu.work  → :17070
└─────────────┘
```

## Module Boundaries

### Frontend (frontend/)
- **app/project/page.tsx** — Main page, 3-panel layout, state management
- **components/ProjectDashboard.tsx** — Kanban board, DnD, sprints, backlog
- **components/AgentPaneView.tsx** — Tmux pane viewer (polling capture-pane + send-keys)
- **components/WebTerminal.tsx** — xterm.js terminal (PTY WebSocket)
- **components/FileViewer.tsx** — File tree + code viewer (Shiki highlighting)
- **components/AppSidebar.tsx** — Project list sidebar

### Backend Node.js (backend-node/)
- **routes/projects.ts** — CRUD projects + directory browsing
- **routes/backlog.ts** — CRUD backlog items
- **routes/sprints.ts** — Sprint lifecycle
- **routes/board.ts** — Board operations + dashboard endpoint
- **routes/terminal.ts** — WebSocket PTY with persistent named sessions
- **routes/tmux.ts** — Tmux session management (status, capture, send-keys, kill)
- **routes/files.ts** — File tree + file reading

### MCP Server (backend/app/mcp_server.py)
- 15 tools for AI agents to manage board
- Uses session_name to resolve project
- Python + SQLAlchemy + asyncpg → same PostgreSQL DB

### Skill (tmux-team-creator-mcp)
- ~/.claude/skills/tmux-team-creator-mcp/
- Generates team prompts, workflow.md, setup-team.sh
- References MCP tools instead of markdown files

## Key Patterns

### Terminal persistence
- Backend keeps PTY sessions alive even when clients disconnect
- 50K char scrollback buffer replayed on reconnect
- Session named by purpose: `boss-{projectId}-{key}`, `agent-{projectId}-{role}`

### Agent pane viewing
- Polling `tmux capture-pane` every 500ms (not tmux attach)
- ANSI → HTML conversion (256 colors + RGB)
- Send input via `tmux send-keys` API

### Dashboard auto-refresh
- Single `/api/projects/:id/dashboard` endpoint returns all data
- Polls every 3 seconds
- Pauses during drag-drop

## Cross-Cutting Concerns

### Auth: Google OAuth (NextAuth v5) on frontend only
### Infra: PM2 process manager, Cloudflare tunnel
### DB: Prisma (Node.js) + SQLAlchemy (Python MCP) share same PostgreSQL
