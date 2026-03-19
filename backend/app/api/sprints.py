from datetime import datetime, UTC
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sa_func
from pydantic import BaseModel

from app.database import get_db
from app.models.sprint import Sprint
from app.models.sprint_item import SprintItem
from app.models.backlog_item import BacklogItem

router = APIRouter(tags=["sprints"])


class SprintCreate(BaseModel):
    goal: str | None = None


class SprintResponse(BaseModel):
    id: int
    project_id: int
    number: int
    goal: str | None
    status: str
    started_at: str | None
    completed_at: str | None
    created_at: str

    model_config = {"from_attributes": True}


class AddItemRequest(BaseModel):
    backlog_item_id: int
    assignee_role: str | None = None


class SprintItemResponse(BaseModel):
    id: int
    sprint_id: int
    backlog_item_id: int
    assignee_role: str | None
    board_status: str
    order: int


@router.get("/api/projects/{project_id}/sprints", response_model=list[SprintResponse])
async def list_sprints(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.number.desc())
    )
    return [
        SprintResponse(
            id=s.id, project_id=s.project_id, number=s.number, goal=s.goal, status=s.status,
            started_at=s.started_at.isoformat() if s.started_at else None,
            completed_at=s.completed_at.isoformat() if s.completed_at else None,
            created_at=s.created_at.isoformat(),
        )
        for s in result.scalars().all()
    ]


@router.post("/api/projects/{project_id}/sprints", response_model=SprintResponse)
async def create_sprint(project_id: int, data: SprintCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(sa_func.max(Sprint.number)).where(Sprint.project_id == project_id)
    )
    max_num = result.scalar() or 0
    sprint = Sprint(project_id=project_id, number=max_num + 1, goal=data.goal)
    db.add(sprint)
    await db.commit()
    await db.refresh(sprint)
    return SprintResponse(
        id=sprint.id, project_id=sprint.project_id, number=sprint.number, goal=sprint.goal,
        status=sprint.status, started_at=None, completed_at=None,
        created_at=sprint.created_at.isoformat(),
    )


@router.put("/api/sprints/{sprint_id}/start", response_model=SprintResponse)
async def start_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != "planning":
        raise HTTPException(status_code=400, detail="Sprint must be in planning status")
    sprint.status = "active"
    sprint.started_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(sprint)
    return SprintResponse(
        id=sprint.id, project_id=sprint.project_id, number=sprint.number, goal=sprint.goal,
        status=sprint.status, started_at=sprint.started_at.isoformat() if sprint.started_at else None,
        completed_at=None, created_at=sprint.created_at.isoformat(),
    )


@router.put("/api/sprints/{sprint_id}/complete", response_model=SprintResponse)
async def complete_sprint(sprint_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    if sprint.status != "active":
        raise HTTPException(status_code=400, detail="Sprint must be active")
    sprint.status = "completed"
    sprint.completed_at = datetime.now(UTC)
    # Move incomplete items back to backlog
    items_result = await db.execute(
        select(SprintItem).where(SprintItem.sprint_id == sprint_id, SprintItem.board_status != "done")
    )
    for si in items_result.scalars().all():
        bi_result = await db.execute(select(BacklogItem).where(BacklogItem.id == si.backlog_item_id))
        bi = bi_result.scalar_one_or_none()
        if bi:
            bi.status = "ready"
    # Mark done items
    done_result = await db.execute(
        select(SprintItem).where(SprintItem.sprint_id == sprint_id, SprintItem.board_status == "done")
    )
    for si in done_result.scalars().all():
        bi_result = await db.execute(select(BacklogItem).where(BacklogItem.id == si.backlog_item_id))
        bi = bi_result.scalar_one_or_none()
        if bi:
            bi.status = "done"
    await db.commit()
    await db.refresh(sprint)
    return SprintResponse(
        id=sprint.id, project_id=sprint.project_id, number=sprint.number, goal=sprint.goal,
        status=sprint.status,
        started_at=sprint.started_at.isoformat() if sprint.started_at else None,
        completed_at=sprint.completed_at.isoformat() if sprint.completed_at else None,
        created_at=sprint.created_at.isoformat(),
    )


@router.post("/api/sprints/{sprint_id}/items", response_model=SprintItemResponse)
async def add_item_to_sprint(sprint_id: int, data: AddItemRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Sprint).where(Sprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")
    bi_result = await db.execute(select(BacklogItem).where(BacklogItem.id == data.backlog_item_id))
    bi = bi_result.scalar_one_or_none()
    if not bi:
        raise HTTPException(status_code=404, detail="Backlog item not found")

    order_result = await db.execute(
        select(sa_func.max(SprintItem.order)).where(SprintItem.sprint_id == sprint_id)
    )
    max_order = order_result.scalar() or 0

    si = SprintItem(
        sprint_id=sprint_id, backlog_item_id=data.backlog_item_id,
        assignee_role=data.assignee_role, order=max_order + 1,
    )
    db.add(si)
    bi.status = "in_sprint"
    await db.commit()
    await db.refresh(si)
    return SprintItemResponse(
        id=si.id, sprint_id=si.sprint_id, backlog_item_id=si.backlog_item_id,
        assignee_role=si.assignee_role, board_status=si.board_status, order=si.order,
    )


@router.delete("/api/sprints/{sprint_id}/items/{item_id}")
async def remove_item_from_sprint(sprint_id: int, item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SprintItem).where(SprintItem.id == item_id, SprintItem.sprint_id == sprint_id)
    )
    si = result.scalar_one_or_none()
    if not si:
        raise HTTPException(status_code=404, detail="Sprint item not found")
    bi_result = await db.execute(select(BacklogItem).where(BacklogItem.id == si.backlog_item_id))
    bi = bi_result.scalar_one_or_none()
    if bi:
        bi.status = "ready"
    await db.delete(si)
    await db.commit()
    return {"ok": True}
