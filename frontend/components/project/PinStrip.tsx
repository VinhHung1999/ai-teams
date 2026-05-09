"use client";
import type { FC } from "react";
import { Ic } from "./icons";

export interface PinStripProps {
  /** Top line label, e.g., "Sprint 50" */
  title: string;
  /** Sub-text, e.g., "Implement design 1:1" */
  text: string;
  /** Click → opens info panel typically */
  onClick?: () => void;
}

export const PinStrip: FC<PinStripProps> = ({ title, text, onClick }) => (
  <div
    className="pin-strip"
    onClick={onClick}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
    onKeyDown={(e) => {
      if (onClick && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onClick();
      }
    }}
  >
    <div className="pin-strip-bar" />
    <div className="pin-strip-content">
      <div className="pin-strip-title">{title}</div>
      <div className="pin-strip-text">{text}</div>
    </div>
    <Ic name="pin" size={18} className="pin-icon" />
  </div>
);
