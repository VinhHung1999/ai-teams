# AI Teams

![AI Teams](docs/images/hero-banner.png)

A Kanban board for managing **tmux-based AI agent teams**. Assignees are tmux pane roles (PO, DEV, BE, FE, QA, TL) — not humans. AI agents (Claude Code instances) interact with the board via MCP.

---

## Features

- **Kanban board** — todo → in_progress → in_review → testing → done
- **Sprint management** — create, start, complete; incomplete items auto-return to backlog
- **File Manager** — browse, upload (drag & drop + folder), create, rename, delete, edit, preview
- **Terminal** — embedded tmux terminal per project
- **MCP server** — agents manage the board via native MCP tools
- **Google OAuth** — whitelist-based access control

---

## Quick Setup

```bash
git clone git@github.com:VinhHung1999/ai-teams.git
cd ai-teams
chmod +x setup.sh
./setup.sh
```

The script handles everything: prerequisites check, DB creation, migrations, `.env` prompts (Google OAuth), install, build, PM2 start, and MCP config injection.

---

## Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| PostgreSQL | ≥ 14 | `brew install postgresql` |
| PM2 | any | `npm install -g pm2` |
| Python 3 + uv | ≥ 3.11 | *(optional, for MCP server)* |

---

## Manual Setup

### 1. Database

```bash
createdb ai_teams
```

Create `backend-node/.env`:
```env
DATABASE_URL="postgresql://<user>@localhost:5432/ai_teams"
```

```bash
cd backend-node && npx prisma migrate deploy
```

### 2. Frontend environment

Create `frontend/.env.local`:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
AUTH_SECRET=<random-32-byte-hex>
NEXTAUTH_URL=http://localhost:3340
ALLOWED_EMAILS=you@gmail.com,teammate@gmail.com
```

Generate `AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### 3. Install, build & start

```bash
cd backend-node && npm install && npm run build && cd ..
cd frontend && npm install && cd ..
pm2 start ecosystem.config.js && pm2 save
```

---

## Google OAuth

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) → Create OAuth 2.0 Client ID
2. Authorized redirect URI: `http://localhost:3340/api/auth/callback/google`
3. Copy credentials to `frontend/.env.local`
4. Add allowed Gmail addresses to `ALLOWED_EMAILS`

---

## Ports

| Service | Port |
|---------|------|
| Frontend (Next.js) | 3340 |
| Backend API (Express) | 17070 |

Frontend proxies `/api/*` and `/ws/*` to the backend — no separate backend tunnel needed.

---

## MCP Server

Agents connect via MCP and manage the board natively. Run `./setup.sh` to auto-configure, or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "ai-teams-board": {
      "command": "uv",
      "args": ["run", "python", "-m", "app.mcp_server"],
      "cwd": "/path/to/ai-teams/backend",
      "env": { "AI_TEAMS_DATABASE_URL": "postgresql+asyncpg://<user>@localhost:5432/ai_teams" }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|------|-------------|
| `get_board` | View sprint board (all columns) |
| `get_my_tasks` | Tasks assigned to a role |
| `update_task_status` | Move task between columns |
| `add_task_note` | Add note to a task |
| `create_backlog_item` | Create backlog item |
| `update_backlog_item` | Update item fields |
| `delete_backlog_item` | Delete item |
| `list_backlog` | List backlog |
| `list_sprints` | List all sprints |
| `create_sprint` | Create sprint |
| `start_sprint` | Start sprint |
| `complete_sprint` | Complete sprint |
| `delete_sprint` | Delete sprint |
| `add_item_to_sprint` | Add item to sprint |
| `remove_item_from_sprint` | Remove item from sprint |
| `notify_boss` | Notify human operator |

---

## tmux AI Team

Spin up a 2-agent Scrum team (PO + DEV) with the included skill:

```bash
# See skills/tmux-team-creator-mcp/ for full docs
```

Agents communicate via `tm-send` and manage the board via MCP tools automatically.

---

## Project Structure

```
ai-teams/
├── backend-node/     # Express + Prisma + PostgreSQL
├── backend/          # Python MCP server
├── frontend/         # Next.js 15 + React 19
├── skills/           # tmux-team-creator-mcp
├── docs/             # Workflow docs + images
├── ecosystem.config.js
└── setup.sh
```

---

## License

MIT
