# API Design

## Endpoints

### Dashboard (single call)
- `GET /api/projects/:id/dashboard` — returns project + sprints + backlog + all boards in 1 call
- Key optimization: avoids multiple sequential calls over tunnel

### Projects
- `GET /api/projects` — list all
- `POST /api/projects` — create (name, tmux_session_name, working_directory)
- `GET /api/projects/:id` — get one
- `DELETE /api/projects/:id` — delete + cascade
- `GET /api/projects/browse-dirs?path=` — list directories
- `POST /api/projects/mkdir` — create directory

### Backlog
- `GET /api/projects/:id/backlog` — list items
- `POST /api/projects/:id/backlog` — create item
- `PUT /api/backlog/:id` — update item
- `DELETE /api/backlog/:id` — delete item
- `PUT /api/projects/:id/backlog/reorder` — reorder

### Sprints
- `GET /api/projects/:id/sprints` — list (desc by number)
- `POST /api/projects/:id/sprints` — create
- `PUT /api/sprints/:id/start` — start (check no other active)
- `PUT /api/sprints/:id/complete` — complete (incomplete items → backlog)
- `DELETE /api/sprints/:id` — delete (not active, items → backlog)
- `POST /api/sprints/:id/items` — add backlog item to sprint
- `DELETE /api/sprints/:id/items/:itemId` — remove item

### Board
- `GET /api/sprints/:id/board` — get board (5 columns)
- `PUT /api/board/items/:id/move` — move item between columns

### Terminal (WebSocket)
- `WS /ws/terminal?cwd=&name=&cmd=` — PTY terminal with persistent sessions
- `GET /api/terminal/sessions` — list sessions
- `DELETE /api/terminal/sessions/:name` — kill session

### Tmux
- `GET /api/tmux/session/:name?working_dir=` — check team status (files + tmux)
- `GET /api/tmux/session/:name/activity` — pane activity (output change detection)
- `GET /api/tmux/session/:name/pane/:role` — capture pane output
- `POST /api/tmux/session/:name/send` — send text to pane (+ Enter)
- `POST /api/tmux/session/:name/send-key` — send special key (C-c, Up, etc.)
- `POST /api/tmux/session/:name/kill` — kill session

### Files
- `GET /api/files/tree?path=` — directory listing
- `GET /api/files/read?path=` — file content + language detection

## Authentication
- Google OAuth via NextAuth v5 (frontend only)
- Backend APIs no auth (local network / tunnel protected)
- MCP server: no auth (stdio, local process)

## Conventions
- Board columns: `todo`, `in_progress`, `in_review`, `testing`, `done`
- Sprint statuses: `planning`, `active`, `completed`
- Backlog statuses: `new`, `ready`, `in_sprint`, `done`
- Dates: ISO string format
