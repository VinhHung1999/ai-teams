"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Sprint } from "@/lib/types";
import { api } from "@/lib/api";

interface SprintPanelProps {
  projectId: number;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  onSprintChange: () => void;
}

export function SprintPanel({ projectId, sprints, activeSprint, onSprintChange }: SprintPanelProps) {
  const [creating, setCreating] = useState(false);
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      await api.createSprint(projectId, { goal: goal || undefined });
      setGoal("");
      setCreating(false);
      onSprintChange();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (sprintId: number) => {
    try {
      await api.startSprint(sprintId);
      onSprintChange();
    } catch (e) {
      console.error(e);
    }
  };

  const handleComplete = async (sprintId: number) => {
    try {
      await api.completeSprint(sprintId);
      onSprintChange();
    } catch (e) {
      console.error(e);
    }
  };

  const statusConfig: Record<string, { label: string; className: string }> = {
    planning: { label: "PLANNING", className: "border-slate-500/40 text-slate-400 bg-slate-500/10" },
    active: { label: "ACTIVE", className: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
    completed: { label: "DONE", className: "border-gray-500/40 text-gray-400 bg-gray-500/10" },
  };

  return (
    <div className="flex items-center justify-between gap-4 px-1">
      <div className="flex items-center gap-3">
        {activeSprint ? (
          <>
            <div className="flex items-center gap-2">
              <span className="status-pulse inline-block w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-sm font-semibold text-foreground/90">
                Sprint {activeSprint.number}
              </span>
            </div>
            {activeSprint.goal && (
              <span className="text-sm text-muted-foreground/70 max-w-[300px] truncate">
                {activeSprint.goal}
              </span>
            )}
            <Badge
              variant="outline"
              className={`font-mono text-[10px] ${statusConfig[activeSprint.status]?.className}`}
            >
              {statusConfig[activeSprint.status]?.label}
            </Badge>
          </>
        ) : (
          <span className="text-sm text-muted-foreground/50 font-mono">
            No active sprint
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Sprint with planning status - can start */}
        {sprints.filter((s) => s.status === "planning").map((s) => (
          <Button
            key={s.id}
            variant="outline"
            size="sm"
            onClick={() => handleStart(s.id)}
            className="text-[11px] h-7 font-mono border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            Start Sprint {s.number}
          </Button>
        ))}

        {/* Active sprint - can complete */}
        {activeSprint && activeSprint.status === "active" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleComplete(activeSprint.id)}
            className="text-[11px] h-7 font-mono border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            Complete Sprint
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreating(true)}
          className="text-[11px] h-7 font-mono"
        >
          + New Sprint
        </Button>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">New Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Sprint goal (optional)"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="text-sm font-mono bg-muted/30"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <Button
              onClick={handleCreate}
              disabled={loading}
              size="sm"
              className="w-full font-mono text-xs"
            >
              Create Sprint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
