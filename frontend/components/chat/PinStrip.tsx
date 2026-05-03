"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Sprint } from "@/lib/types";

interface PinStripProps {
  projectId: number | null;
  onClick: () => void;
}

export function PinStrip({ projectId, onClick }: PinStripProps) {
  const [sprint, setSprint] = useState<Sprint | null>(null);

  useEffect(() => {
    if (!projectId) { setSprint(null); return; }
    api.listSprints(projectId)
      .then((sprints) => {
        const active = sprints.find((s) => s.status === "active") ?? null;
        setSprint(active);
      })
      .catch(() => setSprint(null));
  }, [projectId]);

  if (!sprint) return null;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 text-left flex-shrink-0"
      style={{
        background: "var(--c-bg-list-glass)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderBottom: "1px solid var(--c-line)",
        padding: "6px 16px",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "var(--c-bg-list-glass)")}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 3, height: 28,
          background: "var(--c-accent)",
          borderRadius: 2,
          flexShrink: 0,
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--c-accent)", lineHeight: 1.3 }}>
          Sprint {sprint.number}
          {sprint.goal && ` · ${sprint.goal.slice(0, 60)}${sprint.goal.length > 60 ? "…" : ""}`}
        </div>
        <div
          style={{
            fontSize: 13, color: "var(--c-fg-1)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}
        >
          Click to view board
        </div>
      </div>

      {/* Pin icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--c-fg-3)", flexShrink: 0 }}>
        <path d="M12 17v5"/><path d="M9 10.76V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4.76l2 2.24v2H7v-2l2-2.24z"/>
      </svg>
    </button>
  );
}
