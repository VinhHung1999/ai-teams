from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Dict, Set

from app.database import get_db
from app.models.sprint_item import SprintItem
from app.models.backlog_item import BacklogItem

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


@router.websocket("/ws/board/{sprint_id}")
async def board_websocket(websocket: WebSocket, sprint_id: int):
    await manager.connect(sprint_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(sprint_id, websocket)
