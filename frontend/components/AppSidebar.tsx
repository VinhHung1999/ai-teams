"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";

interface AppSidebarProps {
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  onTeamCommand?: (projectId: number, command: string) => void;
  mobileOpenExternal?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

/** Sidebar content shared between desktop and mobile */
function SidebarContent({
  projects,
  selectedProjectId,
  onSelectProject,
  collapsed,
  onToggle,
  onCreateProject,
  onDeleteProject,
  onPinProject,
  loading,
}: {
  projects: Project[];
  selectedProjectId: number | null;
  onSelectProject: (id: number) => void;
  collapsed: boolean;
  onToggle: () => void;
  onCreateProject: () => void;
  onDeleteProject: (id: number) => void;
  onPinProject: (id: number) => void;
  loading: boolean;
}) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggle}
          className="p-2 rounded-md hover:bg-muted/30 transition-colors"
          title="Expand sidebar"
        >
          <span className="block text-foreground/50 text-sm">&raquo;</span>
        </button>
        <Separator className="opacity-40 w-6" />
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => onSelectProject(project.id)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-mono font-semibold transition-colors ${
              selectedProjectId === project.id
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground/50 hover:bg-muted/30 hover:text-foreground/70"
            }`}
            title={project.name}
          >
            {project.name.slice(0, 2).toUpperCase()}
          </button>
        ))}
        <Separator className="opacity-40 w-6" />
        <button
          onClick={onCreateProject}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground/40 hover:bg-muted/30 hover:text-foreground/70 transition-colors"
          title="New project"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-[7px] h-[7px] rounded-full bg-primary status-pulse" />
          <span className="text-xs font-semibold tracking-wide text-foreground/80">
            AI Teams
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded hover:bg-muted/30 transition-colors lg:block hidden"
          title="Collapse sidebar"
        >
          <span className="block text-foreground/40 text-xs">&laquo;</span>
        </button>
      </div>

      {/* New project button */}
      <div className="px-3 pb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCreateProject}
          className="w-full text-[11px] h-7 font-mono justify-start gap-2"
        >
          <span className="text-muted-foreground/60">+</span> New Project
        </Button>
      </div>

      {/* Global nav links */}
      <div className="px-3 pb-2">
        <Link
          href="/files"
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-[11px] font-mono text-muted-foreground/50 hover:bg-[#161616] hover:text-[#10b981] transition-colors w-full"
        >
          <span className="text-[#10b981]/60">📁</span>
          File Manager
        </Link>
      </div>

      <Separator className="opacity-40" />

      {/* Project list */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-[11px] text-muted-foreground/40 animate-pulse font-mono">
              Loading...
            </span>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 gap-2">
            <p className="text-[11px] text-muted-foreground/30">No projects</p>
          </div>
        ) : (
          projects.map((project) => {
            const isActive = selectedProjectId === project.id;
            return (
              <div
                key={project.id}
                className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-sm cursor-pointer transition-all duration-150 ${
                  isActive
                    ? "bg-transparent text-primary border-l-2 border-l-primary"
                    : "text-foreground/70 hover:bg-[#161616] hover:text-foreground/90"
                }`}
                onClick={() => onSelectProject(project.id)}
              >
                <div
                  className={`w-7 h-7 rounded-sm flex items-center justify-center shrink-0 text-[9px] font-mono font-semibold ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "bg-[#161616] text-muted-foreground/50 border border-border/30"
                  }`}
                >
                  {project.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium truncate flex items-center gap-1">
                    {project.pinned && (
                      <span className="text-[#10b981] text-[9px] leading-none" title="Pinned">📌</span>
                    )}
                    {project.name}
                  </p>
                  {project.tmux_session_name && (
                    <p className="text-[10px] font-mono text-muted-foreground/40 truncate">
                      {project.tmux_session_name}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onPinProject(project.id); }}
                  className={`opacity-0 group-hover:opacity-100 text-[10px] px-1 py-0.5 rounded transition-all shrink-0 ${
                    project.pinned
                      ? "text-[#10b981] opacity-100"
                      : "text-muted-foreground/30 hover:text-[#10b981]"
                  }`}
                  title={project.pinned ? "Unpin" : "Pin to top"}
                >
                  📌
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(project.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                >
                  Del
                </button>
              </div>
            );
          })
        )}
      </nav>
    </div>
  );
}

export function AppSidebar({ selectedProjectId, onSelectProject, onTeamCommand, mobileOpenExternal, onMobileOpenChange }: AppSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpenInternal, setMobileOpenInternal] = useState(false);
  const [creating, setCreating] = useState(false);

  const mobileOpen = mobileOpenExternal ?? mobileOpenInternal;
  const setMobileOpen = (open: boolean) => {
    setMobileOpenInternal(open);
    onMobileOpenChange?.(open);
  };

  // Sync external state
  useEffect(() => {
    if (mobileOpenExternal !== undefined) setMobileOpenInternal(mobileOpenExternal);
  }, [mobileOpenExternal]);

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleDelete = async (projectId: number) => {
    if (!confirm("Delete this project and all its data?")) return;
    try {
      await api.deleteProject(projectId);
      fetchProjects();
    } catch (e) {
      console.error(e);
    }
  };

  const handlePin = async (projectId: number) => {
    try {
      const result = await api.togglePin(projectId);
      setProjects((prev) =>
        [...prev.map((p) => p.id === projectId ? { ...p, pinned: result.pinned } : p)]
          .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectProject = (id: number) => {
    onSelectProject(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 h-full border-r border-[#1f1f1f] bg-[#000000] transition-all duration-200 ${
          collapsed ? "w-12" : "w-[220px]"
        }`}
      >
        <SidebarContent
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={handleSelectProject}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onCreateProject={() => setCreating(true)}
          onDeleteProject={handleDelete}
          onPinProject={handlePin}
          loading={loading}
        />
      </aside>

      {/* Mobile header */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-40 lg:hidden">
        <div className="flex items-center gap-3 px-4 h-12">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <button className="flex flex-col gap-[5px] p-2 -ml-2 rounded-md hover:bg-muted/30 transition-colors">
                  <span className="block w-[18px] h-[2px] bg-foreground/70 rounded-full" />
                  <span className="block w-[14px] h-[2px] bg-foreground/50 rounded-full" />
                  <span className="block w-[18px] h-[2px] bg-foreground/70 rounded-full" />
                </button>
              }
            />
            <SheetContent
              side="left"
              className="w-[280px] sm:max-w-[280px] bg-background border-border/40 p-0 z-[60]"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                projects={projects}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
                collapsed={false}
                onToggle={() => {}}
                onCreateProject={() => {
                  setCreating(true);
                  setMobileOpen(false);
                }}
                onDeleteProject={handleDelete}
                onPinProject={handlePin}
                loading={loading}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-[7px] h-[7px] rounded-full bg-primary status-pulse" />
            <span className="text-sm font-semibold text-foreground/90">
              AI Teams
            </span>
          </div>
        </div>
      </header>

      {/* Create project dialog */}
      <CreateProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(projectId, teamCommand) => {
          fetchProjects();
          onSelectProject(projectId);
          if (teamCommand && onTeamCommand) {
            onTeamCommand(projectId, teamCommand);
          }
        }}
      />
    </>
  );
}
