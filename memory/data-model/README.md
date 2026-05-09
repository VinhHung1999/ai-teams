# Data Model

## Schema Overview

PostgreSQL database `ai_teams` with 4 tables:

```
Project (1) ──→ (N) BacklogItem (1) ──→ (N) SprintItem
    │                                          ↑
    └──→ (N) Sprint (1) ──────────────────────┘
```

### Project
- id, name, tmux_session_name, working_directory, created_at

### BacklogItem
- id, project_id (FK), title, description, priority (P0-P3), story_points
- acceptance_criteria (JSON), status, order, created_at, updated_at

### Sprint
- id, project_id (FK), number, goal, status (planning/active/completed)
- started_at, completed_at, created_at

### SprintItem
- id, sprint_id (FK), backlog_item_id (FK), assignee_role
- board_status (todo/in_progress/in_review/testing/done), order, notes, updated_at

## ORM Patterns

### Prisma (Node.js backend)
- Schema: `backend-node/prisma/schema.prisma`
- Cascade deletes on all relations
- `@updatedAt` + `@default(now())` for updated_at (needed for MCP compatibility)

### SQLAlchemy (Python MCP server)
- Models: `backend/app/models/`
- Uses `server_default=func.now()` for timestamps
- Shares same PostgreSQL database

## Migrations

### Initial (Prisma)
- Created all 4 tables with Prisma migrate
- Added `DEFAULT NOW()` manually for updated_at columns (for SQLAlchemy MCP compatibility)

## Key Constraints
- Only 1 active sprint per project (enforced in API + MCP)
- Deleting active sprint not allowed
- Completing sprint returns incomplete items to backlog (status → "ready")
