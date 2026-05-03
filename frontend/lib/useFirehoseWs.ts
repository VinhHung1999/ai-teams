"use client";

import { useEffect, useRef } from "react";
import type { ChatEvent } from "./chat-types";

interface FirehoseEvent {
  type: "chat_events";
  projectId: number;
  events: ChatEvent[];
}

type FirehoseCallback = (projectId: number, events: ChatEvent[]) => void;

export function useFirehoseWs(onEvents: FirehoseCallback) {
  const cbRef = useRef(onEvents);
  cbRef.current = onEvents;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let dead = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (dead) return;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/chat/firehose`);

      ws.onmessage = (e) => {
        try {
          const msg: FirehoseEvent = JSON.parse(e.data);
          if (msg.type === "chat_events" && msg.projectId != null) {
            cbRef.current(msg.projectId, msg.events);
          }
        } catch {}
      };

      ws.onclose = () => {
        if (!dead) retryTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      dead = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws?.close();
    };
  }, []);
}
