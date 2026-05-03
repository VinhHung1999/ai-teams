"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";

interface TeamListProps {
  projects: Project[];
  activeId: number | null;
  onSelect: (id: number) => void;
  lastEvents?: Record<number, string>;
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

interface TeamItemProps {
  project: Project;
  active: boolean;
  preview: string;
  onSelect: () => void;
}

function TeamItem({ project, active, preview, onSelect }: TeamItemProps) {
  const isOnline = project.tmux_active ?? false;
  const isPinned = project.pinned ?? false;
  const letter = project.name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onSelect}
      className="w-full text-left flex items-center gap-3 px-3 py-2"
      style={{
        background: active ? "var(--c-bg-active)" : "transparent",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--c-bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {/* Avatar 54×54 + online dot */}
      <div className="relative flex-shrink-0">
        <div
          className="flex items-center justify-center text-white font-semibold text-xl"
          style={{
            width: 54, height: 54,
            borderRadius: "50%",
            background: teamGradient(project.id),
          }}
        >
          {letter}
        </div>
        <span
          className="absolute bottom-0 right-0"
          style={{
            width: 14, height: 14,
            borderRadius: "50%",
            background: isOnline ? "var(--c-status-ok)" : "var(--c-fg-3)",
            border: "2.5px solid var(--c-bg-list)",
          }}
        />
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1">
          {isPinned && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-fg-3)", flexShrink: 0 }}>
              <path d="M12 17v5"/><path d="M9 10.76V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4.76l2 2.24v2H7v-2l2-2.24z"/>
            </svg>
          )}
          <span
            className="font-semibold truncate"
            style={{
              fontSize: 15,
              color: active ? "var(--c-accent)" : "var(--c-fg-0)",
              flex: 1,
            }}
          >
            {project.name}
          </span>
        </div>
        <span
          className="truncate"
          style={{ fontSize: 13, color: "var(--c-fg-2)", lineHeight: 1.35 }}
        >
          {preview || (project.roles?.join(" · ") ?? "")}
        </span>
      </div>
    </button>
  );
}

type FilterTab = "all" | "unread";

export function TeamList({ projects, activeId, onSelect, lastEvents = {} }: TeamListProps) {
  const [tab, setTab] = useState<FilterTab>("all");

  const sorted = [...projects].sort((a, b) => {
    // Pinned first
    const pinDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    if (pinDiff !== 0) return pinDiff;
    // Then online
    const onlineDiff = (b.tmux_active ? 1 : 0) - (a.tmux_active ? 1 : 0);
    if (onlineDiff !== 0) return onlineDiff;
    return a.name.localeCompare(b.name);
  });

  const filtered = tab === "unread"
    ? sorted.filter((p) => p.tmux_active) // unread = teams with activity (approximation)
    : sorted;

  return (
    <div className="flex flex-col h-full">
      {/* List head: search bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--c-line)" }}
      >
        <div
          className="flex-1 flex items-center gap-2 px-3"
          style={{
            height: 36,
            background: "rgba(0,0,0,0.04)",
            borderRadius: 18,
            color: "var(--c-fg-2)",
            fontSize: 13,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <span style={{ color: "var(--c-fg-2)" }}>Search</span>
        </div>
      </div>

      {/* Tabs: All | Unread */}
      <div
        className="flex gap-1 px-2 py-1 flex-shrink-0"
        style={{ borderBottom: "1px solid var(--c-line)" }}
      >
        {(["all", "unread"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 py-1.5 rounded-lg text-[13px] font-medium capitalize transition-colors"
            style={{
              background: tab === t ? "var(--c-accent)" : "transparent",
              color: tab === t ? "white" : "var(--c-fg-1)",
            }}
          >
            {t === "all" ? "All" : "Active"}
          </button>
        ))}
      </div>

      {/* Team list */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--c-fg-2)" }}>
            No teams found.
          </p>
        ) : (
          filtered.map((p) => (
            <TeamItem
              key={p.id}
              project={p}
              active={p.id === activeId}
              preview={lastEvents[p.id] ?? ""}
              onSelect={() => onSelect(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
