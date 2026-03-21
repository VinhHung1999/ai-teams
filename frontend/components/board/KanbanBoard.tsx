"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { BoardColumn } from "./BoardColumn";
import { TaskCardOverlay } from "./TaskCard";
import { TaskDetail } from "./TaskDetail";
import { api } from "@/lib/api";
import type { Board, BoardItem, BoardColumn as BoardColumnType } from "@/lib/types";
import { BOARD_COLUMNS } from "@/lib/types";

interface KanbanBoardProps {
  board: Board;
  sprintId: number;
  onRefresh: () => void;
}

export function KanbanBoard({ board, sprintId, onRefresh }: KanbanBoardProps) {
  const [columns, setColumns] = useState<Board>(board);
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  const [detailItem, setDetailItem] = useState<BoardItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync board prop changes — but not while dragging
  if (board !== columns && !activeItem && !isDragging) {
    setColumns(board);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const findColumn = useCallback(
    (id: string | number): BoardColumnType | null => {
      // Check if id is a column id
      if (BOARD_COLUMNS.some((c) => c.key === id)) return id as BoardColumnType;
      // Find which column contains this item
      for (const col of BOARD_COLUMNS) {
        if (columns[col.key].some((item) => item.id === id)) return col.key;
      }
      return null;
    },
    [columns]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setIsDragging(true);
    const col = findColumn(active.id);
    if (!col) return;
    const item = columns[col].find((i) => i.id === active.id);
    if (item) setActiveItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCol = findColumn(active.id);
    const overCol = findColumn(over.id);

    if (!activeCol || !overCol || activeCol === overCol) return;

    setColumns((prev) => {
      const activeItems = [...prev[activeCol]];
      const overItems = [...prev[overCol]];
      const activeIndex = activeItems.findIndex((i) => i.id === active.id);
      if (activeIndex === -1) return prev;

      const [movedItem] = activeItems.splice(activeIndex, 1);
      movedItem.board_status = overCol;

      const overIndex = overItems.findIndex((i) => i.id === over.id);
      if (overIndex >= 0) {
        overItems.splice(overIndex, 0, movedItem);
      } else {
        overItems.push(movedItem);
      }

      return { ...prev, [activeCol]: activeItems, [overCol]: overItems };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) { setIsDragging(false); return; }

    const activeCol = findColumn(active.id);
    const overCol = findColumn(over.id);

    if (!activeCol || !overCol) { setIsDragging(false); return; }

    if (activeCol === overCol) {
      const items = columns[activeCol];
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== newIndex) {
        setColumns((prev) => ({
          ...prev,
          [activeCol]: arrayMove(prev[activeCol], oldIndex, newIndex),
        }));
      }
    }

    // Persist to API then refresh
    try {
      const col = findColumn(active.id);
      if (col) {
        const itemIndex = columns[col].findIndex((i) => i.id === active.id);
        await api.moveItem(Number(active.id), {
          board_status: col,
          order: itemIndex >= 0 ? itemIndex : 0,
        });
      }
      onRefresh();
    } catch (e) {
      console.error("Failed to move item:", e);
      onRefresh();
    } finally {
      setIsDragging(false);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col lg:flex-row gap-3 overflow-x-auto pb-4 px-1">
          {BOARD_COLUMNS.map((col) => (
            <BoardColumn
              key={col.key}
              id={col.key}
              label={col.label}
              items={columns[col.key]}
              onTaskClick={setDetailItem}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? <TaskCardOverlay item={activeItem} /> : null}
        </DragOverlay>
      </DndContext>

      <TaskDetail
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onUpdate={onRefresh}
      />
    </>
  );
}
