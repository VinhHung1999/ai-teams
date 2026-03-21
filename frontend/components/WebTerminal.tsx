"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface WebTerminalProps {
  wsUrl: string;
  sessionName?: string;
  initialCommand?: string;
  className?: string;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

const RECONNECT_DELAY = 2000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function WebTerminal({
  wsUrl,
  sessionName,
  initialCommand,
  className = "",
  onConnected,
  onDisconnected,
}: WebTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const reconnectAttempts = useRef(0);
  const initialCommandSent = useRef(false);
  const mountedRef = useRef(true);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use refs for callbacks to avoid useEffect re-triggering
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  onConnectedRef.current = onConnected;
  onDisconnectedRef.current = onDisconnected;

  // Stable wsUrl with session name
  const fullWsUrl = sessionName
    ? `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}name=${encodeURIComponent(sessionName)}`
    : wsUrl;

  useEffect(() => {
    if (!containerRef.current) return;
    mountedRef.current = true;
    initialCommandSent.current = false;
    reconnectAttempts.current = 0;

    // Create xterm ONCE
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'IBM Plex Mono', 'Menlo', monospace",
      scrollback: 5000,
      theme: {
        background: "#1a1b26",
        foreground: "#c0caf5",
        cursor: "#c0caf5",
        cursorAccent: "#1a1b26",
        selectionBackground: "#33467c",
        black: "#15161e",
        red: "#f7768e",
        green: "#9ece6a",
        yellow: "#e0af68",
        blue: "#7aa2f7",
        magenta: "#bb9af7",
        cyan: "#7dcfff",
        white: "#a9b1d6",
        brightBlack: "#414868",
        brightRed: "#f7768e",
        brightGreen: "#9ece6a",
        brightYellow: "#e0af68",
        brightBlue: "#7aa2f7",
        brightMagenta: "#bb9af7",
        brightCyan: "#7dcfff",
        brightWhite: "#c0caf5",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // Connect WebSocket (can be called multiple times for reconnect)
    function connectWs() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempts.current = 0;
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
        }
        onConnectedRef.current?.();

        if (initialCommand && !initialCommandSent.current) {
          initialCommandSent.current = true;
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(initialCommand + "\n");
            }
          }, 300);
        }
      };

      ws.onmessage = (event) => {
        term.write(event.data);
      };

      ws.onclose = () => {
        onDisconnectedRef.current?.();
        if (!mountedRef.current) return;

        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts.current++;
          const delay = RECONNECT_DELAY * reconnectAttempts.current;
          term.write(`\r\n\x1b[90m[reconnecting in ${delay / 1000}s...]\x1b[0m`);
          reconnectTimer.current = setTimeout(connectWs, delay);
        } else {
          term.write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
        }
      };

      ws.onerror = () => {};
    }

    // Forward terminal input
    const inputDisposable = term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      const dims = fitAddon.proposeDimensions();
      if (dims && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: dims.cols, rows: dims.rows }));
      }
    });
    resizeObserver.observe(containerRef.current);

    // Start connection
    connectWs();

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      resizeObserver.disconnect();
      inputDisposable.dispose();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [fullWsUrl, initialCommand]); // Only re-run if URL or command changes

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ padding: "4px" }}
    />
  );
}
