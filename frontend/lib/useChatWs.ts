"use client";

import { useEffect, useRef } from "react";
import type { ChatEvent } from "./chat-types";

// ── Module-level singleton WS ─────────────────────────────────────────────────
// At most 1 active WS. Switching project → close old, open new immediately.
// eventsCache preserves accumulated events per project across switches.

interface ActiveEntry {
  ws: WebSocket;
  projectId: number;
  alive: boolean;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

let active: ActiveEntry | null = null;
const eventsCache = new Map<number, ChatEvent[]>();

type Listener = (projectId: number, fresh: ChatEvent[]) => void;
const listeners = new Set<Listener>();

function getChatWsUrl(projectId: number): string {
  if (typeof window === "undefined") return "";
  const { hostname, protocol } = window.location;
  const wsProto = protocol === "https:" ? "wss" : "ws";
  if (hostname.includes("hungphu.work")) {
    return `${wsProto}://${hostname.replace("scrum-team", "scrum-api")}/ws/chat?projectId=${projectId}`;
  }
  return `${wsProto}://${hostname}:17070/ws/chat?projectId=${projectId}`;
}

function closeActive() {
  if (!active) return;
  active.alive = false;
  if (active.reconnectTimer) { clearTimeout(active.reconnectTimer); active.reconnectTimer = undefined; }
  if (active.ws.readyState === WebSocket.OPEN || active.ws.readyState === WebSocket.CONNECTING) {
    active.ws.close();
  }
  active = null;
}

function openForProject(projectId: number) {
  closeActive();
  const entry: ActiveEntry = { ws: null as any, projectId, alive: true };
  active = entry;

  function connect() {
    if (!entry.alive) return;
    const url = getChatWsUrl(projectId);
    if (!url) return;
    const ws = new WebSocket(url);
    entry.ws = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string);
        if (msg.type !== "chat_events" || !Array.isArray(msg.events)) return;
        const incoming = msg.events as ChatEvent[];
        if (incoming.length === 0) return;

        // Id-dedup against cache
        const cached = eventsCache.get(projectId) ?? [];
        const existingIds = new Set(cached.map((ev) => ev.id));
        const fresh = incoming.filter((ev) => !existingIds.has(ev.id));
        if (fresh.length === 0) return;

        eventsCache.set(projectId, [...cached, ...fresh]);
        for (const cb of listeners) cb(projectId, fresh);
      } catch {}
    };

    ws.onclose = () => {
      if (!entry.alive) return; // intentional close — do not reconnect
      entry.reconnectTimer = setTimeout(connect, 3000);
    };

    ws.onerror = () => ws.close();
  }

  connect();
}

// ── Public cache accessor ─────────────────────────────────────────────────────
// Use in handleSelectProject for instant restore while fresh history loads.
export function getCachedChatEvents(projectId: number): ChatEvent[] {
  return eventsCache.get(projectId) ?? [];
}

// ── Store fresh history into cache (called after initial history fetch) ───────
export function seedChatCache(projectId: number, events: ChatEvent[]) {
  eventsCache.set(projectId, events);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChatWs(
  projectId: number | null,
  onNewEvents: (events: ChatEvent[]) => void,
) {
  const callbackRef = useRef(onNewEvents);
  callbackRef.current = onNewEvents;

  // Subscribe to module-level listener pool
  useEffect(() => {
    const cb: Listener = (pid, fresh) => {
      if (pid !== projectId) return;
      callbackRef.current(fresh);
    };
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  }, [projectId]);

  // Open / close WS on projectId change
  useEffect(() => {
    if (!projectId) { closeActive(); return; }
    openForProject(projectId);
    return closeActive;
  }, [projectId]);
}
