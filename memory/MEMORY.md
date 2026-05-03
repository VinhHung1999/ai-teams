# AI Teams — Project Memory Index

## Bugs & Lessons
- [DATABASE_URL legacy mismatch](bugs-and-lessons/database_url_legacy_mismatch.md) — env var points to legacy `aicontroller` DB, hardcode Prisma conn string for raw `pg`
- [execSync blocks event loop](bugs-and-lessons/execsync_blocks_eventloop.md) — never use execSync in Express routes, use promisify(exec)
- [pane_last_activity unreliable](bugs-and-lessons/pane_last_activity_unreliable.md) — use capture-pane hash compare, not tmux pane_last_activity
- [PTY flow control hang](bugs-and-lessons/pty_flow_control_hang.md) — pause() without resume() froze PTY, removed flow control entirely

## Architecture
- [WS patterns from AITeamController](architecture/ws_patterns_from_controller.md) — 200ms rate limit + 30s ping + pause/resume for hidden tabs

## Team
- [Sprint completion workflow](team/sprint_workflow.md) — done → fix bugs → merge main → close sprint → retro

## Legacy (TODO: split into individual files with frontmatter)
- [bugs-and-lessons/README.md](bugs-and-lessons/README.md) — 10+ unstructured entries (WS reconnect, node-pty, express-ws, MCP datetime, etc.)

## How this works
- This index is auto-loaded. Keep entries to 1 line, under ~150 chars.
- Each memory file has frontmatter: `name`, `description`, `type` (project/feedback/user/reference).
- Organize by topic folder (bugs-and-lessons/, architecture/, team/, api-design/, data-model/, design-decisions/).
