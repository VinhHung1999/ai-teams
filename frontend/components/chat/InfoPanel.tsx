"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";
import { FileManager } from "@/components/FileManager";

export type InfoPanelTab = "overview" | "files" | "team";

interface InfoPanelProps {
  open: boolean;
  tab: InfoPanelTab;
  project: Project | null;
  roles: string[];
  onClose: () => void;
  onTabChange: (tab: InfoPanelTab) => void;
  onSelectRole: (role: string) => void;
  onRefreshProjects?: () => void;
}

// ── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_GRADIENT: Record<string, string> = {
  PO:  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  TL:  "linear-gradient(135deg,#60a5fa,#2563eb)",
  BE:  "linear-gradient(135deg,#34d399,#059669)",
  FE:  "linear-gradient(135deg,#fbbf24,#d97706)",
  QA:  "linear-gradient(135deg,#f472b6,#db2777)",
  SM:  "linear-gradient(135deg,#fb7185,#e11d48)",
  DEV: "linear-gradient(135deg,#a1a1aa,#52525b)",
};

const ROLE_LABEL: Record<string, string> = {
  PO:  "Product Owner", TL: "Tech Lead", BE: "Backend",
  FE:  "Frontend", QA:  "QA", SM: "Scrum Master", DEV: "Developer",
};

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

// ── Overview tab ─────────────────────────────────────────────────────────────

const PRIO_COLOR: Record<string, string> = {
  P0: "#ef4444", P1: "#f59e0b", P2: "#eab308", P3: "#71717a",
};

