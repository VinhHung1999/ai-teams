"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/lib/types";

interface TeamListProps {
  projects: Project[];
  activeId: number | null;
  onSelect: (id: number) => void;
  lastEvents?: Record<number, string>;
  lastEventAt?: Record<number, string>;
  lastReadAt?: Record<number, string>;
  onCreateTeam?: (newId: number) => void;
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
  unread: boolean;
  onSelect: () => void;
}

function TeamItem({ project, active, preview, unread, onSelect }: TeamItemProps) {
  const isOnline = project.tmux_active ?? false;
  const letter = project.name.charAt(0).toUpperCase();

  return (
    <button
      onClick={onSelect}
      className="w-full text-left flex items-center gap-3 px-3 py-2"
      style={{
        background: active ? "var(--c-bg-active)" : "transparent",
        transition: "background 0.1s",
        minWidth: 0,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "var(--c-bg-hover)";
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
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

      {/* Unread dot */}
      {unread && !active && (
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--c-accent)", flexShrink: 0 }} />
      )}
    </button>
  );
}


// ── NewTeamModal ──────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function NewTeamModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [name, setName] = useState("");
  const [workDir, setWorkDir] = useState("");
  const [teamName, setTeamName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [roles, setRoles] = useState("PO DEV QC CMO");
  const [nameEdited, setNameEdited] = useState(false);
  const [sessionEdited, setSessionEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nameEdited) setTeamName(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    if (!sessionEdited) setSessionName(toSlug(name));
  }, [name, nameEdited, sessionEdited]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !workDir.trim()) { setError("Name and Working Directory are required"); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/create-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          workingDir: workDir.trim(),
          teamName: teamName.trim(),
          sessionName: sessionName.trim(),
          roles: roles.trim(),
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSent();
    } catch (err: any) {
      setError(err.message ?? "Failed to send instruction");
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 38, borderRadius: 8, border: "1px solid var(--c-line)",
    padding: "0 12px", fontSize: 13, fontFamily: "monospace",
    background: "rgba(0,0,0,0.04)", color: "var(--c-fg-0)", outline: "none", width: "100%",
  };
  const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const capStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--c-fg-2)", textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: "100%", maxWidth: 420,
          background: "var(--c-bg-list-glass)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          borderRadius: 16, border: "1px solid var(--c-line)",
          boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
          padding: "24px 24px 20px",
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--c-fg-0)" }}>New Team</div>
        <div style={{ fontSize: 12, color: "var(--c-fg-2)" }}>Sends scaffold instruction to PO agent via /tmux-team:create-team</div>

        <label style={labelStyle}>
          <span style={capStyle}>Project Name *</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="my-project" style={{ ...inputStyle, fontFamily: "inherit", fontSize: 14 }} />
        </label>

        <label style={labelStyle}>
          <span style={capStyle}>Working Directory *</span>
          <input value={workDir} onChange={(e) => setWorkDir(e.target.value)} placeholder="/Users/you/projects/my-project" style={inputStyle} />
        </label>

        <div style={{ display: "flex", gap: 10 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            <span style={capStyle}>Team folder name</span>
            <input value={teamName} onChange={(e) => { setTeamName(e.target.value); setNameEdited(true); }} placeholder="scrum-team" style={inputStyle} />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            <span style={capStyle}>tmux session</span>
            <input value={sessionName} onChange={(e) => { setSessionName(e.target.value); setSessionEdited(true); }} placeholder="scrum_team" style={inputStyle} />
          </label>
        </div>

        <label style={labelStyle}>
          <span style={capStyle}>Roles</span>
          <input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder="PO DEV QC CMO" style={inputStyle} />
        </label>

        {error && <div style={{ fontSize: 13, color: "#ef4444" }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" onClick={onClose}
            style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid var(--c-line)", background: "transparent", color: "var(--c-fg-1)", fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={submitting || !name.trim() || !workDir.trim()}
            style={{ height: 36, padding: "0 20px", borderRadius: 8, border: "none", background: submitting || !name.trim() || !workDir.trim() ? "rgba(0,0,0,0.1)" : "var(--c-accent)", color: submitting || !name.trim() || !workDir.trim() ? "var(--c-fg-3)" : "white", fontSize: 14, fontWeight: 600, cursor: submitting || !name.trim() || !workDir.trim() ? "not-allowed" : "pointer" }}>
            {submitting ? "Sending…" : "Send to PO"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── TeamList ──────────────────────────────────────────────────────────────────

export function TeamList({
  projects,
  activeId,
  onSelect,
  lastEvents = {},
  lastEventAt = {},
  lastReadAt = {},
  onCreateTeam,
}: TeamListProps) {
  const [showModal, setShowModal] = useState(false);
  const [sentToast, setSentToast] = useState(false);

  const sorted = [...projects].sort((a, b) => {
    const aTs = lastEventAt[a.id] ?? "0";
    const bTs = lastEventAt[b.id] ?? "0";
    return bTs.localeCompare(aTs) || a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full" style={{ minWidth: 0, overflow: "hidden" }}>
      {/* Search bar + New Team button */}
      <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0" style={{ borderBottom: "1px solid var(--c-line)" }}>
        <div
          className="flex-1 flex items-center gap-2 px-3"
          style={{ height: 36, background: "rgba(0,0,0,0.04)", borderRadius: 18, color: "var(--c-fg-2)", fontSize: 13 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
          </svg>
          <span style={{ color: "var(--c-fg-2)" }}>Search</span>
        </div>
        {onCreateTeam && (
          <button
            onClick={() => setShowModal(true)}
            title="New Team"
            style={{
              width: 36, height: 36, borderRadius: "50%", border: "none", flexShrink: 0,
              background: "rgba(0,0,0,0.04)", color: "var(--c-accent)",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        )}
      </div>

      {/* Team list */}
      <div className="flex-1 overflow-y-auto chat-scroll">
        {sorted.length === 0 ? (
          <p className="p-4 text-sm" style={{ color: "var(--c-fg-2)" }}>No teams found.</p>
        ) : (
          sorted.map((p) => {
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
              />
            );
          })
        )}
      </div>

      {sentToast && (
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, background: "#10b981", color: "white", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500, zIndex: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.15)" }}>
          Instruction sent to PO — team will be scaffolded shortly.
        </div>
      )}
      {showModal && (
        <NewTeamModal
          onClose={() => setShowModal(false)}
          onSent={() => {
            setShowModal(false);
            setSentToast(true);
            setTimeout(() => setSentToast(false), 4000);
          }}
        />
      )}
    </div>
  );
}
