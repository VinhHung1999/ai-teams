"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCorners,
  type CollisionDetection,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { BoardColumn } from "@/components/board/BoardColumn";
import { TaskCardOverlay } from "@/components/board/TaskCard";
import { TaskDetail } from "@/components/board/TaskDetail";
import { BacklogCard, BacklogCardOverlay } from "@/components/board/BacklogCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  Project,
  Sprint,
  Board,
  BacklogItem,
  BoardItem,
  BoardColumn as BoardColumnType,
} from "@/lib/types";
import { BOARD_COLUMNS, PRIORITIES, ROLES } from "@/lib/types";
import { api } from "@/lib/api";

/* ─── Droppable wrapper for planning sprint sections ─── */
function DroppableSprintZone({
  sprintId,
  children,
}: {
  sprintId: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sprint-${sprintId}`,
    data: { type: "sprint-zone", sprintId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] rounded-lg border border-dashed transition-all duration-200 ${
        isOver
          ? "border-primary/50 bg-primary/5"
          : "border-border/30 bg-transparent"
      }`}
    >
      {children}
    </div>
  );
}

/* ─── Droppable wrapper for the backlog section ─── */
function DroppableBacklogZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "backlog",
    data: { type: "backlog-zone" },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[80px] transition-all duration-200 ${
        isOver ? "bg-primary/5 rounded-lg" : ""
      }`}
    >
      {children}
    </div>
  );
}

/* ─── Create Task Dialog ─── */
function CreateTaskDialog({
  open,
  onOpenChange,
  projectId,
  targetSprintId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  targetSprintId: number | null;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("P2");
  const [points, setPoints] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const backlogItem = await api.createBacklogItem(projectId, {
        title: title.trim(),
        description: desc.trim() || undefined,
        priority,
        story_points: points ? Number(points) : undefined,
      });
      if (targetSprintId) {
        await api.addItemToSprint(targetSprintId, {
          backlog_item_id: backlogItem.id,
          assignee_role: assignRole || undefined,
        });
      }
      setTitle("");
      setDesc("");
      setPriority("P2");
      setPoints("");
      setAssignRole("");
      onOpenChange(false);
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const priorityColor: Record<string, string> = {
    P0: "border-red-500/40 text-red-400 bg-red-500/10",
    P1: "border-amber-500/40 text-amber-400 bg-amber-500/10",
    P2: "border-blue-500/40 text-blue-400 bg-blue-500/10",
    P3: "border-gray-500/40 text-gray-400 bg-gray-500/10",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[460px] bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {targetSprintId ? "New Task" : "New Backlog Item"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Title *
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. User authentication"
              className="mt-1 text-sm font-mono bg-muted/30"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div>
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Description
            </label>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Optional description"
              className="mt-1 text-sm font-mono bg-muted/30 min-h-[60px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                Priority
              </label>
              <div className="flex gap-1 mt-1">
                {PRIORITIES.map((p) => (
                  <Button
                    key={p}
                    variant={priority === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriority(p)}
                    className={`text-[10px] h-7 px-2 font-mono ${
                      priority !== p ? priorityColor[p] : ""
                    }`}
                  >
                    {p}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                Points
              </label>
              <Input
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                type="number"
                placeholder="5"
                className="mt-1 text-sm font-mono bg-muted/30"
              />
            </div>
          </div>
          {targetSprintId && (
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                Assign Role
              </label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {ROLES.map((r) => (
                  <Button
                    key={r}
                    variant={assignRole === r ? "default" : "outline"}
                    size="sm"
                    onClick={() => setAssignRole(assignRole === r ? "" : r)}
                    className="text-[10px] h-7 px-2 font-mono"
                  >
                    {r}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            size="sm"
            className="w-full font-mono text-xs"
          >
            {targetSprintId ? "Create & Add to Sprint" : "Add to Backlog"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Section header component ─── */
function SectionHeader({
  title,
  subtitle,
  count,
  dotColor,
  pulse,
  actions,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  dotColor?: string;
  pulse?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2.5 min-w-0">
        {dotColor && (
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor} shrink-0 ${
              pulse ? "status-pulse" : ""
            }`}
          />
        )}
        <h2 className="text-sm font-semibold text-foreground/85">{title}</h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground/50 truncate hidden sm:inline">
            {subtitle}
          </span>
        )}
        {count !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/60 rounded-full w-5 h-5 flex items-center justify-center shrink-0">
            {count}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/* ─── Draggable card for planning sprint items ─── */
function PlanningCard({
  item,
  onClick,
}: {
  item: BoardItem;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `planning-${item.id}`,
    data: { type: "task", item },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const priorityBg =
    item.priority === "P0"
      ? "bg-red-500"
      : item.priority === "P1"
      ? "bg-amber-500"
      : item.priority === "P2"
      ? "bg-blue-500"
      : "bg-gray-500";

  const priorityConfig: Record<string, { color: string; bg: string }> = {
    P0: { color: "text-red-400", bg: "bg-red-500/12 border-red-500/25" },
    P1: { color: "text-amber-400", bg: "bg-amber-500/12 border-amber-500/25" },
    P2: { color: "text-blue-400", bg: "bg-blue-500/12 border-blue-500/25" },
    P3: { color: "text-gray-400", bg: "bg-gray-500/12 border-gray-500/25" },
  };

  const roleConfig: Record<string, { color: string; bg: string }> = {
    BE: { color: "text-emerald-300", bg: "bg-emerald-500/12 border-emerald-500/25" },
    FE: { color: "text-violet-300", bg: "bg-violet-500/12 border-violet-500/25" },
    QA: { color: "text-amber-300", bg: "bg-amber-500/12 border-amber-500/25" },
    TL: { color: "text-blue-300", bg: "bg-blue-500/12 border-blue-500/25" },
    PO: { color: "text-pink-300", bg: "bg-pink-500/12 border-pink-500/25" },
    SM: { color: "text-cyan-300", bg: "bg-cyan-500/12 border-cyan-500/25" },
  };

  const priority = priorityConfig[item.priority] || priorityConfig.P3;
  const role = item.assignee_role
    ? roleConfig[item.assignee_role] || roleConfig.BE
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`relative rounded-lg border border-border/50 bg-card p-3 cursor-grab active:cursor-grabbing hover:border-border/80 hover:shadow-sm hover:shadow-black/10 transition-colors duration-150 ${isDragging ? "opacity-30 scale-[0.98]" : ""}`}
    >
      <div className={`absolute left-0 top-3 bottom-3 w-[2.5px] rounded-full ${priorityBg}`} />
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
          {role && item.assignee_role && (
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 h-[17px] font-mono font-medium border ${role.bg} ${role.color}`}
            >
              {item.assignee_role}
            </Badge>
          )}
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

/* ─── Collapsible completed sprint row ─── */
function CompletedSprintRow({
  sprint,
  board,
  onDelete,
}: {
  sprint: Sprint;
  board: Board | undefined;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = board
    ? BOARD_COLUMNS.flatMap((col) => board[col.key] || [])
    : [];

  return (
    <div className="rounded-xl border border-border/30 bg-muted/10 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className={`text-[10px] text-muted-foreground/40 transition-transform ${expanded ? "rotate-90" : ""}`}>
            &#9656;
          </span>
          <span className="text-emerald-400/40 text-[10px]">&#10003;</span>
          <span className="text-sm font-medium text-foreground/45">
            Sprint {sprint.number}
          </span>
          {sprint.goal && (
            <span className="text-xs text-muted-foreground/30 truncate">
              {sprint.goal}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-muted-foreground/25">
            {items.length} items
          </span>
          {sprint.completed_at && (
            <span className="text-[10px] font-mono text-muted-foreground/25">
              {new Date(sprint.completed_at).toLocaleDateString()}
            </span>
          )}
          <span
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-[10px] px-1.5 py-0.5 rounded font-mono text-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            Del
          </span>
        </div>
      </button>
      {expanded && items.length > 0 && (
        <div className="px-4 pb-4 pt-3 lg:overflow-x-auto border-t border-border/20 mt-1">
          <div className="flex flex-col lg:flex-row gap-2 min-w-0">
            {items.map((item) => (
              <div key={item.id} className="lg:w-[220px] lg:shrink-0">
                <div className="relative rounded-lg border border-border/25 bg-card/40 p-2.5">
                  <div
                    className={`absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full ${
                      item.priority === "P0" ? "bg-red-500/40" :
                      item.priority === "P1" ? "bg-amber-500/40" :
                      item.priority === "P2" ? "bg-blue-500/40" : "bg-gray-500/40"
                    }`}
                  />
                  <div className="pl-2">
                    <p className="text-[11px] font-medium text-foreground/50 truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[8px] font-mono text-muted-foreground/30 border border-border/25 rounded px-1">
                        {item.priority}
                      </span>
                      {item.assignee_role && (
                        <span className="text-[8px] font-mono text-muted-foreground/30 border border-border/25 rounded px-1">
                          {item.assignee_role}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main ProjectDashboard Component ─── */
export function ProjectDashboard({ projectId }: { projectId: number }) {
  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);
  const [planningBoards, setPlanningBoards] = useState<
    Record<number, Board>
  >({});
  const [completedBoards, setCompletedBoards] = useState<
    Record<number, Board>
  >({});
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintGoal, setSprintGoal] = useState("");
  const [createTaskTarget, setCreateTaskTarget] = useState<{
    open: boolean;
    sprintId: number | null;
  }>({ open: false, sprintId: null });

  // DnD state
  const [activeItem, setActiveItem] = useState<BoardItem | null>(null);
  const [activeBacklogItem, setActiveBacklogItem] =
    useState<BacklogItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Task detail
  const [detailItem, setDetailItem] = useState<BoardItem | null>(null);

  const activeSprint = sprints.find((s) => s.status === "active") || null;
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const completedSprints = sprints.filter((s) => s.status === "completed");

  const filteredBacklog = useMemo(
    () => backlogItems.filter((i) => i.status !== "in_sprint" && i.status !== "done"),
    [backlogItems]
  );

  /* ─── Data fetching ─── */
  const fetchData = useCallback(async () => {
    try {
      const data = await api.getDashboard(projectId);
      setProject(data.project);
      setSprints(data.sprints);
      setBacklogItems(data.backlog);

      const active = data.sprints.find((s) => s.status === "active");
      if (active && data.boards[String(active.id)]) {
        setActiveBoard(data.boards[String(active.id)]);
      } else {
        setActiveBoard(null);
      }

      const planBoards: Record<number, Board> = {};
      const compBoards: Record<number, Board> = {};
      for (const s of data.sprints) {
        const board = data.boards[String(s.id)];
        if (!board) continue;
        if (s.status === "planning") planBoards[s.id] = board;
        if (s.status === "completed") compBoards[s.id] = board;
      }
      setPlanningBoards(planBoards);
      setCompletedBoards(compBoards);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Auto-refresh all dashboard data every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isDragging) return;
      try {
        const data = await api.getDashboard(projectId);
        setProject(data.project);
        setSprints(data.sprints);
        setBacklogItems(data.backlog);

        const active = data.sprints.find((s) => s.status === "active");
        if (active && data.boards[String(active.id)]) {
          setActiveBoard(data.boards[String(active.id)]);
        } else {
          setActiveBoard(null);
        }

        const planBoards: Record<number, Board> = {};
        const compBoards: Record<number, Board> = {};
        for (const s of data.sprints) {
          const board = data.boards[String(s.id)];
          if (!board) continue;
          if (s.status === "planning") planBoards[s.id] = board;
          if (s.status === "completed") compBoards[s.id] = board;
        }
        setPlanningBoards(planBoards);
        setCompletedBoards(compBoards);
      } catch {
        // ignore
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId, isDragging]);

  /* ─── Sprint actions ─── */
  const handleStartSprint = async (sprintId: number) => {
    try {
      await api.startSprint(sprintId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCompleteSprint = async (sprintId: number) => {
    if (activeBoard) {
      const incomplete = BOARD_COLUMNS
        .filter((c) => c.key !== "done")
        .reduce((sum, c) => sum + (activeBoard[c.key]?.length || 0), 0);
      if (incomplete > 0) {
        if (!confirm(`${incomplete} item(s) not done. They will return to backlog. Complete sprint?`)) return;
      } else {
        if (!confirm("Complete this sprint?")) return;
      }
    }
    try {
      await api.completeSprint(sprintId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSprint = async (sprintId: number) => {
    if (!confirm("Delete this sprint?")) return;
    try {
      await api.deleteSprint(sprintId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateSprint = async () => {
    try {
      await api.createSprint(projectId, { goal: sprintGoal || undefined });
      setSprintGoal("");
      setShowCreateSprint(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBacklogItem = async (itemId: number) => {
    if (!confirm("Delete this backlog item?")) return;
    try {
      await api.deleteBacklogItem(itemId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  /* ─── DnD sensors ─── */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  /* ─── Custom collision ─── */
  const customCollision: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return closestCorners(args);
  }, []);

  /* ─── DnD: find which column a board item is in ─── */
  const findActiveSprintColumn = useCallback(
    (id: string | number): BoardColumnType | null => {
      if (!activeBoard) return null;
      const colId = String(id).replace("col-", "");
      if (BOARD_COLUMNS.some((c) => c.key === colId))
        return colId as BoardColumnType;
      if (BOARD_COLUMNS.some((c) => c.key === id))
        return id as BoardColumnType;
      for (const col of BOARD_COLUMNS) {
        if (activeBoard[col.key].some((item) => item.id === id))
          return col.key;
      }
      return null;
    },
    [activeBoard]
  );

  /* ─── DnD handlers ─── */
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setIsDragging(true);

    const data = active.data.current;
    if (data?.type === "backlog") {
      setActiveBacklogItem(data.item as BacklogItem);
      setActiveItem(null);
    } else if (data?.type === "task") {
      setActiveItem(data.item as BoardItem);
      setActiveBacklogItem(null);
    } else {
      const col = findActiveSprintColumn(active.id);
      if (col && activeBoard) {
        const item = activeBoard[col].find((i) => i.id === active.id);
        if (item) {
          setActiveItem(item);
          setActiveBacklogItem(null);
        }
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const data = active.data.current;

    if (data?.type === "task" && activeBoard) {
      const activeCol = findActiveSprintColumn(active.id);
      const overId = String(over.id).startsWith("col-")
        ? String(over.id).replace("col-", "")
        : over.id;
      const overCol = findActiveSprintColumn(overId);

      if (!activeCol || !overCol || activeCol === overCol) return;

      setActiveBoard((prev) => {
        if (!prev) return prev;
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
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setActiveBacklogItem(null);

    if (!over) {
      setIsDragging(false);
      return;
    }

    const data = active.data.current;
    const overIdStr = String(over.id);

    // Case 1: Backlog item dropped on an active sprint column
    if (data?.type === "backlog") {
      const backlogItem = data.item as BacklogItem;

      if (overIdStr.startsWith("col-") || BOARD_COLUMNS.some((c) => c.key === overIdStr)) {
        if (activeSprint) {
          try {
            await api.addItemToSprint(activeSprint.id, {
              backlog_item_id: backlogItem.id,
            });
            fetchData();
          } catch (e) {
            console.error(e);
          }
        }
      } else if (overIdStr.startsWith("sprint-")) {
        const sprintId = Number(overIdStr.replace("sprint-", ""));
        try {
          await api.addItemToSprint(sprintId, {
            backlog_item_id: backlogItem.id,
          });
          fetchData();
        } catch (e) {
          console.error(e);
        }
      }
      setIsDragging(false);
      return;
    }

    // Case 2: Board/sprint item dragged
    if (data?.type === "task") {
      const boardItem = data.item as BoardItem;

      if (overIdStr === "backlog" || over.data.current?.type === "backlog-zone" || overIdStr.startsWith("backlog-")) {
        try {
          await api.removeItemFromSprint(boardItem.sprint_id, boardItem.id);
          fetchData();
        } catch (e) {
          console.error(e);
        }
        setIsDragging(false);
        return;
      }

      if (overIdStr.startsWith("sprint-")) {
        const targetSprintId = Number(overIdStr.replace("sprint-", ""));
        if (targetSprintId !== boardItem.sprint_id) {
          try {
            await api.removeItemFromSprint(boardItem.sprint_id, boardItem.id);
            await api.addItemToSprint(targetSprintId, {
              backlog_item_id: boardItem.backlog_item_id,
            });
            fetchData();
          } catch (e) {
            console.error(e);
          }
        }
        setIsDragging(false);
        return;
      }

      if (activeBoard) {
        const activeCol = findActiveSprintColumn(active.id);
        const overCol = overIdStr.startsWith("col-")
          ? (overIdStr.replace("col-", "") as BoardColumnType)
          : findActiveSprintColumn(over.id);

        if (activeCol && overCol) {
          if (activeCol === overCol) {
            const items = activeBoard[activeCol];
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over.id);
            if (oldIndex !== newIndex && newIndex >= 0) {
              setActiveBoard((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  [activeCol]: arrayMove(prev[activeCol], oldIndex, newIndex),
                };
              });
            }
          }

          try {
            const col = findActiveSprintColumn(active.id);
            if (col && activeBoard) {
              const itemIndex = activeBoard[col].findIndex(
                (i) => i.id === active.id
              );
              await api.moveItem(Number(active.id), {
                board_status: col,
                order: itemIndex >= 0 ? itemIndex : 0,
              });
            }
            fetchData();
          } catch (e) {
            console.error("Failed to move item:", e);
            fetchData();
          }
        }
      }
    }

    setIsDragging(false);
  };

  /* ─── Compute total items for active sprint ─── */
  const activeSprintItemCount = useMemo(() => {
    if (!activeBoard) return 0;
    return BOARD_COLUMNS.reduce(
      (sum, col) => sum + (activeBoard[col.key]?.length || 0),
      0
    );
  }, [activeBoard]);

  /* ─── Planning sprint item counts ─── */
  const planningSprintItemCount = useCallback(
    (sprintId: number) => {
      const board = planningBoards[sprintId];
      if (!board) return 0;
      return BOARD_COLUMNS.reduce(
        (sum, col) => sum + (board[col.key]?.length || 0),
        0
      );
    },
    [planningBoards]
  );

  /* ─── Get all items for a planning sprint as a flat list ─── */
  const getPlanningSprintItems = useCallback(
    (sprintId: number): BoardItem[] => {
      const board = planningBoards[sprintId];
      if (!board) return [];
      return BOARD_COLUMNS.flatMap((col) => board[col.key] || []);
    },
    [planningBoards]
  );

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-destructive">
          Project not found
        </span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-8">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold text-foreground/70">{project?.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateSprint(true)}
              className="text-[11px] h-7 px-3 font-mono"
            >
              + New Sprint
            </Button>
          </div>

          {/* ════════════════════════════════════════════
              Section 1: Active Sprint
              ════════════════════════════════════════════ */}
          {activeSprint && activeBoard ? (
            <section>
              <SectionHeader
                title={`Sprint ${activeSprint.number}`}
                subtitle={activeSprint.goal || undefined}
                count={activeSprintItemCount}
                dotColor="bg-primary"
                pulse
                actions={
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCreateTaskTarget({
                          open: true,
                          sprintId: activeSprint.id,
                        })
                      }
                      className="text-[11px] h-7 px-3 font-mono"
                    >
                      + Task
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleCompleteSprint(activeSprint.id)
                      }
                      className="text-[11px] h-7 px-3"
                    >
                      Complete Sprint
                    </Button>
                  </>
                }
              />
              <div className="flex flex-col lg:flex-row gap-3 overflow-x-auto pb-2 px-1">
                {BOARD_COLUMNS.map((col) => (
                  <BoardColumn
                    key={col.key}
                    id={col.key}
                    label={col.label}
                    items={activeBoard[col.key]}
                    onTaskClick={setDetailItem}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section>
              <div className="flex flex-col items-center justify-center h-[200px] gap-4 rounded-xl border border-dashed border-border/40 bg-muted/10">
                <div className="w-14 h-14 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-center">
                  <span className="text-2xl text-muted-foreground/20">
                    +
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground/60">
                    No active sprint
                  </p>
                  <p className="text-xs text-muted-foreground/35 mt-1 max-w-[260px]">
                    Create a sprint, add backlog items, then start it
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════
              Section 2: Planning Sprints
              ════════════════════════════════════════════ */}
          {planningSprints.length > 0 && (
            <section className="space-y-6">
              {planningSprints.map((sprint) => {
                const items = getPlanningSprintItems(sprint.id);
                return (
                  <div key={sprint.id}>
                    <SectionHeader
                      title={`Sprint ${sprint.number}`}
                      subtitle={sprint.goal || undefined}
                      count={planningSprintItemCount(sprint.id)}
                      dotColor="bg-slate-400"
                      actions={
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setCreateTaskTarget({
                                open: true,
                                sprintId: sprint.id,
                              })
                            }
                            className="text-[11px] h-7 px-3 font-mono"
                          >
                            + Task
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStartSprint(sprint.id)}
                            className="text-[11px] h-7 px-3 font-mono border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            Start
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSprint(sprint.id)}
                            className="text-[11px] h-7 px-2 font-mono text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                          >
                            Del
                          </Button>
                        </>
                      }
                    />
                    <DroppableSprintZone sprintId={sprint.id}>
                      {items.length === 0 ? (
                        <div className="flex items-center justify-center h-[80px]">
                          <span className="text-[11px] text-muted-foreground/30">
                            Drop backlog items here or add tasks
                          </span>
                        </div>
                      ) : (
                        <div className="p-2 lg:overflow-x-auto">
                          <div className="flex flex-col lg:flex-row gap-2 min-w-0">
                            {items.map((item) => (
                              <div
                                key={item.id}
                                className="lg:w-[256px] lg:shrink-0"
                              >
                                <PlanningCard
                                  item={item}
                                  onClick={() => setDetailItem(item)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </DroppableSprintZone>
                  </div>
                );
              })}
            </section>
          )}

          {/* ════════════════════════════════════════════
              Section 3: Backlog
              ════════════════════════════════════════════ */}
          <section>
            <SectionHeader
              title="Backlog"
              count={filteredBacklog.length}
              dotColor="bg-muted-foreground/40"
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCreateTaskTarget({ open: true, sprintId: null })
                  }
                  className="text-[11px] h-7 px-3 font-mono"
                >
                  + Task
                </Button>
              }
            />
            <DroppableBacklogZone>
              {filteredBacklog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[100px] rounded-xl border border-dashed border-border/30">
                  <p className="font-mono text-[11px] text-muted-foreground/30">
                    Empty backlog
                  </p>
                </div>
              ) : (
                <div className="lg:overflow-x-auto pb-2">
                  <div className="flex flex-col lg:flex-row gap-2 min-w-0">
                    {filteredBacklog.map((item) => (
                      <div key={item.id} className="lg:w-[256px] lg:shrink-0">
                        <BacklogCard
                          item={item}
                          onClick={() => handleDeleteBacklogItem(item.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DroppableBacklogZone>
          </section>

          {/* ════════════════════════════════════════════
              Section 4: Completed Sprints (collapsible)
              ════════════════════════════════════════════ */}
          {completedSprints.length > 0 && (
            <section className="space-y-2">
              {completedSprints.map((sprint) => (
                <CompletedSprintRow
                  key={sprint.id}
                  sprint={sprint}
                  board={completedBoards[sprint.id]}
                  onDelete={() => handleDeleteSprint(sprint.id)}
                />
              ))}
            </section>
          )}
        </main>

        {/* Drag overlay */}
        <DragOverlay>
          {activeItem ? (
            <TaskCardOverlay item={activeItem} />
          ) : activeBacklogItem ? (
            <BacklogCardOverlay item={activeBacklogItem} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task detail dialog */}
      <TaskDetail
        item={detailItem}
        open={!!detailItem}
        onClose={() => setDetailItem(null)}
        onUpdate={fetchData}
      />

      {/* Create sprint dialog */}
      <Dialog open={showCreateSprint} onOpenChange={setShowCreateSprint}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              New Sprint
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Sprint goal (optional)"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
              className="text-sm font-mono bg-muted/30"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSprint()}
            />
            <Button
              onClick={handleCreateSprint}
              size="sm"
              className="w-full font-mono text-xs"
            >
              Create Sprint
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create task dialog */}
      <CreateTaskDialog
        open={createTaskTarget.open}
        onOpenChange={(open) =>
          setCreateTaskTarget((prev) => ({ ...prev, open }))
        }
        projectId={projectId}
        targetSprintId={createTaskTarget.sprintId}
        onCreated={fetchData}
      />
    </div>
  );
}
