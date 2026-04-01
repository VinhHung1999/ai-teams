"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Module-level single active WS ───────────────────────────────────────────
// At any time, at most 1 WS connection is open.
// Switching role/project: close old WS, create new one.
// Output cache is preserved across switches — cached data shown instantly.

interface ActiveEntry {
  ws: WebSocket;
  session: string;
  role: string;
  pingInterval?: ReturnType<typeof setInterval>;
  reconnectTimer?: ReturnType<typeof setTimeout>;
  alive: boolean;
}

let active: ActiveEntry | null = null;

// "session:role" → latest output (persists across WS creates and project switches)
const outputCache = new Map<string, string>();

// Registered hook callbacks
type Listener = (session: string, role: string, output: string, isActive?: boolean) => void;
const listeners = new Set<Listener>();

function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const { hostname, protocol } = window.location;
  const wsProto = protocol === "https:" ? "wss" : "ws";
  if (hostname.includes("hungphu.work")) {
    return `${wsProto}://${hostname.replace("scrum-team", "scrum-api")}/ws/tmux-pane`;
  }
  return `${wsProto}://${hostname}:17070/ws/tmux-pane`;
}

function closeActive() {
  if (!active) return;
  active.alive = false;
  if (active.pingInterval) { clearInterval(active.pingInterval); active.pingInterval = undefined; }
  if (active.reconnectTimer) { clearTimeout(active.reconnectTimer); active.reconnectTimer = undefined; }
  if (active.ws.readyState === WebSocket.OPEN || active.ws.readyState === WebSocket.CONNECTING) {
    active.ws.close();
  }
  active = null;
}

function createAndSubscribe(session: string, role: string) {
  closeActive(); // ensure only 1 WS at a time

  const entry: ActiveEntry = { ws: null as any, session, role, alive: true };
  active = entry;

  function connect() {
    if (!entry.alive) return;
    const url = getWsUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    entry.ws = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "subscribe", session: entry.session, role: entry.role }));
      entry.pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 30000);
    };

    ws.onmessage = (e) => {
      if (e.data === "pong") return;
      try {
        const data = JSON.parse(e.data);
        if (!data.output || data.output.length === 0) return;
        const key = `${entry.session}:${entry.role}`;
        outputCache.set(key, data.output);
        for (const cb of listeners) cb(entry.session, entry.role, data.output, data.isActive);
      } catch {}
    };

    ws.onclose = () => {
      if (entry.pingInterval) { clearInterval(entry.pingInterval); entry.pingInterval = undefined; }
      if (!entry.alive) return; // intentional close — do not reconnect
      // Network drop: reconnect same session/role
      entry.reconnectTimer = setTimeout(connect, 3000);
    };

    // onerror: do NOT change state — onclose handles it
    ws.onerror = () => ws.close();
  }

  connect();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

type OnActivity = (role: string, isActive: boolean) => void;

export function useTmuxWs(
  sessionName: string | undefined,
  activeRole: string,
  onActivity?: OnActivity,
): {
  outputs: Record<string, string>;
  wsStatus: "connecting" | "connected" | "disconnected";
} {
  const [outputs, setOutputs] = useState<Record<string, string>>({});
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");

  const sessionRef = useRef(sessionName);
  const roleRef = useRef(activeRole);
  sessionRef.current = sessionName;
  roleRef.current = activeRole;
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  // RAF batching: buffer rapid output updates, flush once per animation frame
  const pendingUpdatesRef = useRef<Record<string, { output: string; isActive?: boolean }>>({});
  const rafScheduledRef = useRef(false);

  const loadCacheSnapshot = useCallback((session: string) => {
    const prefix = `${session}:`;
    const snap: Record<string, string> = {};
    for (const [k, v] of outputCache) {
      if (k.startsWith(prefix)) snap[k.slice(prefix.length)] = v;
    }
    setOutputs(snap);
  }, []);

  const refreshStatus = useCallback(() => {
    if (!active || active.session !== sessionRef.current || active.role !== roleRef.current) {
      setWsStatus("disconnected");
      return;
    }
    const state = active.ws?.readyState;
    if (state === WebSocket.OPEN) setWsStatus("connected");
    else if (state === WebSocket.CONNECTING) setWsStatus("connecting");
    else setWsStatus("disconnected");
  }, []);

  // Register module-level listener (RAF-batched output + immediate activity)
  useEffect(() => {
    const cb: Listener = (session, role, output, isActive) => {
      if (session !== sessionRef.current) return;
      pendingUpdatesRef.current[role] = { output, isActive };

      // Route isActive immediately — activity indicators are time-sensitive
      if (typeof isActive === "boolean" && onActivityRef.current) {
        onActivityRef.current(role, isActive);
      }

      if (!rafScheduledRef.current) {
        rafScheduledRef.current = true;
        requestAnimationFrame(() => {
          const updates = pendingUpdatesRef.current;
          pendingUpdatesRef.current = {};
          rafScheduledRef.current = false;
          setOutputs(prev => {
            let changed = false;
            const next = { ...prev };
            for (const [r, { output: o }] of Object.entries(updates)) {
              if (next[r] !== o) { next[r] = o; changed = true; }
            }
            return changed ? next : prev;
          });
          refreshStatus();
        });
      }
    };
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, [refreshStatus]);

  // React to session/role changes: close old WS, open new one
  useEffect(() => {
    if (!sessionName || !activeRole) {
      closeActive();
      setWsStatus("disconnected");
      setOutputs({});
      return;
    }

    // Show cached output immediately — no blank flash on switch
    loadCacheSnapshot(sessionName);

    // Open new WS for this role (closes previous)
    createAndSubscribe(sessionName, activeRole);
    refreshStatus();

    // Poll status until WS confirmed open
    const t = setInterval(refreshStatus, 400);
    return () => {
      clearInterval(t);
      closeActive();
    };
  }, [sessionName, activeRole, loadCacheSnapshot, refreshStatus]);

  return { outputs, wsStatus };
}
