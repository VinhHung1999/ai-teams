"use client";

import type { FC } from "react";
import Link from "next/link";
import type { Board, BoardColumn as BoardColumnKey, BoardItem } from "@/lib/types";
import { BOARD_COLUMNS } from "@/lib/types";

export interface CompactKanbanProps {
  board: Board | null;
  expandHref: string;
  maxCardsPerLane?: number;
}

// Maps Board key → CSS var suffix in --color-col-{suffix} (see globals.css)
const COL_VAR_SUFFIX: Record<BoardColumnKey, string> = {
  todo: "todo",
  in_progress: "progress",
  in_review: "review",
  testing: "testing",
  done: "done",
};

const PRIORITY_VAR: Record<string, string> = {
  P0: "var(--color-p0)",
  P1: "var(--color-p1)",
  P2: "var(--color-p2)",
  P3: "var(--color-p3)",
};

// Tiny role-pill gradients (mirrors HeaderRolePills, kept inline per slice scope)
const ROLE_GRADIENT: Record<string, string> = {
  PO: "from-[#a78bfa] to-[#7c3aed]",
  DEV: "from-[#34d399] to-[#059669]",
  TL: "from-[#60a5fa] to-[#2563eb]",
  BE: "from-[#34d399] to-[#059669]",
  FE: "from-[#fbbf24] to-[#d97706]",
  QA: "from-[#f472b6] to-[#db2777]",
  SM: "from-[#fb7185] to-[#e11d48]",
};
const ROLE_FALLBACK = "from-slate-500 to-slate-700";

const CompactCard: FC<{ item: BoardItem }> = ({ item }) => {
  const borderColor = PRIORITY_VAR[item.priority] ?? "var(--color-p3)";
  const role = item.assignee_role;
  const gradient = role ? ROLE_GRADIENT[role] ?? ROLE_FALLBACK : null;

  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-card/50 border border-border/30"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <span className="text-sm truncate flex-1 min-w-0">{item.title}</span>
      {role && gradient && (
        <span
          className={`shrink-0 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 bg-gradient-to-br ${gradient} text-white font-medium`}
          style={{ fontSize: "10px", lineHeight: 1 }}
        >
          {role}
        </span>
      )}
    </div>
  );
};

const Skeleton: FC = () => (
  <div className="flex flex-col gap-3" aria-hidden="true">
    {BOARD_COLUMNS.map(({ key }) => (
      <div key={key} className="space-y-1.5">
        <div className="h-4 w-24 bg-muted/40 rounded animate-pulse" />
        <div className="h-7 w-full bg-muted/30 rounded animate-pulse" />
      </div>
    ))}
  </div>
);

export const CompactKanban: FC<CompactKanbanProps> = ({ board, expandHref, maxCardsPerLane = 3 }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground/90">Board</h3>
        <Link
          href={expandHref}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Expand →
        </Link>
      </div>

      {board === null ? (
        <Skeleton />
      ) : (
        <div className="flex flex-col gap-3">
          {BOARD_COLUMNS.map(({ key, label }) => {
            const items = board[key] ?? [];
            const visible = items.slice(0, maxCardsPerLane);
            const colorVar = `var(--color-col-${COL_VAR_SUFFIX[key]})`;

            return (
              <section key={key} className="space-y-1.5">
                <div className="flex items-baseline gap-1.5 px-1">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colorVar }}>
                    {label}
                  </span>
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </div>
                {visible.length === 0 ? (
                  <div className="text-xs text-muted-foreground/60 italic px-2 py-1">empty</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {visible.map((item) => (
                      <CompactCard key={item.id} item={item} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
