/**
 * Custom SVG glyphs for tool cards.
 * 14×14 viewBox, 1.5 stroke, rounded caps. Unified visual language.
 * Emoji deliberately avoided — looks casual / inconsistent across platforms.
 */
import React from "react";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 14 14",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const ReadIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 2.5h5.5L11 5v6.5H3z" />
    <path d="M5 6h4M5 8h4M5 10h2.5" />
  </svg>
);

export const EditIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M9.5 2.5l2 2-7 7H2.5v-2z" />
    <path d="M8.5 3.5l2 2" />
  </svg>
);

export const WriteIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3 2.5h5.5L11 5v6.5H3z" />
    <path d="M5.5 8l1 1 2.5-2.5" />
  </svg>
);

export const BashIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M2.5 4l2 2-2 2" />
    <path d="M6 10h5.5" />
  </svg>
);

export const GrepIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="6" r="3" />
    <path d="M8.3 8.3l3 3" />
  </svg>
);

export const GlobIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M7 2.5v9M3 4.5l8 5M3 9.5l8-5" />
  </svg>
);

export const WebIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M2.5 7h9" />
    <path d="M7 2.5c1.6 1.5 1.6 7.5 0 9" />
    <path d="M7 2.5c-1.6 1.5-1.6 7.5 0 9" />
  </svg>
);

export const TaskIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="7" cy="7" r="4.5" />
    <circle cx="7" cy="7" r="1.6" fill="currentColor" stroke="none" />
  </svg>
);

export const TodoIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="2.5" width="9" height="9" rx="2" />
    <path d="M5 7l1.4 1.4L9 5.6" />
  </svg>
);

export const NotebookIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <path d="M3.5 2.5h7v9h-7z" />
    <path d="M3.5 5h7M5 2.5v9" />
  </svg>
);

export const DefaultIcon = (p: IconProps) => (
  <svg {...base} {...p}>
    <circle cx="3.5" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="7" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const ICON_MAP: Record<string, (p: IconProps) => React.ReactElement> = {
  Read: ReadIcon,
  Edit: EditIcon,
  MultiEdit: EditIcon,
  Write: WriteIcon,
  Bash: BashIcon,
  BashOutput: BashIcon,
  Grep: GrepIcon,
  Glob: GlobIcon,
  WebFetch: WebIcon,
  WebSearch: WebIcon,
  Task: TaskIcon,
  TodoWrite: TodoIcon,
  NotebookEdit: NotebookIcon,
};

export function getToolIcon(name: string) {
  return ICON_MAP[name] ?? DefaultIcon;
}