function OverviewTab({ project }: { project: Project | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api.getDashboard(project.id)
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [project?.id]);

  if (!project) return <Msg>Select a team to view the board.</Msg>;
  if (loading) return <Msg>Loading board…</Msg>;
  if (error) return <Msg style={{ color: "#ef4444" }}>{error}</Msg>;
  if (!data) return null;

  const activeSprint = data.sprints.find((s: any) => s.status === "active");
  if (!activeSprint) return <Msg>No active sprint.</Msg>;

  const board = data.boards?.[String(activeSprint.id)] ?? {};
  const columns = [
    { key: "todo", label: "Todo" },
    { key: "in_progress", label: "In Progress" },
    { key: "in_review", label: "In Review" },
    { key: "testing", label: "Testing" },
    { key: "done", label: "Done" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div style={{ padding: "12px 16px 8px", borderBottom: "1px solid var(--c-line)", flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--c-accent)", marginBottom: 2 }}>
          Sprint {activeSprint.number}
        </div>
        {activeSprint.goal && (
          <div style={{ fontSize: 13, color: "var(--c-fg-1)" }}>{activeSprint.goal}</div>
        )}
        <Link
          href={`/project?id=${project.id}`}
          style={{ fontSize: 12, color: "var(--c-accent)", display: "block", marginTop: 6 }}
        >
          Open full board →
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto chat-scroll" style={{ padding: 16 }}>
        {columns.map(({ key, label }) => {
          const items: any[] = board[key] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={key} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--c-fg-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "var(--c-fg-3)", marginLeft: "auto" }}>{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((item: any) => (
                  <div
                    key={item.id}
                    style={{
                      background: "var(--c-bg-chat)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      fontSize: 13,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--c-fg-2)" }}>
                        [{item.id}]
                      </span>
                      {item.priority && (
                        <span
                          style={{
                            fontSize: 10, fontWeight: 600, color: "white",
                            background: PRIO_COLOR[item.priority] ?? "#71717a",
                            padding: "0 5px", borderRadius: 3,
                          }}
                        >
                          {item.priority}
                        </span>
                      )}
                      {item.story_points && (
                        <span style={{ fontSize: 11, color: "var(--c-fg-2)", marginLeft: "auto" }}>
                          {item.story_points}pt
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--c-fg-0)", lineHeight: 1.35 }}>{item.title}</div>
                    {item.assignee_role && (
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            fontSize: 11, fontWeight: 500,
                            padding: "1px 7px", borderRadius: 10,
                            background: `${ROLE_GRADIENT[item.assignee_role]?.split(",")[1]?.slice(0, 8) ?? "#3390ec"}22`,
                            color: "var(--c-accent)",
                          }}
                        >
                          {item.assignee_role}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Files tab ─────────────────────────────────────────────────────────────────


function FilesTab({ project }: { project: Project | null }) {
  if (!project?.working_directory) return <Msg>Select a team to view files.</Msg>;
  // [353] Full FileManager (Sprint 13-15) — CRUD, upload, drag-drop, image preview
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <FileManager rootPath={project.working_directory} />
    </div>
  );
}

// ── Agents tab ────────────────────────────────────────────────────────────────

function AgentsTab({ project, roles, onSelectRole }: { project: Project | null; roles: string[]; onSelectRole: (r: string) => void }) {
  if (!project || roles.length === 0) return <Msg>No agents for this team.</Msg>;

  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: 16 } as React.CSSProperties}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--c-fg-2)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
        Agents · {roles.length}
      </div>
      {roles.map((role) => (
        <button
          key={role}
          onClick={() => onSelectRole(role)}
          className="w-full flex items-center gap-3 text-left"
          style={{ padding: "10px 4px", borderRadius: 8, background: "transparent" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div className="relative flex-shrink-0">
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: ROLE_GRADIENT[role] ?? ROLE_GRADIENT.DEV,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 600, fontSize: 13,
              }}
            >
              {role[0]}
            </div>
            <span
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 10, height: 10, borderRadius: "50%",
                background: project.tmux_active ? "var(--c-status-ok)" : "var(--c-fg-3)",
                border: "2px solid var(--c-bg-list-glass)",
              }}
            />
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: "var(--c-fg-0)" }}>{ROLE_LABEL[role] ?? role}</div>
            <div style={{ fontSize: 12, color: project.tmux_active ? "var(--c-accent)" : "var(--c-fg-2)" }}>
              {project.tmux_active ? "online" : "offline"}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ── Team tab (identity + action buttons + agents) ─────────────────────────────

function modelShort(m: string): string {
  if (m.includes("opus")) return "opus";
  if (m.includes("sonnet")) return "sonnet";
  if (m.includes("haiku")) return "haiku";
  return m.split("-")[1] ?? m;
}
const MODEL_COLOR: Record<string, string> = { opus: "#a78bfa", sonnet: "#3390ec", haiku: "#10b981" };

function TeamTab({
  project, roles, isOnline, loadingAction, onDoAction, onSelectRole,
}: {
  project: Project | null;
  roles: string[];
  isOnline: boolean;
  loadingAction: "start" | "kill" | "refresh" | "compact" | null;
  onDoAction: (a: "start" | "kill" | "refresh" | "compact") => void;
  onSelectRole: (r: string) => void;
}) {
  const [roleModels, setRoleModels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!project) return;
    fetch(`/api/projects/${project.id}/role-models`)
      .then((r) => r.json())
      .then(setRoleModels)
      .catch(() => {});
  }, [project?.id]);

  if (!project) return <Msg>Select a team to view info.</Msg>;
  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
      {/* Identity */}
      <div style={{ textAlign: "center", padding: "20px 16px 16px", borderBottom: "1px solid var(--c-line)" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: teamGradient(project.id), display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 24, margin: "0 auto 10px" }}>
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--c-fg-0)" }}>{project.name}</div>
        <div style={{ fontSize: 13, color: isOnline ? "var(--c-status-ok)" : "var(--c-fg-2)", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: isOnline ? "var(--c-status-ok)" : "var(--c-fg-3)", display: "inline-block" }} />
          {isOnline ? `Active · ${roles.length} pane${roles.length !== 1 ? "s" : ""}` : "Idle"}
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "center" }}>
          {([
            { action: "start"   as const, title: "Start team",               color: "#10b981", disabled: isOnline || loadingAction !== null,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg> },
            { action: "kill"    as const, title: "Kill team",                color: "#ef4444", disabled: !isOnline || loadingAction !== null,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg> },
            { action: "refresh" as const, title: "Refresh team",             color: "#3390ec", disabled: loadingAction !== null,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> },
            { action: "compact" as const, title: "Compact all (free context)", color: "#a78bfa", disabled: !isOnline || loadingAction !== null,
              icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><line x1="12" y1="8" x2="12" y2="16"/><polyline points="8 12 12 16 16 12"/></svg> },
          ]).map(({ action, title, color, disabled, icon }) => (
            <button key={action} disabled={disabled} onClick={() => onDoAction(action)} title={title}
              style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: disabled ? "rgba(0,0,0,0.04)" : `${color}18`, color: disabled ? "var(--c-fg-3)" : color, display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "not-allowed" : "pointer", opacity: loadingAction === action ? 0.5 : 1 }}>
              {loadingAction === action
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M12 2v4"/><path d="M12 18v4" opacity="0.3"/></svg>
                : icon}
            </button>
          ))}
        </div>
      </div>
      {/* Agents */}
      {roles.length > 0 && (
        <div style={{ padding: "12px 16px 0", fontSize: 11, fontWeight: 600, color: "var(--c-fg-2)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Agents · {roles.length}
        </div>
      )}
      <div style={{ padding: "0 8px 16px" }}>
        {roles.map((role) => (
          <button key={role} onClick={() => onSelectRole(role)} className="w-full flex items-center gap-3 text-left"
            style={{ padding: "10px 8px", borderRadius: 8, background: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <div className="relative flex-shrink-0">
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: ROLE_GRADIENT[role] ?? ROLE_GRADIENT.DEV, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 600, fontSize: 13 }}>
                {role[0]}
              </div>
              <span style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: "50%", background: isOnline ? "var(--c-status-ok)" : "var(--c-fg-3)", border: "2px solid var(--c-bg-list-glass)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "var(--c-fg-0)", display: "flex", alignItems: "center", gap: 6 }}>
                {ROLE_LABEL[role] ?? role}
                {roleModels[role] && (() => {
                  const short = modelShort(roleModels[role]);
                  const color = MODEL_COLOR[short] ?? "var(--c-fg-2)";
                  return (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "white", background: color, padding: "1px 6px", borderRadius: 4, letterSpacing: "0.02em" }}>
                      {short}
                    </span>
                  );
                })()}
              </div>
              <div style={{ fontSize: 12, color: isOnline ? "var(--c-accent)" : "var(--c-fg-2)" }}>{isOnline ? "online" : "offline"}</div>
            </div>
          </button>
        ))}
        {roles.length === 0 && <Msg>No agents for this team.</Msg>}
      </div>
    </div>
  );
}

