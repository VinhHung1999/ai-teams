"use client";

import { useState } from "react";
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
import type { Project, Sprint } from "@/lib/types";

interface SidebarProps {
  project: Project;
  sprints: Sprint[];
  activeSprint: Sprint | null;
  onStartSprint: (id: number) => void;
  onCompleteSprint: (id: number) => void;
  onCreateSprint: () => void;
  onRefresh?: () => void;
}

/** Shared sidebar content used by both desktop panel and mobile drawer */
function SidebarContent({
  project,
  sprints,
  activeSprint,
  onCreateSprint,
  collapsed,
  onToggle,
}: SidebarProps & {
  collapsed: boolean;
  onToggle: () => void;
  onSelectSprint: (s: Sprint) => void;
}) {

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-3 gap-2">
        <button onClick={onToggle} className="p-2 rounded-md hover:bg-muted/30 transition-colors" title="Expand sidebar">
          <span className="block text-foreground/50 text-sm">&raquo;</span>
        </button>
        <Separator className="opacity-40 w-6" />
        <span className="p-2 rounded-md bg-primary/10 text-primary" title="Dashboard">
          <span className="font-mono text-[10px]">&#x25A6;</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 pb-2 flex items-center justify-between">
        <span className="text-xs font-semibold tracking-wide text-muted-foreground/50">AI Teams</span>
        <button onClick={onToggle} className="p-1 rounded hover:bg-muted/30 transition-colors lg:block hidden" title="Collapse sidebar">
          <span className="block text-foreground/40 text-xs">&laquo;</span>
        </button>
      </div>

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

      {/* Dashboard link (single view, no toggle) */}
      <nav className="p-3 space-y-1">
        <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left bg-primary/10 text-primary">
          <span className="font-mono text-[10px] opacity-60">&#x25A6;</span>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-medium">Dashboard</span>
            {activeSprint && (
              <span className="text-[11px] text-muted-foreground/50 ml-1.5">
                &mdash; Sprint {activeSprint.number}
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1" />

      <Separator className="opacity-40" />

      {/* Back to projects */}
      <div className="p-3">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/20 transition-all"
        >
          <span className="font-mono text-[10px]">&larr;</span>
          <span className="text-[12px]">All Projects</span>
        </Link>
      </div>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const { project } = props;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop sidebar - always visible on lg+ */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen border-r border-border/40 bg-background z-30 transition-all duration-200 ${
          collapsed ? "w-12" : "w-[260px]"
        }`}
      >
        <SidebarContent
          {...props}
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          onSelectSprint={() => {}}
          onCreateSprint={props.onCreateSprint}
        />
      </aside>

      {/* Desktop content offset */}
      <div className={`hidden lg:block shrink-0 transition-all duration-200 ${collapsed ? "w-12" : "w-[260px]"}`} />

      {/* Mobile header - only on smaller screens */}
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
            <SheetContent side="left" className="w-[280px] sm:max-w-[280px] bg-background border-border/40 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <SidebarContent
                {...props}
                collapsed={false}
                onToggle={() => {}}
                onSelectSprint={() => {}}
                onCreateSprint={() => { props.onCreateSprint(); setMobileOpen(false); }}
              />
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-semibold text-foreground/90 truncate">
              {project.name}
            </span>
            <span className="text-muted-foreground/30 font-mono text-xs">/</span>
            <span className="text-xs font-mono text-muted-foreground/50">
              Dashboard
            </span>
          </div>
        </div>
      </header>

    </>
  );
}
