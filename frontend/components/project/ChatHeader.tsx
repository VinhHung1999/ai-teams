"use client";
import type { FC } from "react";
import { Avatar, type AvatarKind } from "./Avatar";
import { Ic } from "./icons";

export interface ChatHeaderProps {
  name: string;
  sub: string;
  avatarKind?: AvatarKind;     // default "team"
  onBack?: () => void;          // mobile back button
  onWhoClick?: () => void;      // open info panel
  onSearchClick?: () => void;   // search action
  onMoreClick?: () => void;     // more actions / info
}

export const ChatHeader: FC<ChatHeaderProps> = ({
  name, sub, avatarKind = "team",
  onBack, onWhoClick, onSearchClick, onMoreClick,
}) => (
  <div className="chat-header">
    <button className="back-btn" onClick={onBack} type="button" aria-label="Back">
      <Ic name="arrowLeft" size={22} />
    </button>
    <Avatar kind={avatarKind} size="sm" />
    <div className="who" onClick={onWhoClick} role="button" tabIndex={0}
         onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && onWhoClick) { e.preventDefault(); onWhoClick(); } }}>
      <div className="name">{name}</div>
      <div className="sub">{sub}</div>
    </div>
    <button className="icon-btn" onClick={onSearchClick} type="button" title="Search" aria-label="Search">
      <Ic name="search" size={20} />
    </button>
    <button className="icon-btn" onClick={onMoreClick} type="button" title="Info" aria-label="Info">
      <Ic name="more" size={20} />
    </button>
  </div>
);
