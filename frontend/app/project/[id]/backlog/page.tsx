"use client";

import { useEffect, useState, use } from "react";
import { ProjectNav } from "@/components/ProjectNav";
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
import type { Project, BacklogItem, Sprint } from "@/lib/types";
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

export default function BacklogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const projectId = Number(id);

  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Create form
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("P2");
  const [points, setPoints] = useState("");
  const [saving, setSaving] = useState(false);

  // Add to sprint dialog
  const [addingItem, setAddingItem] = useState<BacklogItem | null>(null);
  const [assignRole, setAssignRole] = useState("");

  const fetchData = async () => {
    try {
      const [proj, backlog, sprintList] = await Promise.all([
        api.getProject(projectId),
        api.listBacklog(projectId),
        api.listSprints(projectId),
      ]);
      setProject(proj);
      setItems(backlog);
      setSprints(sprintList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [projectId]);

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
      setTitle("");
      setDesc("");
      setPriority("P2");
      setPoints("");
      setCreating(false);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (itemId: number) => {
    try {
      await api.deleteBacklogItem(itemId);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToSprint = async () => {
    if (!addingItem) return;
    const planningSprint = sprints.find((s) => s.status === "planning" || s.status === "active");
    if (!planningSprint) return;
    try {
      await api.addItemToSprint(planningSprint.id, {
        backlog_item_id: addingItem.id,
        assignee_role: assignRole || undefined,
      });
      setAddingItem(null);
      setAssignRole("");
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const targetSprint = sprints.find((s) => s.status === "planning" || s.status === "active");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <ProjectNav projectId={projectId} projectName={project?.name || "..."} />

      <main className="flex-1 px-6 py-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
            + Add Item
          </Button>
        </div>

        {/* Table */}
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
          <div className="border border-border/40 rounded-xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_80px_60px_80px_120px] gap-2 px-4 py-2.5 bg-muted/20 border-b border-border/30">
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Title</span>
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Priority</span>
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Pts</span>
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">Status</span>
              <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Rows */}
            {items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_80px_60px_80px_120px] gap-2 px-4 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center"
              >
                <div>
                  <p className="text-[13px] font-medium text-foreground/90">{item.title}</p>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate max-w-[400px]">
                      {item.description}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className={`text-[10px] font-mono w-fit ${priorityColor[item.priority]}`}>
                  {item.priority}
                </Badge>
                <span className="text-[12px] font-mono text-muted-foreground/60">
                  {item.story_points || "-"}
                </span>
                <Badge variant="outline" className={`text-[10px] font-mono w-fit ${statusColor[item.status]}`}>
                  {item.status}
                </Badge>
                <div className="flex justify-end gap-1">
                  {item.status !== "in_sprint" && item.status !== "done" && targetSprint && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingItem(item)}
                      className="text-[10px] h-6 px-2 font-mono text-primary/70 hover:text-primary"
                    >
                      + Sprint
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(item.id)}
                    className="text-[10px] h-6 px-2 font-mono text-destructive/50 hover:text-destructive"
                  >
                    Del
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create item dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-[460px] bg-card border-border/60">
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
                    <Button
                      key={p}
                      variant={priority === p ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPriority(p)}
                      className={`text-[10px] h-7 px-2 font-mono ${priority !== p ? priorityColor[p] : ""}`}
                    >
                      {p}
                    </Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">Story Points</label>
                <Input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  type="number"
                  placeholder="e.g. 5"
                  className="mt-1 text-sm font-mono bg-muted/30"
                />
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={!title.trim() || saving}
              size="sm"
              className="w-full font-mono text-xs"
            >
              Add to Backlog
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to sprint dialog */}
      <Dialog open={!!addingItem} onOpenChange={(v) => !v && setAddingItem(null)}>
        <DialogContent className="sm:max-w-[380px] bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">
              Add to Sprint {targetSprint?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-foreground/80">{addingItem?.title}</p>
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
            <Button
              onClick={handleAddToSprint}
              size="sm"
              className="w-full font-mono text-xs"
            >
              Add to Sprint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
