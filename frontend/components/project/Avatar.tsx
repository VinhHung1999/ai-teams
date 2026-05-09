"use client";
import type { FC, ReactNode } from "react";

export type AvatarKind = "team" | "ME" | "PO" | "TL" | "BE" | "FE" | "QA" | "SM" | "DEV";
export type AvatarStatus = "online" | "thinking" | null | undefined;

export interface AvatarProps {
  kind: AvatarKind;
  size?: "sm" | "md" | "lg";  // default md (54px)
  status?: AvatarStatus;
}

// "Layers" SVG icon for team avatar (from icons.jsx)
const LayersIcon: FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

export const Avatar: FC<AvatarProps> = ({ kind, size = "md", status }) => {
  const cls = `avatar avatar-${kind}` + (size === "sm" ? " avatar-sm" : size === "lg" ? " avatar-lg" : "");
  const iconSize = size === "sm" ? 16 : size === "lg" ? 36 : 22;
  let content: ReactNode;
  if (kind === "team") content = <LayersIcon size={iconSize} />;
  else if (kind === "ME") content = "H";  // Boss initial — keep design literal
  else content = kind;  // role abbreviation: PO, TL, etc
  return (
    <div className={cls}>
      {content}
      {status && <span className={`online-dot${status === "thinking" ? " thinking" : ""}`} />}
    </div>
  );
};
