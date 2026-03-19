"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskCard } from "./TaskCard";
import type { BoardItem, BoardColumn as BoardColumnType } from "@/lib/types";

const columnStyle: Record<BoardColumnType, { accent: string; glow: string; icon: string }> = {
  todo: { accent: "text-slate-400", glow: "shadow-slate-500/10", icon: "///" },
  in_progress: { accent: "text-blue-400", glow: "shadow-blue-500/10", icon: ">>>" },
  in_review: { accent: "text-purple-400", glow: "shadow-purple-500/10", icon: "***" },
  testing: { accent: "text-yellow-400", glow: "shadow-yellow-500/10", icon: "~~~" },
  done: { accent: "text-emerald-400", glow: "shadow-emerald-500/10", icon: "+++" },
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
        flex flex-col min-w-[280px] w-[280px] rounded-xl
        bg-muted/30 border border-border/40
        transition-all duration-200
        ${isOver ? "column-drag-over border-primary/30" : ""}
      `}
    >
      {/* Column header */}
      <div className="px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-[10px] ${style.accent} opacity-60`}>
              {style.icon}
            </span>
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${style.accent}`}>
              {label}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {totalPoints > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {totalPoints}sp
              </span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted/50 rounded-full px-2 py-0.5">
              {items.length}
            </span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-220px)]">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="p-2 space-y-2 min-h-[60px]">
            {items.length === 0 && (
              <div className="flex items-center justify-center h-[60px] rounded-lg border border-dashed border-border/30">
                <span className="text-[11px] text-muted-foreground/40 font-mono">
                  drop here
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
