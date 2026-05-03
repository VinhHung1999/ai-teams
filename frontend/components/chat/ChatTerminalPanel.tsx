"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Project } from "@/lib/types";

interface ChatTerminalPanelProps {
  project: Project | null;
  selectedRole?: string | null; // kept for compat, not used in shell mode
  onClose?: () => void; // optional — not shown when used as tab
  initialWidth?: number;
  dragSide?: "left" | "right";
  className?: string; // for flex-1 min-h-0 when used as tab
}

function getShellWsUrl(projectId: number, cwd: string, cols: number, rows: number): string {
  if (typeof window === "undefined") return "";
  const { hostname, protocol } = window.location;
  const wsProto = protocol === "https:" ? "wss" : "ws";
  const name = encodeURIComponent(`proj-${projectId}-shell`);
  const cwdEnc = encodeURIComponent(cwd);
  if (hostname.includes("hungphu.work")) {
    const apiHost = hostname.replace("scrum-team", "scrum-api");
    return `${wsProto}://${apiHost}/ws/terminal?name=${name}&cwd=${cwdEnc}&cols=${cols}&rows=${rows}`;
  }
  return `${wsProto}://${hostname}:17070/ws/terminal?name=${name}&cwd=${cwdEnc}&cols=${cols}&rows=${rows}`;
}

export function ChatTerminalPanel({
  project,
  onClose,
  initialWidth = 360,
  dragSide = "left",
  className = "",
}: ChatTerminalPanelProps) {
  const termContainerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<any>(null);
  const fitRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const [panelWidth, setPanelWidth] = useState(initialWidth);
  const dragStartXRef = useRef<number | null>(null);
  const dragStartWRef = useRef<number>(initialWidth);

  const projectId = project?.id;
  const cwd = (project as any)?.working_directory as string | undefined;

  // [392] Shell pty terminal — bidirectional, persists per project
  useEffect(() => {
    if (!termContainerRef.current || !projectId || !cwd) return;
    let cancelled = false;
    let ws: WebSocket | null = null;

    (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (!document.querySelector("link[data-xterm]")) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "/_next/static/css/xterm.css";
        link.setAttribute("data-xterm", "1");
        document.head.appendChild(link);
      }
      if (cancelled || !termContainerRef.current) return;

      const term = new Terminal({
        disableStdin: false,
        cursorBlink: true,
        scrollback: 5000,
        fontSize: 12,
        fontFamily: '"JetBrains Mono", "Menlo", "Courier New", monospace',
        theme: {
          background: "#0d1117", foreground: "#c9d1d9",
          black: "#161b22", red: "#ff7b72", green: "#7ee787",
          yellow: "#e3b341", blue: "#79c0ff", magenta: "#d2a8ff",
          cyan: "#a5d6ff", white: "#b1bac4", cursor: "#c9d1d9",
          selectionBackground: "rgba(121,192,255,0.25)",
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(termContainerRef.current);
      try { fit.fit(); } catch {}

      const cols = term.cols || 80;
      const rows = term.rows || 24;

      ws = new WebSocket(getShellWsUrl(projectId, cwd, cols, rows));
      wsRef.current = ws;
      setWsStatus("connecting");

      ws.onopen = () => { if (!cancelled) setWsStatus("connected"); };
      ws.onclose = () => { if (!cancelled) setWsStatus("disconnected"); };
      ws.onerror = () => { if (!cancelled) setWsStatus("disconnected"); };

      ws.onmessage = (e) => {
        const data = typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data as ArrayBuffer);
        term.write(data);
      };

      // Boss typing → pty
      term.onData((data: string) => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(data);
      });

      // Resize observer → fit + notify backend
      const ro = new ResizeObserver(() => {
        try {
          fit.fit();
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
          }
        } catch {}
      });
      ro.observe(termContainerRef.current!);

      termRef.current = term;
      fitRef.current = fit;
      roRef.current = ro;
    })();

    return () => {
      cancelled = true;
      ws?.close();
      wsRef.current = null;
      roRef.current?.disconnect();
      roRef.current = null;
      if (termRef.current) { termRef.current.dispose(); termRef.current = null; }
      fitRef.current = null;
      setWsStatus("disconnected");
    };
  }, [projectId, cwd]);

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    dragStartXRef.current = e.clientX;
    dragStartWRef.current = panelWidth;
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const dx = dragSide === "left"
        ? dragStartXRef.current! - ev.clientX
        : ev.clientX - dragStartXRef.current!;
      setPanelWidth(Math.max(240, Math.min(700, dragStartWRef.current + dx)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth, dragSide]);

  const statusColor = wsStatus === "connected" ? "#7ee787" : wsStatus === "connecting" ? "#e3b341" : "#6e7681";

  // Tab mode: stretch to fill; panel mode: fixed width with drag handle
  const isTabMode = !!className;

  return (
    <div
      className={`chat-terminal-panel flex flex-col ${isTabMode ? className : "flex-shrink-0"}`}
      style={{
        width: isTabMode ? undefined : panelWidth,
        position: "relative", background: "#0d1117",
        borderLeft: !isTabMode && dragSide === "left" ? "1px solid rgba(255,255,255,0.08)" : undefined,
        borderRight: !isTabMode && dragSide === "right" ? "1px solid rgba(255,255,255,0.08)" : undefined,
      }}
    >
      {/* Drag handle — panel mode only */}
      {!isTabMode && <div
        onMouseDown={onDragMouseDown}
        style={{
          position: "absolute",
          [dragSide === "right" ? "right" : "left"]: 0,
          top: 0, bottom: 0, width: 4, cursor: "col-resize", zIndex: 10,
          background: "transparent",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(121,192,255,0.3)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      />}

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
      }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#c9d1d9", flex: 1, fontFamily: "inherit" }}>
          {project?.name ?? "No team"} · Shell
        </span>
        {cwd && (
          <span style={{ fontSize: 10, color: "#6e7681", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>
            {cwd.replace(/^\/Users\/[^/]+/, "~")}
          </span>
        )}
        {!isTabMode && onClose && (
          <button
            onClick={onClose}
            title="Close terminal"
            style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "transparent", color: "#6e7681", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c9d1d9")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6e7681")}
          >✕</button>
        )}
      </div>

      {/* xterm */}
      <div ref={termContainerRef} style={{ flex: 1, overflow: "hidden", padding: "4px" }} />

      {/* Empty state */}
      {!cwd && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 8, color: "#6e7681", fontSize: 13, pointerEvents: "none",
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M8 9l3 3-3 3M13 15h3"/>
          </svg>
          <span>No working directory set</span>
        </div>
      )}
    </div>
  );
}
