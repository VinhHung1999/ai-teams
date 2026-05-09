"use client";
import { useEffect, useRef, type FC } from "react";
import { Ic, type IconName } from "./icons";

interface AttachItem { kind: string; label: string; icon: IconName; color: string }

const ITEMS: AttachItem[] = [
  { kind: "file",  label: "File",            icon: "file",  color: "#3b82f6" },
  { kind: "image", label: "Photo or video",  icon: "image", color: "#10b981" },
  { kind: "task",  label: "Task card",       icon: "task",  color: "#a78bfa" },
  { kind: "poll",  label: "Poll",            icon: "poll",  color: "#f59e0b" },
  { kind: "link",  label: "Link / PR",       icon: "link",  color: "#ec4899" },
];

export interface AttachMenuProps {
  /** Close handler — parent controls visibility. */
  onClose: () => void;
  /** Optional select handler (currently stub-only; logic deferred S51). */
  onSelect?: (kind: string) => void;
}

export const AttachMenu: FC<AttachMenuProps> = ({ onClose, onSelect }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  // Click-outside closes
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    // Defer 1 tick so the click that opened the menu doesn't immediately close it
    const t = setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => { clearTimeout(t); document.removeEventListener("click", onDocClick); };
  }, [onClose]);

  return (
    <div className="attach-menu" ref={ref}>
      {ITEMS.map((it) => (
        <button
          key={it.kind}
          className="attach-item"
          type="button"
          onClick={() => { onSelect?.(it.kind); onClose(); }}
        >
          <span className="attach-icon" style={{ background: it.color }}>
            <Ic name={it.icon} size={18} />
          </span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
};
