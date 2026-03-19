"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { Project, Sprint } from "@/lib/types";

type View = "board" | "backlog";

interface SidebarProps {
  project: Project;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  currentView: View;
  onViewChange: (view: View) => void;
  onStartSprint: (id: number) => void;
  onCompleteSprint: (id: number) => void;
  onCreateSprint: () => void;
}

export function Sidebar({
  project,
  sprints,
  activeSprint,
  currentView,
  onViewChange,
  onStartSprint,
  onCompleteSprint,
  onCreateSprint,
}: SidebarProps) {
  const [open, setOpen] = useState(false);

  const handleViewChange = (view: View) => {
    onViewChange(view);
    setOpen(false);
  };

  const statusIcon: Record<string, string> = {
    planning: "◻",
    active: "▶",
    completed: "✓",
  };

  const statusClass: Record<string, string> = {
    planning: "text-slate-400",
    active: "text-emerald-400",
    completed: "text-muted-foreground/40",
  };

  return (
    <>
      {/* Top bar with hamburger */}
      <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 h-12">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <button className="flex flex-col gap-[5px] p-2 -ml-2 rounded-md hover:bg-muted/30 transition-colors">
                  <span className="block w-[18px] h-[2px] bg-foreground/70 rounded-full" />
                  <span className="block w-[14px] h-[2px] bg-foreground/50 rounded-full" />
                  <span className="block w-[18px] h-[2px] bg-foreground/70 rounded-full" />
                </button>
              }
            />

            <SheetContent side="left" className="w-[280px] sm:max-w-[280px] bg-background border-border/40 p-0">
              <SheetHeader className="p-4 pb-2">
                <SheetTitle className="font-mono text-xs tracking-wider text-muted-foreground/60">
                  AI·TEAMS
                </SheetTitle>
              </SheetHeader>

              {/* Project name */}
              <div className="px-4 pb-3">
                <h2 className="text-sm font-semibold text-foreground/90">{project.name}</h2>
                {project.tmux_session_name && (
                  <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">
                    tmux: {project.tmux_session_name}
                  </p>
                )}
              </div>

              <Separator className="opacity-40" />

              {/* Navigation */}
              <nav className="p-3 space-y-1">
                <button
                  onClick={() => handleViewChange("board")}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                    ${currentView === "board"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/20"
                    }
                  `}
                >
                  <span className="font-mono text-[10px] opacity-60">▦</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium">Board</span>
                    {activeSprint && (
                      <span className="text-[11px] text-muted-foreground/50 ml-1.5">
                        — Sprint {activeSprint.number}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={() => handleViewChange("backlog")}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                    ${currentView === "backlog"
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/70 hover:text-foreground/80 hover:bg-muted/20"
                    }
                  `}
                >
                  <span className="font-mono text-[10px] opacity-60">☰</span>
                  <span className="text-[13px] font-medium">Backlog</span>
                </button>
              </nav>

              <Separator className="opacity-40" />

              {/* Sprints */}
              <div className="p-3">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
                    Sprints
                  </span>
                  <button
                    onClick={() => { onCreateSprint(); setOpen(false); }}
                    className="text-[10px] font-mono text-primary/60 hover:text-primary transition-colors"
                  >
                    + New
                  </button>
                </div>

                <div className="space-y-1">
                  {sprints.length === 0 && (
                    <p className="text-[11px] text-muted-foreground/30 px-1 py-2">No sprints yet</p>
                  )}
                  {sprints.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors"
                    >
                      <span className={`font-mono text-[10px] ${statusClass[s.status]}`}>
                        {statusIcon[s.status]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground/80">
                          Sprint {s.number}
                        </p>
                        {s.goal && (
                          <p className="text-[10px] text-muted-foreground/40 truncate">
                            {s.goal}
                          </p>
                        )}
                      </div>

                      {s.status === "planning" && (
                        <button
                          onClick={() => { onStartSprint(s.id); setOpen(false); }}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        >
                          Start
                        </button>
                      )}
                      {s.status === "active" && (
                        <button
                          onClick={() => { onCompleteSprint(s.id); setOpen(false); }}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                        >
                          End
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="opacity-40" />

              {/* Back to projects */}
              <div className="p-3">
                <SheetClose
                  render={
                    <Link
                      href="/"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/20 transition-all"
                    >
                      <span className="font-mono text-[10px]">&larr;</span>
                      <span className="text-[12px]">All Projects</span>
                    </Link>
                  }
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Mini header info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground/90 truncate">
              {project.name}
            </span>
            <span className="text-muted-foreground/30 font-mono text-xs">/</span>
            <span className="text-xs font-mono text-muted-foreground/50 capitalize">
              {currentView}
            </span>
          </div>

        </div>
      </header>
    </>
  );
}
