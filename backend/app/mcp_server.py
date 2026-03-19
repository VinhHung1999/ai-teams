"""MCP Server for AI agent teams to interact with the board.

Agents connect via MCP and use tools like:
- get_board: View the current sprint board
- get_my_tasks: Get tasks assigned to a specific role
- update_task_status: Move a task between columns
- add_task_note: Add a note to a task
- list_sprints: See project sprints
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.models.project import Project
from app.models.sprint import Sprint
from app.models.sprint_item import SprintItem
from app.models.backlog_item import BacklogItem
from app.database import Base

BOARD_COLUMNS = ["todo", "in_progress", "in_review", "testing", "done"]

server = Server("ai-teams-board")

# DB setup - reuse same SQLite
engine = create_async_engine("sqlite+aiosqlite:///./ai_teams.db", echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncSession:
    async with async_session_maker() as session:
        return session


@server.list_tools()
async def list_tools() -> list[Tool]:
    return [
        Tool(
            name="get_board",
            description="Get the kanban board for the active sprint of a project. Shows all columns (todo, in_progress, in_review, testing, done) with their tasks.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID"},
                },
                "required": ["project_id"],
            },
        ),
        Tool(
            name="get_my_tasks",
            description="Get tasks assigned to a specific role (BE, FE, QA, TL, PO, etc.) in the active sprint.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID"},
                    "role": {"type": "string", "description": "Role name (BE, FE, QA, TL, PO, etc.)"},
                },
                "required": ["project_id", "role"],
            },
        ),
        Tool(
            name="update_task_status",
            description="Move a task to a different board column. Valid statuses: todo, in_progress, in_review, testing, done.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "Sprint item ID"},
                    "new_status": {
                        "type": "string",
                        "enum": BOARD_COLUMNS,
                        "description": "New board status",
                    },
                },
                "required": ["task_id", "new_status"],
            },
        ),
        Tool(
            name="add_task_note",
            description="Add a note/comment to a task on the board.",
            inputSchema={
                "type": "object",
                "properties": {
                    "task_id": {"type": "integer", "description": "Sprint item ID"},
                    "note": {"type": "string", "description": "Note text to append"},
                },
                "required": ["task_id", "note"],
            },
        ),
        Tool(
            name="list_projects",
            description="List all projects.",
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="list_sprints",
            description="List sprints for a project.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID"},
                },
                "required": ["project_id"],
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    async with async_session_maker() as db:
        if name == "list_projects":
            return await _list_projects(db)
        elif name == "list_sprints":
            return await _list_sprints(db, arguments["project_id"])
        elif name == "get_board":
            return await _get_board(db, arguments["project_id"])
        elif name == "get_my_tasks":
            return await _get_my_tasks(db, arguments["project_id"], arguments["role"])
        elif name == "update_task_status":
            return await _update_task_status(db, arguments["task_id"], arguments["new_status"])
        elif name == "add_task_note":
            return await _add_task_note(db, arguments["task_id"], arguments["note"])
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def _list_projects(db: AsyncSession) -> list[TextContent]:
    result = await db.execute(select(Project).order_by(Project.id))
    projects = result.scalars().all()
    if not projects:
        return [TextContent(type="text", text="No projects found.")]
    lines = ["# Projects", ""]
    for p in projects:
        lines.append(f"- **[{p.id}] {p.name}** (tmux: {p.tmux_session_name or 'N/A'})")
    return [TextContent(type="text", text="\n".join(lines))]


async def _list_sprints(db: AsyncSession, project_id: int) -> list[TextContent]:
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.number.desc())
    )
    sprints = result.scalars().all()
    if not sprints:
        return [TextContent(type="text", text="No sprints found.")]
    lines = ["# Sprints", ""]
    for s in sprints:
        status_icon = {"planning": "📋", "active": "🚀", "completed": "✅"}.get(s.status, "❓")
        lines.append(f"- {status_icon} **Sprint {s.number}** [{s.status}] - {s.goal or 'No goal'}")
    return [TextContent(type="text", text="\n".join(lines))]


async def _get_board(db: AsyncSession, project_id: int) -> list[TextContent]:
    # Find active sprint
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id, Sprint.status == "active")
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        return [TextContent(type="text", text="No active sprint. Create and start a sprint first.")]

    result = await db.execute(
        select(SprintItem, BacklogItem)
        .join(BacklogItem, SprintItem.backlog_item_id == BacklogItem.id)
        .where(SprintItem.sprint_id == sprint.id)
        .order_by(SprintItem.order)
    )
    rows = result.all()

    board = {col: [] for col in BOARD_COLUMNS}
    for si, bi in rows:
        board[si.board_status].append((si, bi))

    lines = [f"# Sprint {sprint.number} Board: {sprint.goal or 'No goal'}", ""]
    col_labels = {
        "todo": "📋 To Do", "in_progress": "🔨 In Progress",
        "in_review": "👀 In Review", "testing": "🧪 Testing", "done": "✅ Done",
    }
    for col in BOARD_COLUMNS:
        lines.append(f"## {col_labels[col]} ({len(board[col])})")
        if not board[col]:
            lines.append("  (empty)")
        for si, bi in board[col]:
            role = si.assignee_role or "Unassigned"
            pts = f" ({bi.story_points}pts)" if bi.story_points else ""
            lines.append(f"  - **[{si.id}]** {bi.title} [{bi.priority}]{pts} → {role}")
            if si.notes:
                lines.append(f"    Notes: {si.notes}")
        lines.append("")

    return [TextContent(type="text", text="\n".join(lines))]


async def _get_my_tasks(db: AsyncSession, project_id: int, role: str) -> list[TextContent]:
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id, Sprint.status == "active")
    )
    sprint = result.scalar_one_or_none()
    if not sprint:
        return [TextContent(type="text", text="No active sprint.")]

    result = await db.execute(
        select(SprintItem, BacklogItem)
        .join(BacklogItem, SprintItem.backlog_item_id == BacklogItem.id)
        .where(SprintItem.sprint_id == sprint.id, SprintItem.assignee_role == role)
        .order_by(SprintItem.order)
    )
    rows = result.all()
    if not rows:
        return [TextContent(type="text", text=f"No tasks assigned to {role}.")]

    lines = [f"# Tasks for {role} (Sprint {sprint.number})", ""]
    for si, bi in rows:
        status_icon = {"todo": "📋", "in_progress": "🔨", "in_review": "👀", "testing": "🧪", "done": "✅"}.get(si.board_status, "❓")
        pts = f" ({bi.story_points}pts)" if bi.story_points else ""
        lines.append(f"- {status_icon} **[{si.id}]** {bi.title} [{bi.priority}]{pts} - Status: {si.board_status}")
        if bi.description:
            lines.append(f"  Description: {bi.description}")
        if si.notes:
            lines.append(f"  Notes: {si.notes}")
    return [TextContent(type="text", text="\n".join(lines))]


async def _update_task_status(db: AsyncSession, task_id: int, new_status: str) -> list[TextContent]:
    if new_status not in BOARD_COLUMNS:
        return [TextContent(type="text", text=f"Invalid status. Must be one of: {BOARD_COLUMNS}")]

    result = await db.execute(select(SprintItem).where(SprintItem.id == task_id))
    si = result.scalar_one_or_none()
    if not si:
        return [TextContent(type="text", text=f"Task {task_id} not found.")]

    old_status = si.board_status
    si.board_status = new_status
    await db.commit()

    return [TextContent(type="text", text=f"Task [{task_id}] moved: {old_status} → {new_status}")]


async def _add_task_note(db: AsyncSession, task_id: int, note: str) -> list[TextContent]:
    result = await db.execute(select(SprintItem).where(SprintItem.id == task_id))
    si = result.scalar_one_or_none()
    if not si:
        return [TextContent(type="text", text=f"Task {task_id} not found.")]

    if si.notes:
        si.notes = si.notes + "\n" + note
    else:
        si.notes = note
    await db.commit()

    return [TextContent(type="text", text=f"Note added to task [{task_id}].")]


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
