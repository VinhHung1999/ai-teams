from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.backlog_item import BacklogItem

router = APIRouter(tags=["backlog"])


class BacklogItemCreate(BaseModel):
    title: str
    description: str | None = None
    priority: str = "P2"
    story_points: int | None = None
    acceptance_criteria: dict | None = None


class BacklogItemUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: str | None = None
    story_points: int | None = None
    acceptance_criteria: dict | None = None
    status: str | None = None


class BacklogItemResponse(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    priority: str
    story_points: int | None
    acceptance_criteria: dict | None
    status: str
    order: int
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ReorderRequest(BaseModel):
    item_ids: list[int]


@router.get("/api/projects/{project_id}/backlog", response_model=list[BacklogItemResponse])
async def list_backlog(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacklogItem).where(BacklogItem.project_id == project_id).order_by(BacklogItem.order)
    )
    return [
        BacklogItemResponse(
            id=i.id, project_id=i.project_id, title=i.title, description=i.description,
            priority=i.priority, story_points=i.story_points,
            acceptance_criteria=i.acceptance_criteria, status=i.status, order=i.order,
            created_at=i.created_at.isoformat(), updated_at=i.updated_at.isoformat(),
        )
        for i in result.scalars().all()
    ]


@router.post("/api/projects/{project_id}/backlog", response_model=BacklogItemResponse)
async def create_backlog_item(project_id: int, data: BacklogItemCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BacklogItem.order)
        .where(BacklogItem.project_id == project_id)
        .order_by(BacklogItem.order.desc())
    )
    max_order = result.scalar() or 0

    item = BacklogItem(
        project_id=project_id, title=data.title, description=data.description,
        priority=data.priority, story_points=data.story_points,
        acceptance_criteria=data.acceptance_criteria, order=max_order + 1,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return BacklogItemResponse(
        id=item.id, project_id=item.project_id, title=item.title, description=item.description,
        priority=item.priority, story_points=item.story_points,
        acceptance_criteria=item.acceptance_criteria, status=item.status, order=item.order,
        created_at=item.created_at.isoformat(), updated_at=item.updated_at.isoformat(),
    )


@router.put("/api/backlog/{item_id}", response_model=BacklogItemResponse)
async def update_backlog_item(item_id: int, data: BacklogItemUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BacklogItem).where(BacklogItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Backlog item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return BacklogItemResponse(
        id=item.id, project_id=item.project_id, title=item.title, description=item.description,
        priority=item.priority, story_points=item.story_points,
        acceptance_criteria=item.acceptance_criteria, status=item.status, order=item.order,
        created_at=item.created_at.isoformat(), updated_at=item.updated_at.isoformat(),
    )


@router.delete("/api/backlog/{item_id}")
async def delete_backlog_item(item_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BacklogItem).where(BacklogItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Backlog item not found")
    await db.delete(item)
    await db.commit()
    return {"ok": True}


@router.put("/api/projects/{project_id}/backlog/reorder")
async def reorder_backlog(project_id: int, data: ReorderRequest, db: AsyncSession = Depends(get_db)):
    for idx, item_id in enumerate(data.item_ids):
        result = await db.execute(
            select(BacklogItem).where(BacklogItem.id == item_id, BacklogItem.project_id == project_id)
        )
        item = result.scalar_one_or_none()
        if item:
            item.order = idx
    await db.commit()
    return {"ok": True}
