from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SprintItem(Base):
    __tablename__ = "sprint_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sprint_id: Mapped[int] = mapped_column(ForeignKey("sprints.id"))
    backlog_item_id: Mapped[int] = mapped_column(ForeignKey("backlog_items.id"))
    assignee_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    board_status: Mapped[str] = mapped_column(String(20), default="todo")
    order: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    sprint: Mapped["Sprint"] = relationship(back_populates="items")
    backlog_item: Mapped["BacklogItem"] = relationship(back_populates="sprint_items")
