"use client";
import type { FC } from "react";
import { Avatar, type AvatarKind } from "./Avatar";

const ROLE_LABEL: Record<string, string> = {
  PO: "Product Owner",
  TL: "Tech Lead",
  BE: "Backend",
  FE: "Frontend",
  QA: "QA",
  SM: "Scrum Master",
  DEV: "Developer",
};

export interface Reaction { emo: string; n: number }

export interface BubbleMessage {
  from: AvatarKind;          // role or 'ME' (mine)
  text?: string;
  time: string;              // "10:18"
  same?: boolean;            // same author as previous → hide avatar+author
  reactions?: Reaction[];
}

export interface BubbleProps {
  m: BubbleMessage;
  mine?: boolean;            // user's own message (from === 'ME' in design)
}

const DoubleCheckIcon: FC<{ size?: number; className?: string }> = ({ size = 14, className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 12 9 18 21 6" />
    <polyline points="9 12 13 16 21 6" />
  </svg>
);

export const Bubble: FC<BubbleProps> = ({ m, mine = false }) => {
  const tail = mine ? "tail-me" : !m.same ? "tail-them" : "";
  return (
    <div className={`msg-row${mine ? " me" : ""}${m.same ? " same" : ""}`}>
      {!mine && <Avatar kind={m.from} size="sm" />}
      <div className={`bubble ${tail}`}>
        {!mine && !m.same && (
          <div className="bubble-author" style={{ color: `var(--role-${m.from})` }}>
            {ROLE_LABEL[m.from] ?? m.from}
          </div>
        )}
        {m.text && <div className="bubble-text">{m.text}</div>}
        {m.reactions && m.reactions.length > 0 && (
          <div className="reactions">
            {m.reactions.map((r, i) => (
              <span key={i} className="reaction">{r.emo} {r.n}</span>
            ))}
          </div>
        )}
        <span className="bubble-meta">
          {m.time}
          {mine && <DoubleCheckIcon size={14} className="tick" />}
        </span>
      </div>
    </div>
  );
};
