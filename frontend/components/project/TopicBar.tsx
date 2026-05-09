"use client";
import type { FC } from "react";
import { Avatar } from "./Avatar";

const ROLE_LABEL: Record<string, string> = {
  PO: "Product Owner",
  TL: "Tech Lead",
  BE: "Backend",
  FE: "Frontend",
  QA: "QA",
  SM: "Scrum Master",
  DEV: "Developer",
};

export interface TopicAgent {
  status?: "online" | "thinking" | "offline" | null;
  sub?: string;          // sub-text under role label, e.g., "online", "writing", "idle 2h"
}

export interface TopicBarProps {
  /** Roles to render, in display order. e.g., ["PO","DEV"] */
  roles: string[];
  /** Per-role agent state (status + sub). Missing role = render but no status pulse. */
  agents?: Record<string, TopicAgent>;
  /** Active selected role. */
  active: string;
  /** Click handler — e.g., setTopic(role). */
  onSelect: (role: string) => void;
}

export const TopicBar: FC<TopicBarProps> = ({ roles, agents, active, onSelect }) => (
  <div className="topic-bar">
    {roles.map((r) => {
      const a = agents?.[r];
      const dotStatus = a?.status === "online" || a?.status === "thinking" ? a.status : null;
      const subOnline = dotStatus !== null;
      return (
        <button
          key={r}
          className={`topic${active === r ? " active" : ""}`}
          onClick={() => onSelect(r)}
          type="button"
        >
          <Avatar kind={r as never} size="sm" status={dotStatus} />
          <div className="topic-meta">
            <div className="topic-name">{ROLE_LABEL[r] ?? r}</div>
            <div className={`topic-sub${subOnline ? " online" : ""}`}>{a?.sub ?? ""}</div>
          </div>
        </button>
      );
    })}
  </div>
);
