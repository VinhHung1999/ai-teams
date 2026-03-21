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

const TEMPLATES = [
  { id: "scrum-team", name: "Scrum Team", desc: "PO, SM, TL, BE, FE, QA" },
  { id: "game-dev-team", name: "Game Dev", desc: "DS, SM, AR, DV, QA" },
] as const;

const ALL_ROLES = ["PO", "SM", "TL", "BE", "FE", "QA", "DS", "AR", "DV"] as const;

const TEMPLATE_ROLES: Record<string, string[]> = {
  "scrum-team": ["PO", "SM", "TL", "BE", "FE", "QA"],
  "game-dev-team": ["DS", "SM", "AR", "DV", "QA"],
};

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (projectId: number, teamCommand?: string) => void;
}

export function CreateProjectDialog({ open, onClose, onCreated }: CreateProjectDialogProps) {
  const [name, setName] = useState("");
  const [workDir, setWorkDir] = useState("");
  const [template, setTemplate] = useState("scrum-team");
  const [roles, setRoles] = useState<string[]>(TEMPLATE_ROLES["scrum-team"]);
  const [loading, setLoading] = useState(false);

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleTemplateChange = (t: string) => {
    setTemplate(t);
    setRoles(TEMPLATE_ROLES[t] || []);
  };

  const sessionName = name.trim().toLowerCase().replace(/\s+/g, "-");

  const handleCreate = async () => {
    if (!name.trim() || !workDir.trim()) return;
    setLoading(true);
    try {
      const project = await api.createProject({
        name: name.trim(),
        tmux_session_name: sessionName,
        working_directory: workDir.trim(),
      });

      // Build the claude command to create team
      const teamCommand = `claude -p "/tmux-team-creator-mcp ${template} for project ${name.trim()}, roles: ${roles.join(",")}, working dir: ${workDir.trim()}, session: ${sessionName}"`;

      setName("");
      setWorkDir("");
      setTemplate("scrum-team");
      setRoles(TEMPLATE_ROLES["scrum-team"]);
      onCreated(project.id, teamCommand);
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">New Project + Team</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 min-w-0">
          {/* Name */}
          <div className="min-w-0">
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Project Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. love-scrum"
              className="mt-1 text-sm font-mono bg-muted/30"
            />
            {sessionName && (
              <p className="text-[10px] font-mono text-muted-foreground/35 mt-1">
                Session: {sessionName}
              </p>
            )}
          </div>

          {/* Working Dir */}
          <div className="min-w-0">
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Working Directory *
            </label>
            <FolderBrowser value={workDir} onSelect={setWorkDir} />
          </div>

          {/* Template */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Template
            </label>
            <div className="flex gap-2 mt-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateChange(t.id)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-left transition-all ${
                    template === t.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/40 hover:border-border/60 bg-muted/20"
                  }`}
                >
                  <p className="text-[12px] font-medium text-foreground/80">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Roles */}
          <div>
            <label className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider">
              Roles ({roles.length})
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {(TEMPLATE_ROLES[template] || []).map((role) => (
                <button
                  key={role}
                  onClick={() => toggleRole(role)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all ${
                    roles.includes(role)
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "bg-muted/30 text-muted-foreground/40 border border-border/30 hover:border-border/50"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={!name.trim() || !workDir.trim() || roles.length === 0 || loading}
            size="sm"
            className="w-full text-xs"
          >
            Create Project & Setup Team
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
