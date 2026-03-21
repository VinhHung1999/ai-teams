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
      <header className="border-b border-border/50">
        <div className="flex items-center justify-between px-6 sm:px-10 h-14">
          <div className="flex items-center gap-3">
            <div className="w-[7px] h-[7px] rounded-full bg-primary status-pulse" />
            <h1 className="text-sm font-semibold tracking-wide text-foreground/90">
              AI Teams
            </h1>
          </div>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="text-xs h-8 px-4"
          >
            New Project
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-foreground">Projects</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your tmux AI agent teams
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <span className="text-sm text-muted-foreground animate-pulse">
              Loading...
            </span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-4 border border-dashed border-border/60 rounded-xl">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">No projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a project to start managing your AI teams
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="text-xs"
            >
              Create First Project
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
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/60 hover:bg-card hover:border-border/80 transition-all duration-200">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {project.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-foreground/90 group-hover:text-foreground transition-colors truncate">
                        {project.name}
                      </h3>
                      {project.tmux_session_name && (
                        <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">
                          {project.tmux_session_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      className="text-[11px] px-2 py-1 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete
                    </button>
                    <span className="text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors text-lg ml-1">
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
