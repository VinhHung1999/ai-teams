"use client";

import type { FC, ReactNode } from "react";

export interface BoardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export const BoardDrawer: FC<BoardDrawerProps> = ({ isOpen, onClose, children }) => {
  // Mobile: fixed overlay, hidden when !isOpen.
  // Desktop (md+): inline sidebar, always visible regardless of isOpen.
  const containerCls = [
    // Mobile (default)
    isOpen ? "fixed inset-0 z-50" : "hidden",
    // Desktop overrides
    "md:relative md:inset-auto md:z-auto md:block md:w-[340px] md:h-full md:shrink-0",
  ].join(" ");

  return (
    <div className={containerCls} role="dialog" aria-label="Board" aria-modal={isOpen ? true : undefined}>
      {/* Backdrop — mobile only */}
      <button
        type="button"
        aria-label="Close board"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 md:hidden"
      />

      {/* Drawer panel */}
      <aside
        className={[
          // Mobile: slide-in from right
          "absolute right-0 top-0 h-[100dvh] w-[90vw] max-w-sm shadow-2xl",
          "bg-card/40 backdrop-blur-2xl backdrop-saturate-150 border-l border-border/40",
          "transition-transform duration-200",
          isOpen ? "translate-x-0" : "translate-x-full",
          // Desktop: inline, full height, no shadow
          "md:relative md:right-auto md:top-auto md:h-full md:w-full md:max-w-none",
          "md:translate-x-0 md:shadow-none md:transition-none",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 md:hidden">
          <h2 className="text-sm font-semibold">Board</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto h-full p-3">{children}</div>
      </aside>
    </div>
  );
};