// ── Shared helper ─────────────────────────────────────────────────────────────

function Msg({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ padding: 16, fontSize: 13, color: "var(--c-fg-2)", ...style }}>
      {children}
    </div>
  );
}

// ── InfoPanel ─────────────────────────────────────────────────────────────────

export function InfoPanel({ open, tab, project, roles, onClose, onTabChange, onSelectRole, onRefreshProjects }: InfoPanelProps) {
  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // [372] Team management actions
  const [loadingAction, setLoadingAction] = useState<"start" | "kill" | "refresh" | "compact" | null>(null);
  const isOnline = project?.tmux_active ?? false;

  const doAction = useCallback(async (action: "start" | "kill" | "refresh" | "compact") => {
    if (!project || loadingAction) return;
    if (action === "kill" || action === "refresh") {
      if (!window.confirm(`${action === "kill" ? "Kill" : "Refresh"} team "${project.name}"?`)) return;
    }
    setLoadingAction(action);
    const endpoint = action === "compact" ? "compact-all" : action;
    try { await fetch(`/api/projects/${project.id}/${endpoint}`, { method: "POST" }); } catch {}
    setLoadingAction(null);
    if (action !== "compact") onRefreshProjects?.();
  }, [project, loadingAction, onRefreshProjects]);

  if (!open) return null; // snap: no animation

  const TABS: [InfoPanelTab, string][] = [["overview", "Overview"], ["files", "Files"], ["team", "Team"]];

  return (
    <>
      {/* Backdrop — mint-tinted 30% */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(180,220,200,0.30)",
          zIndex: 40,
        }}
      />

      {/* Panel — Files tab: fixed full-viewport; others: 50vw absolute */}
      <div
        className={tab === "files" ? undefined : "info-panel"}
        style={{
          position: tab === "files" ? "fixed" : "absolute",
          top: 0, right: 0, bottom: 0,
          ...(tab === "files"
            ? { left: 0, width: "100vw", height: "100dvh", maxWidth: "none", zIndex: 100 }
            : { zIndex: 50 }),
          display: "flex",
          flexDirection: "column",
          background: "var(--c-bg-list-glass)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderLeft: tab === "files" ? "none" : "1px solid var(--c-line)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
        }}
      >
        {tab === "files" ? (
          /* Files full-screen: floating back button + FileManager fills everything */
          <>
            <button
              onClick={() => onTabChange("overview")}
              title="Back to overview"
              style={{
                position: "absolute", top: 10, left: 10, zIndex: 10,
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: "rgba(0,0,0,0.06)", color: "var(--c-fg-1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
              </svg>
            </button>
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <FilesTab project={project} />
            </div>
          </>
        ) : (
          <>
            {/* Panel header */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px",
                borderBottom: "1px solid var(--c-line)",
                flexShrink: 0,
              }}
            >
              {/* ← back (mobile) */}
              <button
                onClick={onClose}
                className="info-panel-back"
                style={{
                  width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "transparent", color: "var(--c-fg-1)",
                  placeItems: "center", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title="Back"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                </svg>
              </button>
              {/* ✕ close (desktop) */}
              <button
                onClick={onClose}
                className="info-panel-close"
                style={{
                  width: 38, height: 38, borderRadius: "50%", border: "none",
                  background: "transparent", color: "var(--c-fg-1)",
                  placeItems: "center", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                title="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
              <span style={{ fontWeight: 600, fontSize: 16, flex: 1, color: "var(--c-fg-0)" }}>Project Info</span>
            </div>

            {/* Tabs — underline style */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--c-line)",
                padding: "0 8px",
                flexShrink: 0,
              }}
            >
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onTabChange(key)}
                  style={{
                    flex: 1,
                    padding: "12px 8px",
                    border: "none",
                    borderBottom: tab === key ? "2px solid var(--c-accent)" : "2px solid transparent",
                    marginBottom: -1,
                    background: "transparent",
                    fontSize: 13, fontWeight: 500,
                    color: tab === key ? "var(--c-accent)" : "var(--c-fg-2)",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--c-fg-0)"; }}
                  onMouseLeave={(e) => { if (tab !== key) (e.currentTarget as HTMLElement).style.color = "var(--c-fg-2)"; }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {tab === "overview" && <OverviewTab project={project} />}
              {tab === "team" && <TeamTab project={project} roles={roles} isOnline={isOnline} loadingAction={loadingAction} onDoAction={doAction} onSelectRole={onSelectRole} />}
            </div>
          </>
        )}
      </div>
    </>
  );
}
