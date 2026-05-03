"use client";

import type { Project } from "@/lib/types";

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
      {/* NO "All" chip — per Boss decision */}
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

            {/* Text: name + status — hidden on very small screens via parent overflow */}
            <div className="text-left leading-tight">
              <div
                className="font-semibold whitespace-nowrap"
                style={{
                  fontSize: 13,
                  color: isActive ? "var(--c-accent)" : "var(--c-fg-0)",
                }}
              >
                {role}
              </div>
              <div
                className="whitespace-nowrap topic-status-text"
                style={{
                  fontSize: 11,
                  color: project?.tmux_active ? "var(--c-accent)" : "var(--c-fg-2)",
                }}
              >
                {project?.tmux_active ? "online" : "offline"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
