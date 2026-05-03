# Team

Team structure and workflow documentation.

**Full details:** See `~/.claude/skills/tmux-team-creator-md/` for team templates and prompts.

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
2. `claude -p "/tmux-team-creator-md ..."` generates prompts + setup-team.sh
3. `bash setup-team.sh` creates tmux session with panes per role
4. Each pane runs Claude Code with role-specific prompt
5. Agents communicate via tm-send, manage board by editing docs/board/ Markdown files directly

## Board Management (Markdown-based)

Agents read/edit Markdown files in `docs/board/` directly:
- Backlog: `docs/board/backlog.md`
- Active sprint: `docs/board/sprints/active/sprint-*.md`
- Archive: `docs/board/sprints/archive/`

## notify_boss

Agents use the `notify_boss` MCP tool to notify the human operator. This is the only MCP tool retained — all board operations are now via Markdown files.

## Communication Pattern
- All communication through SM (Scrum Master)
- Boss sends via `>>>` prefix or web UI input
- Agents use tm-send for inter-agent messages
