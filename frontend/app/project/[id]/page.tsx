"use client";

import { useEffect, useState, useCallback, use } from "react";
import { Sidebar } from "@/components/Sidebar";
import { KanbanBoard } from "@/components/board/KanbanBoard";
import { BacklogView } from "@/components/BacklogView";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Project, Sprint, Board, BacklogItem } from "@/lib/types";
import { api } from "@/lib/api";

type View = "board" | "backlog";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [backlogItems, setBacklogItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("board");
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintGoal, setSprintGoal] = useState("");

  const activeSprint = sprints.find((s) => s.status === "active") || null;

  const fetchData = useCallback(async () => {
    try {
      const [proj, sprintList, backlog] = await Promise.all([
        api.getProject(projectId),
        api.listSprints(projectId),
        api.listBacklog(projectId),
      ]);
      setProject(proj);
      setSprints(sprintList);
      setBacklogItems(backlog);

      const active = sprintList.find((s) => s.status === "active");
      if (active) {
        const boardData = await api.getBoard(active.id);
        setBoard(boardData);
      } else {
        setBoard(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh board every 5 seconds
  useEffect(() => {
    if (!activeSprint) return;
    const interval = setInterval(async () => {
      try {
        const boardData = await api.getBoard(activeSprint.id);
        setBoard(boardData);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [activeSprint]);

  const handleStartSprint = async (sprintId: number) => {
    try {
      await api.startSprint(sprintId);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleCompleteSprint = async (sprintId: number) => {
    try {
      await api.completeSprint(sprintId);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleCreateSprint = async () => {
    try {
      await api.createSprint(projectId, { goal: sprintGoal || undefined });
      setSprintGoal("");
      setShowCreateSprint(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">
          Loading...
        </span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-sm text-destructive">Project not found</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Sidebar
        project={project}
        sprints={sprints}
        activeSprint={activeSprint}
        currentView={view}
        onViewChange={setView}
        onStartSprint={handleStartSprint}
        onCompleteSprint={handleCompleteSprint}
        onCreateSprint={() => setShowCreateSprint(true)}
      />

      {/* Board view */}
      {view === "board" && (
        <main className="flex-1 flex flex-col overflow-hidden">
          {board && activeSprint ? (
            <>
              {/* Sprint bar above columns */}
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="status-pulse inline-block w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-mono text-xs font-semibold text-foreground/80">
                    Sprint {activeSprint.number}
                  </span>
                  {activeSprint.goal && (
                    <span className="text-xs text-muted-foreground/50 truncate hidden sm:inline">
                      — {activeSprint.goal}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCompleteSprint(activeSprint.id)}
                  className="text-[10px] h-7 px-3 font-mono border-amber-500/30 text-amber-400 hover:bg-amber-500/10 shrink-0"
                >
                  End Sprint
                </Button>
              </div>

              <div className="flex-1 px-4 sm:px-6 py-4 overflow-hidden">
                <KanbanBoard
                  board={board}
                  sprintId={activeSprint.id}
                  onRefresh={fetchData}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
              <div className="w-16 h-16 rounded-2xl bg-muted/30 border border-border/30 flex items-center justify-center">
                <span className="font-mono text-2xl text-muted-foreground/30">?</span>
              </div>
              <p className="font-mono text-sm text-muted-foreground/50">
                No active sprint
              </p>
              <p className="font-mono text-xs text-muted-foreground/30 text-center px-8">
                Open the sidebar to create a sprint, add items from backlog, then start it
              </p>
            </div>
          )}
        </main>
      )}

      {/* Backlog view */}
      {view === "backlog" && (
        <BacklogView
          projectId={projectId}
          items={backlogItems}
          sprints={sprints}
          onRefresh={fetchData}
        />
      )}

      {/* Create sprint dialog */}
      <Dialog open={showCreateSprint} onOpenChange={setShowCreateSprint}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[400px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">New Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Sprint goal (optional)"
              value={sprintGoal}
              onChange={(e) => setSprintGoal(e.target.value)}
              className="text-sm font-mono bg-muted/30"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSprint()}
            />
            <Button onClick={handleCreateSprint} size="sm" className="w-full font-mono text-xs">
              Create Sprint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
