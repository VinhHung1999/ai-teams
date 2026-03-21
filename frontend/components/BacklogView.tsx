"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BacklogItem, Sprint } from "@/lib/types";
import { PRIORITIES, ROLES } from "@/lib/types";
import { api } from "@/lib/api";

const priorityColor: Record<string, string> = {
  P0: "border-red-500/40 text-red-400 bg-red-500/10",
  P1: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  P2: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  P3: "border-gray-500/40 text-gray-400 bg-gray-500/10",
};

const statusColor: Record<string, string> = {
  new: "border-slate-500/40 text-slate-400 bg-slate-500/10",
  ready: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  in_sprint: "border-purple-500/40 text-purple-400 bg-purple-500/10",
  done: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
};

interface BacklogViewProps {
  projectId: number;
  items: BacklogItem[];
  sprints: Sprint[];
  onRefresh: () => void;
}

export function BacklogView({ projectId, items, sprints, onRefresh }: BacklogViewProps) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("P2");
  const [points, setPoints] = useState("");
  const [saving, setSaving] = useState(false);
  const [addingItem, setAddingItem] = useState<BacklogItem | null>(null);
  const [assignRole, setAssignRole] = useState("");

  const targetSprint = sprints.find((s) => s.status === "active") || sprints.find((s) => s.status === "planning");

  const handleCreate = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.createBacklogItem(projectId, {
        title: title.trim(),
        description: desc.trim() || undefined,
        priority,
        story_points: points ? Number(points) : undefined,
      });
      setTitle(""); setDesc(""); setPriority("P2"); setPoints("");
      setCreating(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm("Delete this backlog item?")) return;
    try {
      await api.deleteBacklogItem(itemId);
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const handleAddToSprint = async () => {
    if (!addingItem || !targetSprint) return;
    try {
      await api.addItemToSprint(targetSprint.id, {
        backlog_item_id: addingItem.id,
        assignee_role: assignRole || undefined,
      });
      setAddingItem(null);
      setAssignRole("");
      onRefresh();
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex-1 px-4 py-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground/90">Product Backlog</h2>
          <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">
            {items.length} items
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreating(true)}
          className="font-mono text-[11px] h-7"
        >
          + Add
        </Button>
      </div>

      {/* Items as cards (mobile-friendly) */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="font-mono text-sm text-muted-foreground/50">Empty backlog</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            className="font-mono text-[11px]"
          >
            + Add First Item
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="border border-border/40 rounded-lg p-3 bg-card/50 hover:bg-card transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground/90 flex-1">
                  {item.title}
                </p>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 h-[18px] ${priorityColor[item.priority]}`}>
                    {item.priority}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 h-[18px] ${statusColor[item.status]}`}>
                    {item.status}
                  </Badge>
                </div>
              </div>

              {item.description && (
                <p className="text-[11px] text-muted-foreground/50 mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}

              <div className="flex items-center justify-between mt-2.5">
                <div className="flex items-center gap-2">
                  {item.story_points !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground/50 bg-muted/40 rounded px-1.5 py-0.5">
                      {item.story_points}sp
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {item.status !== "in_sprint" && item.status !== "done" && targetSprint && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingItem(item)}
                      className="text-[10px] h-6 px-2 font-mono text-primary/70"
                    >
                      + Sprint
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-[10px] h-6 px-2 font-mono text-destructive/50"
                  >
                    Del
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[460px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">New Backlog Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. User authentication"
                className="mt-1 text-sm font-mono bg-muted/30"
              />
            </div>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Description</label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Optional description"
                className="mt-1 text-sm font-mono bg-muted/30 min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Priority</label>
                <div className="flex gap-1 mt-1">
                  {PRIORITIES.map((p) => (
                    <Button key={p} variant={priority === p ? "default" : "outline"} size="sm"
                      onClick={() => setPriority(p)}
                      className={`text-[10px] h-7 px-2 font-mono ${priority !== p ? priorityColor[p] : ""}`}
                    >{p}</Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Points</label>
                <Input value={points} onChange={(e) => setPoints(e.target.value)} type="number"
                  placeholder="5" className="mt-1 text-sm font-mono bg-muted/30" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={!title.trim() || saving} size="sm" className="w-full font-mono text-xs">
              Add to Backlog
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to sprint dialog */}
      <Dialog open={!!addingItem} onOpenChange={(v) => !v && setAddingItem(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-[380px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">Add to Sprint {targetSprint?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-foreground/80">{addingItem?.title}</p>
            <div>
              <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Assign Role</label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {ROLES.map((r) => (
                  <Button key={r} variant={assignRole === r ? "default" : "outline"} size="sm"
                    onClick={() => setAssignRole(assignRole === r ? "" : r)}
                    className="text-[10px] h-7 px-2 font-mono"
                  >{r}</Button>
                ))}
              </div>
            </div>
            <Button onClick={handleAddToSprint} size="sm" className="w-full font-mono text-xs">
              Add to Sprint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
