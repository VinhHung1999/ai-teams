# Team

Team structure and workflow documentation.

**Full details:** See `~/.claude/skills/tmux-team-creator-mcp/` for team templates and prompts.

## Team Templates Available

### scrum-team (recommended)
- Roles: PO, SM, TL, BE, FE, QA
- Full Scrum framework adapted for AI agents
- SM owns process improvement

### game-dev-team
- Roles: DS, SM, AR, DV, QA
- Design → Architecture → Implementation → Testing

### custom
- User-defined roles (any combination)

## How Teams Work

1. Project created with tmux_session_name
2. `claude -p "/tmux-team-creator-mcp ..."` generates prompts + setup-team.sh
3. `bash setup-team.sh` creates tmux session with panes per role
4. Each pane runs Claude Code with role-specific prompt
5. Agents communicate via tm-send, manage board via MCP tools

## MCP Tools (15 total)

Agents use session_name (= tmux session name) to identify project:
- Backlog: list, create, update, delete
- Sprints: list, create, start, complete, delete
- Board: get_board, get_my_tasks, update_task_status, add_task_note
- Items: add_item_to_sprint, remove_item_from_sprint

## Communication Pattern
- All communication through SM (Scrum Master)
- Boss sends via `>>>` prefix or web UI input
- Agents use tm-send for inter-agent messages
