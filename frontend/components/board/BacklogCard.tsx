"use client";

import { useDraggable } from "@dnd-kit/core";
import { Badge } from "@/components/ui/badge";
import type { BacklogItem } from "@/lib/types";

const priorityConfig: Record<string, { color: string; bg: string }> = {
  P0: { color: "text-red-400", bg: "bg-red-500/12 border-red-500/25" },
  P1: { color: "text-amber-400", bg: "bg-amber-500/12 border-amber-500/25" },
  P2: { color: "text-blue-400", bg: "bg-blue-500/12 border-blue-500/25" },
  P3: { color: "text-gray-400", bg: "bg-gray-500/12 border-gray-500/25" },
};

interface BacklogCardProps {
  item: BacklogItem;
  onClick?: () => void;
}

export function BacklogCard({ item, onClick }: BacklogCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `backlog-${item.id}`,
    data: { type: "backlog", item },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const priority = priorityConfig[item.priority] || priorityConfig.P3;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group relative rounded-sm border border-[#1f1f1f] bg-[#0a0a0a] p-3
        cursor-grab active:cursor-grabbing
        hover:border-emerald-500/30 hover:shadow-sm hover:shadow-black/10
        transition-colors duration-150
        ${isDragging ? "opacity-30 scale-[0.98]" : ""}
      `}
    >
      {/* Priority indicator line */}
      <div
        className={`absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full ${
          item.priority === "P0" ? "bg-red-500" :
          item.priority === "P1" ? "bg-amber-500" :
          item.priority === "P2" ? "bg-blue-500" : "bg-gray-500"
        }`}
      />

      <div className="pl-2.5">
        {/* Title */}
        <p className="text-[13px] font-medium leading-snug text-foreground/90">
          {item.title}
        </p>

        {/* Description */}
        {item.description && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/50 mt-1 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 h-[17px] font-mono font-medium border ${priority.bg} ${priority.color}`}
          >
            {item.priority}
          </Badge>

          {item.story_points !== null && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">
              {item.story_points}sp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function BacklogCardOverlay({ item }: { item: BacklogItem }) {
  const priority = priorityConfig[item.priority] || priorityConfig.P3;

  return (
    <div className="drag-overlay rounded-sm border border-primary/30 bg-[#0a0a0a] p-3 w-[256px]">
      <div
        className={`absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full ${
          item.priority === "P0" ? "bg-red-500" :
          item.priority === "P1" ? "bg-amber-500" :
          item.priority === "P2" ? "bg-blue-500" : "bg-gray-500"
        }`}
      />
      <div className="pl-2.5">
        <p className="text-[13px] font-medium leading-snug text-foreground/90">
          {item.title}
        </p>
        {item.description && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/50 mt-1 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
          <Badge
            variant="outline"
            className={`text-[9px] px-1.5 py-0 h-[17px] font-mono font-medium border ${priority.bg} ${priority.color}`}
          >
            {item.priority}
          </Badge>
          {item.story_points !== null && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/50">
              {item.story_points}sp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
