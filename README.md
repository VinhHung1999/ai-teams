# AI Teams

A Jira-like Kanban board for managing **tmux-based AI agent teams**. Each project has sprints with a board. Assignees are tmux pane roles (PO, DEV, BE, FE, QA, TL) — not humans. AI agents (Claude Code instances) interact with the board via an MCP server.

## Features

- **Kanban board** — todo → in_progress → in_review → testing → done
- **Sprint management** — create, start, complete sprints; auto-return incomplete items to backlog
- **File Manager** — browse, upload (drag & drop + folder), create, rename, delete, edit, preview files
- **Terminal** — embedded tmux terminal per project
- **MCP server** — AI agents manage the board via native MCP tools (no curl hacking)
- **Google OAuth** — whitelist-based access control
- **Cloudflare Tunnel ready** — Next.js rewrites proxy all API/WS traffic

---

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | bundled with Node |
| PostgreSQL | ≥ 14 | `brew install postgresql` |
| PM2 | any | `npm install -g pm2` |
| Python 3 | ≥ 3.11 | *(optional, for MCP server)* |
| uv | any | *(optional)* `pip install uv` |

---

## Quick Setup

```bash
git clone git@github.com:VinhHung1999/ai-teams.git
cd ai-teams
chmod +x setup.sh
./setup.sh
```

The interactive script will:
1. Check prerequisites
2. Create the PostgreSQL database and run migrations
3. Prompt for Google OAuth credentials and write `.env` files
4. Install dependencies and build
5. Start services with PM2

---

## Manual Setup

### 1. Database

```bash
createdb ai_teams
```

### 2. Backend environment

Create `backend-node/.env`:

```env
DATABASE_URL="postgresql://<user>@localhost:5432/ai_teams"
```

Run migrations:

```bash
cd backend-node
npx prisma migrate deploy
```

### 3. Frontend environment

Create `frontend/.env.local`:

```env
# Google OAuth (see Auth Config below)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AUTH_SECRET=<random 32-byte hex>

# App URL
NEXTAUTH_URL=http://localhost:3340

# Allowed sign-in emails (comma-separated)
ALLOWED_EMAILS=you@gmail.com,teammate@gmail.com

# File Manager (optional)
NEXT_PUBLIC_DEFAULT_FILES_PATH=/
NEXT_PUBLIC_WORKSPACE_PATH=/Users
```

Generate `AUTH_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Install & build

```bash
# Backend
cd backend-node && npm install && npm run build && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### 5. Start

```bash
pm2 start ecosystem.config.js
pm2 save
```

---

## Google OAuth Configuration

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create **OAuth 2.0 Client ID** (type: Web application)
3. Add **Authorized redirect URI**:
   - Local: `http://localhost:3340/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`
4. Copy Client ID and Client Secret to `frontend/.env.local`
5. Add your Gmail to `ALLOWED_EMAILS` — only listed emails can sign in

---

## Ports & Architecture

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js) | 3340 | http://localhost:3340 |
| Backend API (Express) | 17070 | proxied via Next.js rewrites |

Frontend proxies `/api/*` and `/ws/*` to the backend via `next.config.ts` rewrites — no separate backend tunnel needed.

```
Frontend (Next.js 15 + React 19)
  ├── app/page.tsx                       → Dashboard (project list)
  ├── app/project/[id]/page.tsx          → Kanban board
  ├── app/project/[id]/backlog/          → Backlog management
  ├── app/files/page.tsx                 → Standalone File Manager
  ├── components/board/                  → KanbanBoard, BoardColumn, TaskCard
  ├── components/FileManager.tsx         → Reusable file browser
  └── lib/api.ts                         → API client (relative URLs)

Backend Node.js (Express + Prisma + PostgreSQL)
  ├── src/routes/backlog.ts              → Backlog CRUD
  ├── src/routes/board.ts                → Sprint board
  ├── src/routes/files.ts                → File Manager API (8 endpoints)
  ├── src/routes/terminal.ts             → PTY terminal (WebSocket)
  ├── src/routes/tmux.ts                 → tmux session management
  └── prisma/schema.prisma               → DB schema

MCP Server (stdio, Python, same PostgreSQL DB)
  └── backend/app/mcp_server.py
```

---

## Development

```bash
# Backend (watch mode via ts-node-dev or nodemon)
cd backend-node && npm run build && pm2 restart ai-teams-api

# Frontend (hot reload)
pm2 logs ai-teams-web --lines 50

# View all logs
pm2 logs

# Restart all
pm2 restart all
```

---

## MCP Server (for AI agents)

The MCP server shares the same PostgreSQL database. AI agents (Claude Code instances) connect to it and manage the board natively.

### Add to Claude Desktop / Claude Code

In `.claude/settings.json` (or MCP config):

```json
{
  "mcpServers": {
    "ai-teams": {
      "command": "uv",
      "args": ["--directory", "/path/to/ai-teams/backend", "run", "python", "-m", "app.mcp_server"],
      "env": {
        "DATABASE_URL": "postgresql://<user>@localhost:5432/ai_teams"
      }
    }
  }
}
```

### Available MCP Tools

| Tool | Description |
|------|-------------|
| `list_backlog` | View product backlog |
| `create_backlog_item` | Create a new backlog item |
| `update_backlog_item` | Update title, description, points, assignee |
| `delete_backlog_item` | Delete a backlog item |
| `list_sprints` | View all sprints |
| `create_sprint` | Create a new sprint |
| `start_sprint` | Start a sprint (only one active at a time) |
| `complete_sprint` | Complete sprint — incomplete items return to backlog |
| `delete_sprint` | Delete a sprint |
| `get_board` | View sprint board (all columns) |
| `get_my_tasks` | Get tasks assigned to a specific role |
| `update_task_status` | Move task between columns |
| `add_task_note` | Add a note/comment to a task |
| `add_item_to_sprint` | Add backlog item to active sprint |
| `remove_item_from_sprint` | Remove item from sprint |
| `notify_boss` | Send notification to the human operator |

---

## tmux Team Setup

Includes a ready-made skill for spinning up a 2-person AI Scrum team (PO + DEV) inside tmux.

See [`skills/tmux-team-creator-mcp/`](skills/tmux-team-creator-mcp/) for full documentation.

### Quick start

```bash
# Create a new AI team session
cd skills/tmux-team-creator-mcp
./create-team.sh ai_teams
```

This launches:
- **Pane 0 (PO)**: Product Owner agent — manages backlog, defines sprints, accepts work
- **Pane 1 (DEV)**: Developer agent — implements features, commits code, reports to PO

Agents communicate via `tm-send`:
```bash
tm-send DEV "PO [09:00]: Sprint 1 started. Task [42] assigned to you."
tm-send PO "DEV [09:15]: Task [42] complete. In review."
```

### Board columns

```
todo → in_progress → in_review → testing → done
```

---

## Project Structure

```
ai-teams/
├── backend-node/          # Primary backend (Express + Prisma)
│   ├── src/
│   ├── prisma/
│   └── package.json
├── backend/               # Legacy Python backend + MCP server
│   └── app/mcp_server.py
├── frontend/              # Next.js 15 app
│   ├── app/
│   ├── components/
│   └── lib/
├── skills/                # Claude Code skills
│   └── tmux-team-creator-mcp/
├── docs/                  # Workflow and prompt docs
├── ecosystem.config.js    # PM2 config
└── setup.sh               # Interactive setup script
```

---

## License

MIT
