# Architecture

## System Overview

IDE-like web app for managing tmux-based AI agent teams with Kanban board.

```
┌─────────────┐     ┌──────────────┐
│  Frontend    │────→│  Backend     │
│  Next.js 15  │     │  Express/Node│
│  port 3340   │     │  port 17070  │
└─────────────┘     └──────────────┘
                          │
                    ┌─────┴─────┐
                    │ node-pty  │  WebSocket PTY
                    │ terminals │  (persistent sessions)
                    └───────────┘
                          │
                    ┌─────┴─────┐
                    │ Markdown  │  docs/board/**
                    │ Storage   │  (source of truth)
                    └───────────┘

┌─────────────┐
│ Cloudflare   │  scrum-team.hungphu.work → :3340
│ Tunnel       │
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
- **routes/projects.ts** — CRUD projects + directory browsing + tmux auto-register
- **routes/backlog.ts** — CRUD backlog items
- **routes/sprints.ts** — Sprint lifecycle
- **routes/board.ts** — Board operations + dashboard REST endpoint
- **routes/board-ws.ts** — Real-time board WebSocket (file watcher → WS push)
- **routes/board-file-watcher.ts** — chokidar watcher on docs/board/ → debounced WS push
- **routes/terminal.ts** — WebSocket PTY + tmux-pane WS + board WS registration
- **routes/tmux.ts** — Tmux session management (status, capture, send-keys, kill)
- **routes/files.ts** — File tree, reading, download (file stream + folder zip)

### Storage (backend-node/src/storage/)
- **MarkdownStorage** — reads/writes Obsidian Kanban format MD files in docs/board/
- **IStorage** — interface abstraction
- No PostgreSQL; Markdown is source of truth

### Skill (tmux-team-creator-md)
- `~/.claude/skills/tmux-team-creator-md/` (or `skills/tmux-team-creator-md/` in repo)
- Generates team prompts, workflow.md, setup-team.sh
- Agents edit docs/board/ MD files directly (no MCP board tools)
- `notify_boss` MCP tool retained for human notifications

## Key Patterns

### Terminal persistence
- Backend keeps PTY sessions alive even when clients disconnect
- 50K char scrollback buffer replayed on reconnect
- Session named by purpose: `boss-{projectId}-{key}`, `agent-{projectId}-{role}`

### Agent pane viewing
- WebSocket `/ws/tmux-pane` — server polls tmux every 1s, pushes on change (hash-based)
- ANSI → HTML conversion (256 colors + RGB)
- Send input via `tmux send-keys` API

### Dashboard real-time updates
- chokidar watches all `docs/board/` dirs with `awaitWriteFinish: 150ms`
- Application-level debounce 300ms coalesces rapid multi-file edits
- WebSocket `/ws/board` — persistent connection, client sends `{type:"subscribe", projectId}`
- Pauses updates during drag-drop

### Project list
- `tmux list-sessions` on every GET /api/projects call
- Auto-registers unknown sessions with `@role_name` pane options as AI team projects
- Returns `tmux_active` per project (live green/gray status dot in sidebar)

## Cross-Cutting Concerns

### Auth: Google OAuth (NextAuth v5) on frontend only
### Infra: PM2 process manager, Cloudflare tunnel
