"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";

// ── Circular context-usage ring ───────────────────────────────────────────────
function ContextRing({ pct }: { pct: number }) {
  const r = 7;
  const circ = 2 * Math.PI * r; // ≈ 44
  const filled = (pct / 100) * circ;
  const color = pct >= 80 ? "#ef4444" : pct >= 50 ? "#f59e0b" : "#22c55e";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
      {/* Track */}
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      {/* Fill */}
      <circle
        cx="9" cy="9" r={r} fill="none"
        stroke={color} strokeWidth="2"
        strokeDasharray={`${filled} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 9 9)"
      />
      {/* Pct label for high usage */}
      {pct >= 70 && (
        <text x="9" y="12" textAnchor="middle" fontSize="5.5" fontWeight="600" fill={color}>{pct}</text>
      )}
    </svg>
  );
}

// Role color map matching the design CSS
const ROLE_GRADIENT: Record<string, string> = {
  PO:  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  TL:  "linear-gradient(135deg,#60a5fa,#2563eb)",
  BE:  "linear-gradient(135deg,#34d399,#059669)",
  FE:  "linear-gradient(135deg,#fbbf24,#d97706)",
  QA:  "linear-gradient(135deg,#f472b6,#db2777)",
  SM:  "linear-gradient(135deg,#fb7185,#e11d48)",
  DEV: "linear-gradient(135deg,#a1a1aa,#52525b)",
};

const ROLE_COLOR: Record<string, string> = {
  PO:  "#8b5cf6",
  TL:  "#3b82f6",
  BE:  "#10b981",
  FE:  "#f59e0b",
  QA:  "#ec4899",
  SM:  "#f43f5e",
  DEV: "#71717a",
};

const ROLE_LABEL: Record<string, string> = {
  PO:  "Product Owner",
  TL:  "Tech Lead",
  BE:  "Backend",
  FE:  "Frontend",
  QA:  "QA",
  SM:  "Scrum Master",
  DEV: "Developer",
};

interface TopicBarProps {
  project: Project | null;
  selectedRole: string | null;
  onSelectRole: (role: string) => void;
}

export function TopicBar({ project, selectedRole, onSelectRole }: TopicBarProps) {
  const roles = project?.roles ?? [];

  // [397] Poll context usage every 10s
  const [contextUsage, setContextUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!project?.id) return;
    const fetch10s = () => {
      fetch(`/api/projects/${project.id}/context-usage`)
        .then((r) => r.json())
        .then((data) => setContextUsage(data))
        .catch(() => {});
    };
    fetch10s();
    const t = setInterval(fetch10s, 10_000);
    return () => clearInterval(t);
  }, [project?.id]);

  if (roles.length === 0) return null;

  return (
    <div
      className="glass-header flex items-center gap-1 px-3 py-2 overflow-x-auto flex-shrink-0"
      style={{
        borderBottom: "1px solid var(--c-line)",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {roles.map((role) => {
        const isActive = selectedRole === role;
        const gradient = ROLE_GRADIENT[role] ?? ROLE_GRADIENT.DEV;
        const color = ROLE_COLOR[role] ?? ROLE_COLOR.DEV;
        const label = ROLE_LABEL[role] ?? role;

        return (
          <button
            key={role}
            onClick={() => onSelectRole(role)}
            className="flex items-center gap-2 flex-shrink-0 transition-colors"
            style={{
              padding: "6px 12px 6px 6px",
              borderRadius: 18,
              background: isActive ? "var(--c-accent-soft)" : "transparent",
              border: "none",
            }}
            onMouseEnter={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--c-bg-hover)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* Role avatar with online dot */}
            <div className="relative flex-shrink-0">
              <div
                className="flex items-center justify-center text-white font-semibold"
                style={{
                  width: 28, height: 28,
                  borderRadius: "50%",
                  background: gradient,
                  fontSize: 11,
                }}
              >
                {role.charAt(0)}
              </div>
              {/* Status dot — online when project tmux is active */}
              <span
                className="absolute"
                style={{
                  width: 8, height: 8,
                  borderRadius: "50%",
                  bottom: -1, right: -1,
                  background: (project?.tmux_active) ? "var(--c-status-ok)" : "var(--c-fg-3)",
                  border: "1.5px solid var(--c-bg-list-glass)",
                }}
              />
            </div>

            {/* Text: name + status */}
            <div className="text-left leading-tight">
              <div
                className="font-semibold whitespace-nowrap"
                style={{ fontSize: 13, color: isActive ? "var(--c-accent)" : "var(--c-fg-0)" }}
              >
                {role}
              </div>
              <div
                className="whitespace-nowrap topic-status-text"
                style={{ fontSize: 11, color: project?.tmux_active ? "var(--c-accent)" : "var(--c-fg-2)" }}
              >
                {project?.tmux_active ? "online" : "offline"}
              </div>
            </div>

            {/* [397] Context usage ring */}
            {contextUsage[role] !== undefined && (
              <ContextRing pct={contextUsage[role]} />
            )}
          </button>
        );
      })}

      {/* [392] Terminal tab — opens pty shell in main area */}
      {(() => {
        const isActive = selectedRole === "TERMINAL";
        return (
          <button
            onClick={() => onSelectRole("TERMINAL")}
            className="flex items-center gap-2 flex-shrink-0 transition-colors"
            style={{
              padding: "6px 12px 6px 8px",
              borderRadius: 18,
              background: isActive ? "var(--c-accent-soft)" : "transparent",
              border: "none",
            }}
            onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--c-bg-hover)"; }}
            onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <div className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.12)", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isActive ? "var(--c-accent)" : "#c9d1d9"} strokeWidth="2" strokeLinecap="round">
                <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
              </svg>
            </div>
            <div className="text-left leading-tight">
              <div className="font-semibold whitespace-nowrap" style={{ fontSize: 13, color: isActive ? "var(--c-accent)" : "var(--c-fg-0)" }}>
                Terminal
              </div>
              <div className="whitespace-nowrap topic-status-text" style={{ fontSize: 11, color: "var(--c-fg-2)" }}>
                shell
              </div>
            </div>
          </button>
        );
      })()}
    </div>
  );
}
