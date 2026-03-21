import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.project import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("/browse-dirs")
async def browse_directories(path: str = Query(default="")):
    """List subdirectories for folder browser."""
    if not path:
        path = str(Path.home())
    target = Path(path)
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Not a directory")
    dirs = []
    try:
        for entry in sorted(target.iterdir()):
            if entry.is_dir() and not entry.name.startswith("."):
                dirs.append({"name": entry.name, "path": str(entry)})
    except PermissionError:
        pass
    return {"current": str(target), "parent": str(target.parent), "dirs": dirs}


@router.post("/mkdir")
async def create_directory(data: dict):
    """Create a new directory."""
    parent = data.get("parent", "")
    name = data.get("name", "")
    if not parent or not name:
        raise HTTPException(status_code=400, detail="parent and name required")
    target = Path(parent) / name
    if target.exists():
        raise HTTPException(status_code=400, detail="Directory already exists")
    try:
        target.mkdir(parents=True)
        return {"path": str(target)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


class ProjectCreate(BaseModel):
    name: str
    tmux_session_name: str | None = None
    working_directory: str | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    tmux_session_name: str | None
    working_directory: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ProjectResponse])
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    return [
        ProjectResponse(
            id=p.id, name=p.name, tmux_session_name=p.tmux_session_name,
            working_directory=p.working_directory, created_at=p.created_at.isoformat(),
        )
        for p in result.scalars().all()
    ]


@router.post("", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(
        name=data.name, tmux_session_name=data.tmux_session_name,
        working_directory=data.working_directory,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id, name=project.name, tmux_session_name=project.tmux_session_name,
        working_directory=project.working_directory, created_at=project.created_at.isoformat(),
    )


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse(
        id=project.id, name=project.name, tmux_session_name=project.tmux_session_name,
        working_directory=project.working_directory, created_at=project.created_at.isoformat(),
    )


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"ok": True}
