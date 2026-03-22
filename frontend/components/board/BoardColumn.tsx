"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./TaskCard";
import type { BoardItem, BoardColumn as BoardColumnType } from "@/lib/types";

const columnStyle: Record<BoardColumnType, { color: string; dotColor: string }> = {
  todo: { color: "text-slate-400", dotColor: "bg-slate-400" },
  in_progress: { color: "text-blue-400", dotColor: "bg-blue-400" },
  in_review: { color: "text-violet-400", dotColor: "bg-violet-400" },
  testing: { color: "text-amber-400", dotColor: "bg-amber-400" },
  done: { color: "text-emerald-400", dotColor: "bg-emerald-400" },
};

interface BoardColumnProps {
  id: BoardColumnType;
  label: string;
  items: BoardItem[];
  onTaskClick?: (item: BoardItem) => void;
}

export function BoardColumn({ id, label, items, onTaskClick }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const style = columnStyle[id];
  const totalPoints = items.reduce((sum, i) => sum + (i.story_points || 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col w-full lg:min-w-[272px] lg:w-[272px] rounded-sm
        bg-transparent border border-[#1f1f1f]
        transition-all duration-200
        ${isOver ? "column-drag-over border-primary/40" : ""}
      `}
    >
      {/* Column header */}
      <div className="px-3.5 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${style.dotColor}`} />
            <h3 className={`text-[11px] font-semibold uppercase tracking-wider ${style.color}`}>
              {label}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {totalPoints > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {totalPoints}sp
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/60 rounded-full w-5 h-5 flex items-center justify-center">
              {items.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-240px)]">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-2 space-y-1.5 min-h-[60px]">
            {items.length === 0 && (
              <div className="flex items-center justify-center h-[60px] rounded-lg border border-dashed border-border/30">
                <span className="text-[11px] text-muted-foreground/30">
                  Drop here
                </span>
              </div>
            )}
            {items.map((item) => (
              <TaskCard
                key={item.id}
                item={item}
                onClick={() => onTaskClick?.(item)}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}
