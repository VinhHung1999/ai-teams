"use client";
import type { FC } from "react";
import { Avatar } from "./Avatar";
import { Ic } from "./icons";

export interface ChatItemData {
  id: number;
  name: string;
  time: string;
  last: string;
  from?: string;        // e.g., "PO" — shows as "PO: " prefix on preview
  pinned?: boolean;
  unread?: number;
  isBot?: boolean;
  read?: boolean;       // double-check tick
}

export interface ChatItemProps {
  c: ChatItemData;
  active?: boolean;
  onClick?: () => void;
}

export const ChatItem: FC<ChatItemProps> = ({ c, active, onClick }) => {
  const avatarKind = c.isBot ? "ME" : "team";
  return (
    <button className={`chat-item${active ? " active" : ""}`} onClick={onClick} type="button">
      <Avatar kind={avatarKind} />
      <div className="chat-meta">
        <div className="chat-row1">
          <span className="chat-name">{c.name}</span>
          {c.read && <Ic name="doubleCheck" size={14} className="read-tick" />}
          <span className="chat-time">{c.time}</span>
        </div>
        <div className="chat-row2">
          <span className="preview">
            {c.from && c.from !== "me" && c.from !== "bot" && (
              <span className="from">{c.from}: </span>
            )}
            {c.last}
          </span>
          {c.pinned && !c.unread ? <Ic name="pin" size={14} className="pin-icon" /> : null}
          {c.unread && c.unread > 0 ? <span className="badge-count">{c.unread}</span> : null}
        </div>
      </div>
    </button>
  );
};
