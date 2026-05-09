"use client";
import type { FC } from "react";

export const ICON_PATHS = {
  search:    '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  more:      '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  arrowLeft: '<path d="M19 12H5M11 19l-7-7 7-7"/>',
  pin:       '<path d="M12 17v5"/><path d="M9 10.76V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4.76l2 2.24v2H7v-2l2-2.24z"/>',
  doubleCheck: '<polyline points="3 12 9 18 21 6"/><polyline points="9 12 13 16 21 6"/>',
  layers:    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IcProps {
  name: IconName;
  size?: number;
  className?: string;
}

export const Ic: FC<IcProps> = ({ name, size = 22, className }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
  />
);
