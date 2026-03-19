"""MCP Server for AI agent teams to interact with the board.

Agents connect via MCP and use tools like:
- get_board: View the current sprint board
- get_my_tasks: Get tasks assigned to a specific role
- update_task_status: Move a task between columns
- add_task_note: Add a note to a task
- list_sprints: See project sprints
- create_backlog_item: Create a new backlog item
- add_item_to_sprint: Add a backlog item to a sprint
- list_backlog: List backlog items for a project
"""

import asyncio
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

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
            name="create_backlog_item",
            description="Create a new backlog item for a project.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID"},
                    "title": {"type": "string", "description": "Title of the backlog item"},
                    "description": {"type": "string", "description": "Detailed description"},
                    "priority": {"type": "string", "enum": ["P0", "P1", "P2", "P3"], "description": "Priority (default P2)"},
                    "story_points": {"type": "integer", "description": "Story points estimate"},
                },
                "required": ["project_id", "title"],
            },
        ),
        Tool(
            name="add_item_to_sprint",
            description="Add a backlog item to the active sprint (or a specific sprint).",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID (used to find active sprint if sprint_id not given)"},
                    "backlog_item_id": {"type": "integer", "description": "Backlog item ID to add"},
                    "assignee_role": {"type": "string", "description": "Role to assign (BE, FE, QA, TL, PO, etc.)"},
                    "sprint_id": {"type": "integer", "description": "Sprint ID (optional, defaults to active sprint)"},
                },
                "required": ["project_id", "backlog_item_id"],
            },
        ),
        Tool(
            name="list_backlog",
            description="List all backlog items for a project. Shows title, priority, story points, and status.",
            inputSchema={
                "type": "object",
                "properties": {
                    "project_id": {"type": "integer", "description": "Project ID"},
                },
                "required": ["project_id"],
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
        if name == "list_backlog":
            return await _list_backlog(db, arguments["project_id"])
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
        elif name == "create_backlog_item":
            return await _create_backlog_item(
                db, arguments["project_id"], arguments["title"],
                arguments.get("description"), arguments.get("priority", "P2"),
                arguments.get("story_points"),
            )
        elif name == "add_item_to_sprint":
            return await _add_item_to_sprint(
                db, arguments["project_id"], arguments["backlog_item_id"],
                arguments.get("assignee_role"), arguments.get("sprint_id"),
            )
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]


async def _create_backlog_item(
    db: AsyncSession, project_id: int, title: str,
    description: str | None, priority: str, story_points: int | None,
) -> list[TextContent]:
    result = await db.execute(
        select(BacklogItem.order)
        .where(BacklogItem.project_id == project_id)
        .order_by(BacklogItem.order.desc())
    )
    max_order = result.scalar() or 0
    item = BacklogItem(
        project_id=project_id, title=title, description=description,
        priority=priority, story_points=story_points, order=max_order + 1,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return [TextContent(type="text", text=f"Created backlog item [{item.id}] '{title}' ({priority})")]


async def _add_item_to_sprint(
    db: AsyncSession, project_id: int, backlog_item_id: int,
    assignee_role: str | None, sprint_id: int | None,
) -> list[TextContent]:
    if sprint_id:
        result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    else:
        result = await db.execute(
            select(Sprint).where(Sprint.project_id == project_id, Sprint.status.in_(["active", "planning"]))
            .order_by(Sprint.status.desc())  # active first
        )
    sprint = result.scalar_one_or_none()
    if not sprint:
        return [TextContent(type="text", text="No active or planning sprint found.")]

    bi_result = await db.execute(select(BacklogItem).where(BacklogItem.id == backlog_item_id))
    bi = bi_result.scalar_one_or_none()
    if not bi:
        return [TextContent(type="text", text=f"Backlog item {backlog_item_id} not found.")]

    from sqlalchemy import func as sa_func
    order_result = await db.execute(
        select(sa_func.max(SprintItem.order)).where(SprintItem.sprint_id == sprint.id)
    )
    max_order = order_result.scalar() or 0

    si = SprintItem(
        sprint_id=sprint.id, backlog_item_id=backlog_item_id,
        assignee_role=assignee_role, order=max_order + 1,
    )
    db.add(si)
    bi.status = "in_sprint"
    await db.commit()
    await db.refresh(si)
    return [TextContent(type="text", text=f"Added '{bi.title}' to Sprint {sprint.number} as [{si.id}] → {assignee_role or 'Unassigned'}")]


async def _list_backlog(db: AsyncSession, project_id: int) -> list[TextContent]:
    result = await db.execute(
        select(BacklogItem).where(BacklogItem.project_id == project_id).order_by(BacklogItem.order)
    )
    items = result.scalars().all()
    if not items:
        return [TextContent(type="text", text="Backlog is empty.")]
    lines = ["# Backlog", ""]
    for i in items:
        pts = f" ({i.story_points}pts)" if i.story_points else ""
        lines.append(f"- **[{i.id}]** {i.title} [{i.priority}]{pts} - {i.status}")
        if i.description:
            lines.append(f"  {i.description}")
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
