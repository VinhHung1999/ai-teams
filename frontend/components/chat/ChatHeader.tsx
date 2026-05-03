"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";

interface ChatHeaderProps {
  project: Project | null;
  onOpenInfo: () => void;
  onBack?: () => void;
  onRefreshProjects?: () => void;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
}

function teamGradient(id: number): string {
  const g = [
    "linear-gradient(135deg,#3390ec,#7460d9)",
    "linear-gradient(135deg,#10b981,#0284c7)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#8b5cf6,#ec4899)",
    "linear-gradient(135deg,#06b6d4,#3b82f6)",
    "linear-gradient(135deg,#34d399,#059669)",
  ];
  return g[id % g.length];
}

function IconBtn({ onClick, title, disabled, children }: { onClick?: () => void; title?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="flex items-center justify-center rounded-full transition-colors"
      style={{ width: 38, height: 38, color: disabled ? "var(--c-fg-3)" : "var(--c-fg-1)", background: "transparent", border: "none", cursor: disabled ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.background = "var(--c-bg-hover)"; }}
      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
    >
      {children}
    </button>
  );
}

type TeamAction = "start" | "kill" | "refresh";

export function ChatHeader({ project, onOpenInfo, onBack, onRefreshProjects, terminalOpen, onToggleTerminal }: ChatHeaderProps) {
  const statusText = project?.roles?.map((r) => `${r} online`).join(" · ") ?? "";
  const [loadingAction, setLoadingAction] = useState<TeamAction | null>(null);
  const isOnline = project?.tmux_active ?? false;

  const doAction = useCallback(async (action: TeamAction) => {
    if (!project || loadingAction) return;
    if (action === "kill" || action === "refresh") {
      const label = action === "kill" ? "Kill" : "Refresh";
      if (!window.confirm(`${label} team "${project.name}"? This will terminate the tmux session.`)) return;
    }
    setLoadingAction(action);
    try {
      await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
    } catch {}
    setLoadingAction(null);
    onRefreshProjects?.();
  }, [project, loadingAction, onRefreshProjects]);

  return (
    <div
      className="glass-header flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
      style={{ borderBottom: "1px solid var(--c-line)", minHeight: 56 }}
    >
      {/* Mobile back button */}
      {onBack && (
        <IconBtn onClick={onBack} title="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
          </svg>
        </IconBtn>
      )}

      {/* Team avatar */}
      {project ? (
        <button
          onClick={onOpenInfo}
          className="flex-shrink-0 rounded-full flex items-center justify-center text-white font-semibold text-lg"
          style={{ width: 36, height: 36, background: teamGradient(project.id), border: "none", cursor: "pointer" }}
        />
      ) : (
        <div className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: "var(--c-bg-hover)" }} />
      )}

      {/* Name + status */}
      <button className="flex flex-col flex-1 min-w-0 text-left" style={{ border: "none", background: "transparent", cursor: "pointer" }} onClick={onOpenInfo}>
        <span className="font-semibold truncate" style={{ fontSize: 16, color: "var(--c-fg-0)" }}>
          {project ? project.name : "Select a team"}
        </span>
        {project && (
          <span className="truncate" style={{ fontSize: 13, color: "var(--c-fg-2)" }}>
            {statusText || project.tmux_session_name}
          </span>
        )}
      </button>

      {/* Right actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* [368] Team management: Start / Kill / Refresh — only when team selected */}
        {project && (
          <>
            <IconBtn
              title={loadingAction === "start" ? "Starting…" : "Start team"}
              disabled={isOnline || loadingAction !== null}
              onClick={() => doAction("start")}
            >
              {loadingAction === "start"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4"/><path d="M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5,3 19,12 5,21"/></svg>
              }
            </IconBtn>
            <IconBtn
              title={loadingAction === "kill" ? "Stopping…" : "Kill team"}
              disabled={!isOnline || loadingAction !== null}
              onClick={() => doAction("kill")}
            >
              {loadingAction === "kill"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4"/><path d="M12 18v4" opacity="0.3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
              }
            </IconBtn>
            <IconBtn
              title={loadingAction === "refresh" ? "Restarting…" : "Refresh team"}
              disabled={loadingAction !== null}
              onClick={() => doAction("refresh")}
            >
              {loadingAction === "refresh"
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4"/><path d="M12 18v4" opacity="0.3"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              }
            </IconBtn>
          </>
        )}

        {/* [369] Terminal toggle — visible on ≤1023px as drawer trigger, on ≥1024px toggles panel */}
        {onToggleTerminal && (
          <IconBtn onClick={onToggleTerminal} title={terminalOpen ? "Hide terminal" : "Show terminal"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: terminalOpen ? 1 : 0.5 }}>
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 9l3 3-3 3M13 15h3"/>
            </svg>
          </IconBtn>
        )}
        <Link
          href="/project"
          className="flex items-center justify-center rounded-full transition-colors text-[11px] font-medium px-2.5 h-8"
          style={{ color: "var(--c-fg-2)", background: "transparent" }}
        >
          Board
        </Link>
        <IconBtn onClick={onOpenInfo} title="Team info">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
          </svg>
        </IconBtn>
      </div>
    </div>
  );
}
