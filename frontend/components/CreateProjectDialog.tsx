"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FolderBrowser } from "@/components/FolderBrowser";
import { api } from "@/lib/api";

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [tmuxSession, setTmuxSession] = useState("");
  const [workDir, setWorkDir] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await api.createProject({
        name: name.trim(),
        tmux_session_name: tmuxSession.trim() || undefined,
        working_directory: workDir.trim() || undefined,
      });
      setName("");
      setTmuxSession("");
      setWorkDir("");
      onCreated();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">New Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2 min-w-0">
          <div className="min-w-0">
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Project Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. love-scrum"
              className="mt-1 text-sm font-mono bg-muted/30"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="min-w-0">
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Tmux Session Name
            </label>
            <Input
              value={tmuxSession}
              onChange={(e) => setTmuxSession(e.target.value)}
              placeholder="e.g. love-scrum-team"
              className="mt-1 text-sm font-mono bg-muted/30"
            />
          </div>
          <div className="min-w-0">
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Working Directory
            </label>
            <FolderBrowser value={workDir} onSelect={setWorkDir} />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            size="sm"
            className="w-full font-mono text-xs"
          >
            Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
