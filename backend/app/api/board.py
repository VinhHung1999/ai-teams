from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Dict, Set

from app.database import get_db
from app.models.sprint_item import SprintItem
from app.models.backlog_item import BacklogItem

from app.models.sprint import Sprint

router = APIRouter(tags=["board"])

BOARD_COLUMNS = ["todo", "in_progress", "in_review", "testing", "done"]


class MoveItemRequest(BaseModel):
    board_status: str
    order: int = 0


class BoardItemResponse(BaseModel):
    id: int
    sprint_id: int
    backlog_item_id: int
    title: str
    description: str | None
    priority: str
    story_points: int | None
    assignee_role: str | None
    board_status: str
    order: int


class BoardConnectionManager:
    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, sprint_id: int, ws: WebSocket):
        await ws.accept()
        if sprint_id not in self.connections:
            self.connections[sprint_id] = set()
        self.connections[sprint_id].add(ws)

    def disconnect(self, sprint_id: int, ws: WebSocket):
        if sprint_id in self.connections:
            self.connections[sprint_id].discard(ws)

    async def broadcast(self, sprint_id: int, data: dict):
        if sprint_id in self.connections:
            dead = []
            for ws in self.connections[sprint_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.connections[sprint_id].discard(ws)


manager = BoardConnectionManager()


@router.get("/api/sprints/{sprint_id}/board")
async def get_board(sprint_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SprintItem, BacklogItem)
        .join(BacklogItem, SprintItem.backlog_item_id == BacklogItem.id)
        .where(SprintItem.sprint_id == sprint_id)
        .order_by(SprintItem.order)
    )
    board = {col: [] for col in BOARD_COLUMNS}
    for si, bi in result.all():
        item = BoardItemResponse(
            id=si.id, sprint_id=si.sprint_id, backlog_item_id=si.backlog_item_id,
            title=bi.title, description=bi.description, priority=bi.priority,
            story_points=bi.story_points, assignee_role=si.assignee_role,
            board_status=si.board_status, order=si.order,
        )
        board[si.board_status].append(item.model_dump())
    return board


@router.put("/api/board/items/{item_id}/move")
async def move_item(item_id: int, data: MoveItemRequest, db: AsyncSession = Depends(get_db)):
    if data.board_status not in BOARD_COLUMNS:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {BOARD_COLUMNS}")
    result = await db.execute(select(SprintItem).where(SprintItem.id == item_id))
    si = result.scalar_one_or_none()
    if not si:
        raise HTTPException(status_code=404, detail="Sprint item not found")
    si.board_status = data.board_status
    si.order = data.order
    await db.commit()
    await manager.broadcast(si.sprint_id, {
        "type": "item_moved", "item_id": item_id,
        "board_status": data.board_status, "order": data.order,
    })
    return {"ok": True}


@router.get("/api/projects/{project_id}/dashboard")
async def get_dashboard(project_id: int, db: AsyncSession = Depends(get_db)):
    """Single endpoint that returns all dashboard data: project, sprints, backlog, and all boards."""
    from app.models.project import Project as ProjectModel
    from app.models.backlog_item import BacklogItem as BacklogItemModel

    # Fetch project
    proj_result = await db.execute(select(ProjectModel).where(ProjectModel.id == project_id))
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fetch sprints
    sprint_result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.number.desc())
    )
    sprints = sprint_result.scalars().all()

    # Fetch backlog
    backlog_result = await db.execute(
        select(BacklogItemModel).where(BacklogItemModel.project_id == project_id).order_by(BacklogItemModel.order)
    )
    backlog_items = backlog_result.scalars().all()

    # Fetch boards for all sprints in one query
    sprint_ids = [s.id for s in sprints]
    boards: dict = {}
    if sprint_ids:
        items_result = await db.execute(
            select(SprintItem, BacklogItem)
            .join(BacklogItem, SprintItem.backlog_item_id == BacklogItem.id)
            .where(SprintItem.sprint_id.in_(sprint_ids))
            .order_by(SprintItem.order)
        )
        for si, bi in items_result.all():
            sid = si.sprint_id
            if sid not in boards:
                boards[sid] = {col: [] for col in BOARD_COLUMNS}
            boards[sid][si.board_status].append(BoardItemResponse(
                id=si.id, sprint_id=si.sprint_id, backlog_item_id=si.backlog_item_id,
                title=bi.title, description=bi.description, priority=bi.priority,
                story_points=bi.story_points, assignee_role=si.assignee_role,
                board_status=si.board_status, order=si.order,
            ).model_dump())

    return {
        "project": {
            "id": project.id, "name": project.name,
            "tmux_session_name": project.tmux_session_name,
            "working_directory": project.working_directory,
            "created_at": project.created_at.isoformat() if project.created_at else None,
        },
        "sprints": [
            {
                "id": s.id, "project_id": s.project_id, "number": s.number,
                "goal": s.goal, "status": s.status,
                "started_at": s.started_at.isoformat() if s.started_at else None,
                "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in sprints
        ],
        "backlog": [
            {
                "id": i.id, "project_id": i.project_id, "title": i.title,
                "description": i.description, "priority": i.priority,
                "story_points": i.story_points, "acceptance_criteria": i.acceptance_criteria,
                "status": i.status, "order": i.order,
                "created_at": i.created_at.isoformat() if i.created_at else None,
                "updated_at": i.updated_at.isoformat() if i.updated_at else None,
            }
            for i in backlog_items
        ],
        "boards": {str(k): v for k, v in boards.items()},
    }


@router.websocket("/ws/board/{sprint_id}")
async def board_websocket(websocket: WebSocket, sprint_id: int):
    await manager.connect(sprint_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(sprint_id, websocket)
