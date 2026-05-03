"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useTmuxWs } from "@/lib/useTmuxWs";
import type { Project } from "@/lib/types";

interface ChatTerminalPanelProps {
  project: Project | null;
  selectedRole: string | null;
  onClose: () => void;
  initialWidth?: number;
  dragSide?: "left" | "right"; // which edge has the resize handle
}

export function ChatTerminalPanel({
  project,
  selectedRole,
  onClose,
  initialWidth = 360,
  dragSide = "left",
}: ChatTerminalPanelProps) {
  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const [panelWidth, setPanelWidth] = useState(initialWidth);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartWRef = useRef<number>(initialWidth);

  const sessionName = project?.tmux_session_name ?? undefined;
  const role = selectedRole ?? "PO";

  const { outputs, wsStatus } = useTmuxWs(sessionName, role);
  const output = outputs[role] ?? "";

  // Lazily init xterm.js Terminal (client-only, dynamic import)
  useEffect(() => {
    if (!termContainerRef.current) return;
    let cancelled = false;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      // CSS must be imported once globally — add here if not already
      if (!document.querySelector('link[data-xterm]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/_next/static/css/xterm.css";
        link.setAttribute("data-xterm", "1");
        document.head.appendChild(link);
      }
      if (cancelled || !termContainerRef.current) return;

      const term = new Terminal({
        disableStdin: true,
        cursorBlink: false,
        scrollback: 2000,
        fontSize: 12,
        fontFamily: '"JetBrains Mono", "Menlo", "Courier New", monospace',
        theme: {
          background: "#0d1117",
          foreground: "#c9d1d9",
          black: "#161b22",
          red: "#ff7b72",
          green: "#7ee787",
          yellow: "#e3b341",
          blue: "#79c0ff",
          magenta: "#d2a8ff",
          cyan: "#a5d6ff",
          white: "#b1bac4",
          cursor: "#c9d1d9",
          selectionBackground: "rgba(121,192,255,0.25)",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(termContainerRef.current);
      try { fit.fit(); } catch {}

      termRef.current = term;
      fitRef.current = fit;
    })();

    return () => {
      cancelled = true;
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
        fitRef.current = null;
      }
    };
  }, []);

  // Write full output whenever it changes (clear + rewrite)
  useEffect(() => {
    const term = termRef.current;
    if (!term || !output) return;
    term.reset();
    term.write(output);
    try { fitRef.current?.fit(); } catch {}
  }, [output]);

  // Resize observer — re-fit when panel dimensions change
  useEffect(() => {
    const el = termContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      try { fitRef.current?.fit(); } catch {}
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Drag handle — left edge: drag right = narrower; right edge: drag left = narrower
  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartXRef.current = e.clientX;
    dragStartWRef.current = panelWidth;
    e.preventDefault();

    const onMove = (ev: MouseEvent) => {
      const dx = dragSide === "left"
        ? dragStartXRef.current! - ev.clientX  // left handle: drag left = wider
        : ev.clientX - dragStartXRef.current!; // right handle: drag right = wider
      const w = Math.max(240, Math.min(700, dragStartWRef.current + dx));
      setPanelWidth(w);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  const statusColor = wsStatus === "connected" ? "#7ee787" : wsStatus === "connecting" ? "#e3b341" : "#6e7681";

  return (
    <div
      className="chat-terminal-panel flex flex-col flex-shrink-0"
      style={{
        width: panelWidth, position: "relative", background: "#0d1117",
        borderLeft: dragSide === "left" ? "1px solid rgba(255,255,255,0.08)" : undefined,
        borderRight: dragSide === "right" ? "1px solid rgba(255,255,255,0.08)" : undefined,
      }}
    >
      {/* Drag handle — left or right edge */}
      <div
        onMouseDown={onDragMouseDown}
        style={{
          position: "absolute",
          [dragSide === "right" ? "right" : "left"]: 0,
          top: 0, bottom: 0, width: 4,
          cursor: "col-resize", zIndex: 10,
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(121,192,255,0.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#c9d1d9", flex: 1, fontFamily: "inherit" }}>
          {project?.name ?? "No team"} · {role}
        </span>
        {project?.tmux_session_name && (
          <span style={{ fontSize: 11, color: "#6e7681", fontFamily: "monospace" }}>
            {project.tmux_session_name}
          </span>
        )}
        <button
          onClick={onClose}
          title="Close terminal"
          style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", color: "#6e7681", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#c9d1d9")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#6e7681")}
        >
          ✕
        </button>
      </div>

      {/* xterm container */}
      <div
        ref={termContainerRef}
        style={{ flex: 1, overflow: "hidden", padding: "4px" }}
      />

      {/* Empty state */}
      {!sessionName && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8, color: "#6e7681", fontSize: 13, pointerEvents: "none",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 9l3 3-3 3M13 15h3"/>
          </svg>
          <span>No tmux session</span>
        </div>
      )}
    </div>
  );
}
