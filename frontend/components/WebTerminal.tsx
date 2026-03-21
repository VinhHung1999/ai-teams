"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

interface WebTerminalProps {
  /** WebSocket URL to connect to PTY backend */
  wsUrl: string;
  /** Session name for persistent sessions (e.g. "boss-42", "agent-PO") */
  sessionName?: string;
  /** Auto-run this command when terminal connects (only on first connect) */
  initialCommand?: string;
  /** Additional CSS class */
  className?: string;
  /** Callback when terminal connects */
  onConnected?: () => void;
  /** Callback when terminal disconnects */
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

  // Build full WebSocket URL with session name
  const getWsUrl = useCallback(() => {
    const separator = wsUrl.includes("?") ? "&" : "?";
    return sessionName
      ? `${wsUrl}${separator}name=${encodeURIComponent(sessionName)}`
      : wsUrl;
  }, [wsUrl, sessionName]);

  // Connect/reconnect WebSocket (without recreating xterm)
  const connectSocket = useCallback(() => {
    const term = termRef.current;
    const fitAddon = fitRef.current;
    if (!term || !fitAddon || !mountedRef.current) return;

    // Close existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }

    const fullUrl = getWsUrl();
    const ws = new WebSocket(fullUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;

      // Send terminal size
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: dims.cols,
          rows: dims.rows,
        }));
      }

      onConnected?.();

      // Auto-run initial command only on first connect
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
      // Server sends scrollback buffer on connect (instant render)
      // Then ongoing output — xterm handles both the same way
      term.write(event.data);
    };

    ws.onclose = () => {
      onDisconnected?.();
      if (!mountedRef.current) return;

      // Auto-reconnect with backoff
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        const delay = RECONNECT_DELAY * reconnectAttempts.current;
        term.write(`\r\n\x1b[90m[reconnecting in ${delay / 1000}s...]\x1b[0m`);
        setTimeout(() => {
          if (mountedRef.current) connectSocket();
        }, delay);
      } else {
        term.write("\r\n\x1b[90m[disconnected]\x1b[0m\r\n");
      }
    };

    ws.onerror = () => {
      // onclose will fire after this
    };
  }, [getWsUrl, initialCommand, onConnected, onDisconnected]);

  // Create xterm ONCE, connect socket separately
  useEffect(() => {
    if (!containerRef.current) return;
    mountedRef.current = true;
    initialCommandSent.current = false;

    // Create terminal instance (only once per mount)
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
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitRef.current = fitAddon;

    // Forward terminal input to WebSocket
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      const dims = fitAddon.proposeDimensions();
      if (dims && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "resize",
          cols: dims.cols,
          rows: dims.rows,
        }));
      }
    });
    resizeObserver.observe(containerRef.current);

    // Connect WebSocket
    connectSocket();

    return () => {
      mountedRef.current = false;
      resizeObserver.disconnect();
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [connectSocket]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ padding: "4px" }}
    />
  );
}
