"use client";

import type { CSSProperties, FC } from "react";

import { cn } from "@/lib/utils";

export interface HeaderRolePillsProps {
  roles: string[];
  activeRole: string;
  onRoleChange: (role: string) => void;
  activity?: Record<string, boolean>;
}

const ROLE_GRADIENTS: Record<string, { from: string; to: string; ring: string; dot: string }> = {
  PO:  { from: "from-[#a78bfa]", to: "to-[#7c3aed]", ring: "ring-[#a78bfa]/40", dot: "bg-[#a78bfa]" },
  DEV: { from: "from-[#34d399]", to: "to-[#059669]", ring: "ring-[#34d399]/40", dot: "bg-[#34d399]" },
  TL:  { from: "from-[#60a5fa]", to: "to-[#2563eb]", ring: "ring-[#60a5fa]/40", dot: "bg-[#60a5fa]" },
  BE:  { from: "from-[#34d399]", to: "to-[#059669]", ring: "ring-[#34d399]/40", dot: "bg-[#34d399]" },
  FE:  { from: "from-[#fbbf24]", to: "to-[#d97706]", ring: "ring-[#fbbf24]/40", dot: "bg-[#fbbf24]" },
  QA:  { from: "from-[#f472b6]", to: "to-[#db2777]", ring: "ring-[#f472b6]/40", dot: "bg-[#f472b6]" },
  SM:  { from: "from-[#fb7185]", to: "to-[#e11d48]", ring: "ring-[#fb7185]/40", dot: "bg-[#fb7185]" },
};

const FALLBACK = { from: "from-slate-500", to: "to-slate-700", ring: "ring-slate-500/40", dot: "bg-slate-500" };

export const HeaderRolePills: FC<HeaderRolePillsProps> = ({ roles, activeRole, onRoleChange, activity }) => {
  return (
    <div
      className="flex gap-2 py-2 px-3 overflow-x-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" } as CSSProperties}
    >
      {roles.map((role) => {
        const isActive = role === activeRole;
        const hasActivity = activity?.[role] === true;
        const colors = ROLE_GRADIENTS[role] ?? FALLBACK;

        const base =
          "relative inline-flex items-center justify-center rounded-full px-3 py-1.5 text-sm min-h-[44px] whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
        const activeCls = `bg-gradient-to-br ${colors.from} ${colors.to} text-white ring-2 ${colors.ring}`;
        const inactiveCls =
          "bg-card/40 text-muted-foreground border border-border/40 hover:bg-card/70";

        return (
          <button
            key={role}
            type="button"
            aria-pressed={isActive}
            onClick={() => onRoleChange(role)}
            className={cn(base, isActive ? activeCls : inactiveCls)}
          >
            {role}
            {hasActivity && (
              <span
                aria-hidden="true"
                className={cn("absolute top-1 right-1 h-2 w-2 rounded-full animate-pulse", colors.dot)}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};
