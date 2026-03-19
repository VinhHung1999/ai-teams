"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, projectId: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project and all its data?")) return;
    try {
      await api.deleteProject(projectId);
      fetchProjects();
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 sm:px-8 h-14">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 status-pulse" />
            <h1 className="font-mono text-sm font-semibold tracking-wider text-foreground/90">
              AI·TEAMS
            </h1>
            <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest hidden sm:inline">
              Mission Control
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
            className="font-mono text-[11px] h-7"
          >
            + New Project
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">
              Loading...
            </span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-60 gap-4">
            <div className="text-center">
              <p className="font-mono text-sm text-muted-foreground/60">No projects yet</p>
              <p className="font-mono text-xs text-muted-foreground/40 mt-1">
                Create a project to start managing your tmux AI teams
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
              className="font-mono text-[11px]"
            >
              + Create First Project
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block group"
              >
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-card/50 hover:bg-card hover:border-border/60 transition-all duration-200">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="font-mono text-xs font-bold text-primary">
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors truncate">
                        {project.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5">
                        {project.tmux_session_name && (
                          <span className="text-[10px] font-mono text-muted-foreground/50">
                            tmux: {project.tmux_session_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(e, project.id)}
                      className="text-[10px] h-7 px-2 font-mono text-destructive/40 hover:text-destructive hover:bg-destructive/10"
                    >
                      Del
                    </Button>
                    <span className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors font-mono text-lg">
                      &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={fetchProjects}
      />
    </div>
  );
}
