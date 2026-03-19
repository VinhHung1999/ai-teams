"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Badge } from "@/components/ui/badge";
import type { BoardItem } from "@/lib/types";

const priorityConfig: Record<string, { color: string; bg: string }> = {
  P0: { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  P1: { color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30" },
  P2: { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  P3: { color: "text-gray-400", bg: "bg-gray-500/15 border-gray-500/30" },
};

const roleConfig: Record<string, { color: string; bg: string }> = {
  BE: { color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  FE: { color: "text-purple-300", bg: "bg-purple-500/15 border-purple-500/30" },
  QA: { color: "text-yellow-300", bg: "bg-yellow-500/15 border-yellow-500/30" },
  TL: { color: "text-blue-300", bg: "bg-blue-500/15 border-blue-500/30" },
  PO: { color: "text-pink-300", bg: "bg-pink-500/15 border-pink-500/30" },
  SM: { color: "text-cyan-300", bg: "bg-cyan-500/15 border-cyan-500/30" },
};

interface TaskCardProps {
  item: BoardItem;
  onClick?: () => void;
}

export function TaskCard({ item, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { type: "task", item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityConfig[item.priority] || priorityConfig.P3;
  const role = item.assignee_role ? roleConfig[item.assignee_role] || roleConfig.BE : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group relative rounded-lg border border-border/60 bg-card p-3
        cursor-grab active:cursor-grabbing
        hover:border-border hover:bg-card/80
        transition-all duration-150
        ${isDragging ? "opacity-40 scale-95" : ""}
      `}
    >
      {/* Priority indicator line */}
      <div
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${
          item.priority === "P0" ? "bg-red-500" :
          item.priority === "P1" ? "bg-amber-500" :
          item.priority === "P2" ? "bg-blue-500" : "bg-gray-500"
        }`}
      />

      <div className="pl-2">
        {/* Title */}
        <p className="text-[13px] font-medium leading-snug text-foreground/90">
          {item.title}
        </p>

        {/* Description */}
        {item.description && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/50 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-[18px] font-mono font-medium border ${priority.bg} ${priority.color}`}
          >
            {item.priority}
          </Badge>

          {role && item.assignee_role && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-[18px] font-mono font-medium border ${role.bg} ${role.color}`}
            >
              {item.assignee_role}
            </Badge>
          )}

          {item.story_points !== null && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 bg-muted/50 rounded px-1.5 py-0.5">
              {item.story_points}sp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function TaskCardOverlay({ item }: { item: BoardItem }) {
  const priority = priorityConfig[item.priority] || priorityConfig.P3;
  const role = item.assignee_role ? roleConfig[item.assignee_role] || roleConfig.BE : null;

  return (
    <div className="drag-overlay rounded-lg border border-primary/30 bg-card p-3 w-[260px]">
      <div
        className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-full ${
          item.priority === "P0" ? "bg-red-500" :
          item.priority === "P1" ? "bg-amber-500" :
          item.priority === "P2" ? "bg-blue-500" : "bg-gray-500"
        }`}
      />
      <div className="pl-2">
        <p className="text-[13px] font-medium leading-snug text-foreground/90">
          {item.title}
        </p>
        {item.description && (
          <p className="text-[11px] leading-relaxed text-muted-foreground/50 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-[18px] font-mono font-medium border ${priority.bg} ${priority.color}`}
          >
            {item.priority}
          </Badge>
          {role && item.assignee_role && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-[18px] font-mono font-medium border ${role.bg} ${role.color}`}
            >
              {item.assignee_role}
            </Badge>
          )}
          {item.story_points !== null && (
            <span className="ml-auto text-[10px] font-mono text-muted-foreground/70 bg-muted/50 rounded px-1.5 py-0.5">
              {item.story_points}sp
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
