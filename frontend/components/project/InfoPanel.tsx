"use client";
import { useState, type FC } from "react";
import { Avatar, type AvatarKind } from "./Avatar";
import { Ic } from "./icons";
import type { Board, BoardItem } from "@/lib/types";
import { BOARD_COLUMNS } from "@/lib/types";

const PRIO_COLOR: Record<string, string> = {
  P0: "var(--c-p0, #ef4444)",
  P1: "var(--c-p1, #f59e0b)",
  P2: "var(--c-p2, #3b82f6)",
  P3: "var(--c-p3, #6b7280)",
};

export interface InfoPanelProps {
  open: boolean;
  onClose: () => void;
  /** Project / team info for hero block */
  name: string;
  sub: string;
  avatarKind?: AvatarKind;       // default "team"
  /** Board data for Overview tab — null = loading/empty. */
  board?: Board | null;
  /** Roles for Agents tab. */
  roles?: string[];
  /** Active topic — Agents tab can call onSelectAgent to switch. */
  onSelectAgent?: (role: string) => void;
}

type Tab = "overview" | "files" | "agents";

export const InfoPanel: FC<InfoPanelProps> = ({
  open, onClose,
  name, sub, avatarKind = "team",
  board, roles = [], onSelectAgent,
}) => {
  const [tab, setTab] = useState<Tab>("overview");
  if (!open) return null;
  return (
    <div className="info-panel">
      <div className="info-head">
        <button className="icon-btn" onClick={onClose} type="button" aria-label="Close">
          <Ic name="x" size={20} />
        </button>
        <div className="title">Project Info</div>
        <button className="icon-btn" type="button" aria-label="Edit (coming soon)" title="Edit (coming soon)">
          <Ic name="edit" size={18} />
        </button>
      </div>

      <div className="info-hero">
        <Avatar kind={avatarKind} size="lg" />
        <div className="info-name">{name}</div>
        <div className="info-sub">{sub}</div>
      </div>

      <div className="info-tabs">
        {(["overview", "files", "agents"] as Tab[]).map((t) => (
          <button
            key={t}
            className={`info-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
            type="button"
          >
            {t === "overview" ? "Overview" : t === "files" ? "Files" : "Agents"}
          </button>
        ))}
      </div>

      <div className="info-body">
        {tab === "overview" && (
          <div className="info-section">
            <div className="lbl">Sprint Board</div>
            {!board && <div style={{ color: "var(--fg-2)", fontSize: 13 }}>No active sprint</div>}
            {board && BOARD_COLUMNS.map(({ key, label }) => {
              const items = (board[key] ?? []) as BoardItem[];
              return (
                <div key={key} className="mini-col">
                  <div className="mini-col-head">
                    {label} <span className="count">{items.length}</span>
                  </div>
                  {items.slice(0, 3).map((it) => (
                    <div key={it.id} className="mini-card">
                      <div className="mini-card-row">
                        <span className="mini-id">{`#${it.backlog_item_id ?? it.id}`}</span>
                        <span className="prio-tag" style={{ background: PRIO_COLOR[it.priority] ?? "var(--fg-3)" }}>
                          {it.priority}
                        </span>
                      </div>
                      <div>{it.title}</div>
                      {it.assignee_role && (
                        <div>
                          <span
                            className="status-chip"
                            style={{
                              background: `var(--role-${it.assignee_role})22`,
                              color: `var(--role-${it.assignee_role})`,
                            }}
                          >
                            {it.assignee_role}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {tab === "files" && (
          <div className="info-section">
            <div className="lbl">Files</div>
            <div style={{ color: "var(--fg-2)", fontSize: 13 }}>No files yet</div>
          </div>
        )}

        {tab === "agents" && (
          <div className="info-section">
            <div className="lbl">Agents · {roles.length}</div>
            {roles.length === 0 && <div style={{ color: "var(--fg-2)", fontSize: 13 }}>No agents configured</div>}
            {roles.map((r) => (
              <button
                key={r}
                className="member-row"
                onClick={() => { onSelectAgent?.(r); onClose(); }}
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 4px", border: 0, background: "transparent",
                  width: "100%", cursor: "pointer", borderRadius: 8,
                  textAlign: "left", color: "var(--fg-0)",
                }}
              >
                <Avatar kind={r as AvatarKind} size="sm" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{r}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
