"use client";

import { useEffect, useRef } from "react";
import type { ChatEvent } from "./chat-types";

function getChatWsUrl(projectId: number): string {
  if (typeof window === "undefined") return "";
  const { hostname, protocol } = window.location;
  const wsProtocol = protocol === "https:" ? "wss" : "ws";
  if (hostname.includes("hungphu.work")) {
    const apiHost = hostname.replace("scrum-team", "scrum-api");
    return `${wsProtocol}://${apiHost}/ws/chat?projectId=${projectId}`;
  }
  return `${wsProtocol}://${hostname}:17070/ws/chat?projectId=${projectId}`;
}

export function useChatWs(
  projectId: number | null,
  onEvents: (events: ChatEvent[]) => void,
) {
  const callbackRef = useRef(onEvents);
  callbackRef.current = onEvents;

  useEffect(() => {
    if (projectId === null) return;

    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!alive) return;
      const url = getChatWsUrl(projectId!);
      if (!url) return;

      ws = new WebSocket(url);

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "chat_events" && Array.isArray(msg.events)) {
            callbackRef.current(msg.events as ChatEvent[]);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [projectId]);
}
