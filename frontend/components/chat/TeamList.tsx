"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

interface TeamListProps {
  projects: Project[];
  activeId: number | null;
  onSelect: (id: number) => void;
  onRefreshProjects?: () => void;
  lastEvents?: Record<number, string>;
  lastEventAt?: Record<number, string>;
  lastReadAt?: Record<number, string>;
}

function teamGradient(id: number): string {
  const gradients = [
    "linear-gradient(135deg,#3390ec,#7460d9)",
    "linear-gradient(135deg,#10b981,#0284c7)",
    "linear-gradient(135deg,#f59e0b,#ef4444)",
    "linear-gradient(135deg,#8b5cf6,#ec4899)",
    "linear-gradient(135deg,#06b6d4,#3b82f6)",
    "linear-gradient(135deg,#34d399,#059669)",
  ];
  return gradients[id % gradients.length];
}

// ── Action icons ──────────────────────────────────────────────────────────────

function IconStart() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  );
}
function IconKill() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="2"/>
    </svg>
  );
}
function IconRefresh() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  );
}
function IconSpinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3"/>
      <path d="M12 2v4" stroke="currentColor"/>
    </svg>
  );
}

// ── Team item ─────────────────────────────────────────────────────────────────

interface TeamItemProps {
  project: Project;
  active: boolean;
  preview: string;
  unread: boolean;
  onSelect: () => void;
  onRefreshProjects?: () => void;
}

type ActionType = "start" | "kill" | "refresh";

function TeamItem({ project, active, preview, unread, onSelect, onRefreshProjects }: TeamItemProps) {
  const isOnline = project.tmux_active ?? false;
  const letter = project.name.charAt(0).toUpperCase();
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);
  const [hovered, setHovered] = useState(false);

  const doAction = async (action: ActionType, e: React.MouseEvent) => {
    e.stopPropagation();
    if (loadingAction) return;

    if (action === "kill" || action === "refresh") {
      const label = action === "kill" ? "Kill" : "Refresh";
      if (!window.confirm(`${label} team "${project.name}"? This will terminate the tmux session.`)) return;
    }

    setLoadingAction(action);
    try {
      const r = await fetch(`/api/projects/${project.id}/${action}`, { method: "POST" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok && !data.ok) {
        console.error(`[${action}] failed:`, data.error ?? r.status);
      }
    } catch (err) {
      console.error(`[${action}] network error:`, err);
    } finally {
      setLoadingAction(null);
      onRefreshProjects?.();
    }
  };

  const actionBtns: { action: ActionType; icon: React.ReactNode; color: string; title: string; disabled: boolean }[] = [
    {
      action: "start",
      icon: loadingAction === "start" ? <IconSpinner /> : <IconStart />,
      color: "#10b981",
      title: "Start team",
      disabled: isOnline || loadingAction !== null,
    },
    {
      action: "kill",
      icon: loadingAction === "kill" ? <IconSpinner /> : <IconKill />,
      color: "#ef4444",
      title: "Kill team",
      disabled: !isOnline || loadingAction !== null,
    },
    {
      action: "refresh",
      icon: loadingAction === "refresh" ? <IconSpinner /> : <IconRefresh />,
      color: "#3390ec",
      title: "Refresh team",
      disabled: loadingAction !== null,
    },
  ];

  return (
    <div
      className="team-item w-full flex items-center gap-3 px-3 py-2 cursor-pointer"
      style={{
        background: active ? "var(--c-bg-active)" : "transparent",
        transition: "background 0.1s",
        minWidth: 0,
        overflow: "hidden",
        position: "relative",
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar + online dot */}
      <div className="relative flex-shrink-0">
        <div
          className="flex items-center justify-center text-white font-semibold text-xl"
          style={{ width: 54, height: 54, borderRadius: "50%", background: teamGradient(project.id) }}
        >
          {letter}
        </div>
        <span
          className="absolute bottom-0 right-0"
          style={{
            width: 14, height: 14, borderRadius: "50%",
            background: isOnline ? "var(--c-status-ok)" : "var(--c-fg-3)",
            border: "2.5px solid var(--c-bg-list)",
          }}
        />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span
          className="truncate"
          style={{ fontSize: 15, fontWeight: unread ? 700 : 600, color: active ? "var(--c-accent)" : "var(--c-fg-0)" }}
        >
          {project.name}
        </span>
        <span
          className="truncate"
          style={{ fontSize: 13, fontWeight: unread ? 600 : 400, color: unread ? "var(--c-fg-0)" : "var(--c-fg-2)", lineHeight: 1.35 }}
        >
          {preview || (project.roles?.join(" · ") ?? "")}
        </span>
      </div>

      {/* Unread dot — hidden when action buttons visible */}
      {unread && !active && !hovered && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-accent)", flexShrink: 0 }} />
      )}

      {/* Action buttons — hover desktop / always mobile */}
      <div
        className="team-actions flex items-center gap-1 flex-shrink-0"
        style={{ opacity: hovered ? 1 : 0, transition: "opacity 0.15s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {actionBtns.map(({ action, icon, color, title, disabled }) => (
          <button
            key={action}
            title={title}
            disabled={disabled}
            onClick={(e) => doAction(action, e)}
            style={{
              width: 28, height: 28,
              borderRadius: "50%",
              border: "none",
              background: disabled ? "rgba(0,0,0,0.04)" : `${color}18`,
              color: disabled ? "var(--c-fg-3)" : color,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: disabled ? "not-allowed" : "pointer",
              flexShrink: 0,
              transition: "background 0.1s, color 0.1s",
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

type FilterTab = "all" | "unread";

export function TeamList({
  projects,
  activeId,
  onSelect,
  onRefreshProjects,
  lastEvents = {},
  lastEventAt = {},
  lastReadAt = {},
}: TeamListProps) {
  const [tab, setTab] = useState<FilterTab>("all");

  const sorted = [...projects].sort((a, b) => {
    const aTs = lastEventAt[a.id] ?? "0";
    const bTs = lastEventAt[b.id] ?? "0";
    return bTs.localeCompare(aTs) || a.name.localeCompare(b.name);
  });

  const filtered =
    tab === "unread"
      ? sorted.filter((p) => (lastEventAt[p.id] ?? "0") > (lastReadAt[p.id] ?? "0"))
      : sorted;

  return (
    <div className="flex flex-col h-full" style={{ minWidth: 0, overflow: "hidden" }}>
      {/* Search bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--c-line)" }}
      >
        <div
          className="flex-1 flex items-center gap-2 px-3"
          style={{ height: 36, background: "rgba(0,0,0,0.04)", borderRadius: 18, color: "var(--c-fg-2)", fontSize: 13 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <span style={{ color: "var(--c-fg-2)" }}>Search</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-2 py-1 flex-shrink-0" style={{ borderBottom: "1px solid var(--c-line)" }}>
        {(["all", "unread"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-colors"
            style={{ background: tab === t ? "var(--c-accent)" : "transparent", color: tab === t ? "white" : "var(--c-fg-1)" }}
          >
            {t === "all" ? "All" : "Unread"}
          </button>
        ))}
      </div>

      {/* Team list */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--c-fg-2)" }}>No teams found.</p>
        ) : (
          filtered.map((p) => {
            const at = lastEventAt[p.id] ?? "0";
            const read = lastReadAt[p.id] ?? "0";
            const isUnread = at > read && p.id !== activeId;
            return (
              <TeamItem
                key={p.id}
                project={p}
                active={p.id === activeId}
                preview={lastEvents[p.id] ?? ""}
                unread={isUnread}
                onSelect={() => onSelect(p.id)}
                onRefreshProjects={onRefreshProjects}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
