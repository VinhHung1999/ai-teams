import { useEffect, useRef } from "react";

type OnDashboard = (data: any) => void;

function getWsUrl(): string {
  if (typeof window === "undefined") return "";
  const { hostname, protocol } = window.location;
  const wsProtocol = protocol === "https:" ? "wss" : "ws";
  if (hostname.includes("hungphu.work")) {
    const apiHost = hostname.replace("scrum-team", "scrum-api");
    return `${wsProtocol}://${apiHost}/ws/board`;
  }
  return `${wsProtocol}://${hostname}:17070/ws/board`;
}

/**
 * Persistent WebSocket for real-time board updates.
 * Single connection, survives project switches via subscribe messages.
 */
export function useBoardWs(
  projectId: number | null,
  onDashboard: OnDashboard,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onDashboard);
  callbackRef.current = onDashboard;
  const projectRef = useRef(projectId);
  projectRef.current = projectId;

  // Single effect: connect once, reconnect on close
  useEffect(() => {
    let alive = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function sendSubscribe(ws: WebSocket) {
      const pid = projectRef.current;
      if (pid !== null && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "subscribe", projectId: pid }));
      }
    }

    function connect() {
      if (!alive) return;
      const url = getWsUrl();
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => sendSubscribe(ws);

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "dashboard") callbackRef.current(data);
        } catch {}
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (alive) reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      alive = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []); // mount once, never re-run

  // Send subscribe when projectId changes (no reconnect)
  useEffect(() => {
    projectRef.current = projectId;
    if (projectId !== null && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "subscribe", projectId }));
    }
  }, [projectId]);
}
