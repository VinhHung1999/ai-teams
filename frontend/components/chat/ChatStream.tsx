"use client";

// [382] Iter 3 — ChatStream is now bubbles-only.
// Pure conversation: BOSS messages, PO/DEV cross-talk, assistant TEXT
// responses. Tool chips and thinking states live in RunningPanel.

import { memo, useEffect, useMemo, useRef } from "react";
import { parsePane, filterMessages, type MessageBubble } from "@/lib/chatParser";

const ROLE_COLOR: Record<string, string> = {
  PO: "#8b5cf6",
  DEV: "#71717a",
  TL: "#3b82f6",
  BE: "#10b981",
  FE: "#f59e0b",
  QA: "#ec4899",
  SM: "#f43f5e",
  BOSS: "#3390ec",
};

const ROLE_GRADIENT: Record<string, string> = {
  PO: "linear-gradient(135deg,#a78bfa,#7c3aed)",
  DEV: "linear-gradient(135deg,#a1a1aa,#52525b)",
  TL: "linear-gradient(135deg,#60a5fa,#2563eb)",
  BE: "linear-gradient(135deg,#34d399,#059669)",
  FE: "linear-gradient(135deg,#fbbf24,#d97706)",
  QA: "linear-gradient(135deg,#f472b6,#db2777)",
  SM: "linear-gradient(135deg,#fb7185,#e11d48)",
  BOSS: "linear-gradient(135deg,#60a5fa,#3390ec)",
};

const MessageBubbleView = memo(function MessageBubbleView({
  bubble,
  prevRole,
}: {
  bubble: MessageBubble;
  prevRole?: string;
}) {
  const isBoss = bubble.role === "BOSS";
  const sameAuthor = prevRole === bubble.role;
  const roleColor = ROLE_COLOR[bubble.role] ?? "#71717a";
  const roleGradient = ROLE_GRADIENT[bubble.role] ?? ROLE_GRADIENT.DEV;

  return (
    <div
      className="flex items-end gap-2"
      style={{ justifyContent: isBoss ? "flex-end" : "flex-start", marginTop: sameAuthor ? 1 : 8 }}
    >
      {!isBoss && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: sameAuthor ? "transparent" : roleGradient,
            flexShrink: 0,
            marginBottom: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: 11,
            visibility: sameAuthor ? "hidden" : "visible",
          }}
        >
          {bubble.role[0]}
        </div>
      )}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isBoss ? "flex-end" : "flex-start",
          maxWidth: "78%",
          minWidth: 0,
        }}
      >
        {!sameAuthor && !isBoss && (
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: roleColor }}>{bubble.role}</div>
        )}
        <div
          style={{
            background: isBoss ? "rgba(220,250,200,0.95)" : "rgba(255,255,255,0.96)",
            borderRadius: 18,
            ...(isBoss ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: sameAuthor ? 18 : 4 }),
            padding: "7px 12px 6px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            color: "var(--c-fg-0)",
            maxWidth: "100%",
          }}
        >
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.45,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              minWidth: 0,
              fontFamily: "var(--font-geist-mono, monospace)",
            }}
          >
            {bubble.text}
          </div>
          {bubble.timestamp && (
            <span
              style={{
                float: "right",
                fontSize: 11,
                color: "var(--c-fg-2)",
                marginLeft: 8,
                marginTop: 4,
                userSelect: "none",
              }}
            >
              {bubble.timestamp}
            </span>
          )}
        </div>
      </div>
      {isBoss && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: sameAuthor ? "transparent" : roleGradient,
            flexShrink: 0,
            marginBottom: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontWeight: 600,
            fontSize: 11,
            visibility: sameAuthor ? "hidden" : "visible",
          }}
        >
          B
        </div>
      )}
    </div>
  );
});

interface ChatStreamProps {
  output: string;
  viewingRole: string;
  className?: string;
}

export function ChatStream({ output, viewingRole, className = "" }: ChatStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const cacheRef = useRef<Map<string, MessageBubble>>(new Map());

  const messages = useMemo(() => {
    const parsed = parsePane(output, viewingRole);
    const fresh = filterMessages(parsed);
    const cache = cacheRef.current;
    const next = new Map<string, MessageBubble>();
    const stable = fresh.map((nb) => {
      const prev = cache.get(nb.id);
      const reuse =
        prev &&
        prev.text === nb.text &&
        prev.role === nb.role &&
        prev.timestamp === nb.timestamp &&
        prev.source === nb.source
          ? prev
          : nb;
      next.set(nb.id, reuse);
      return reuse;
    });
    cacheRef.current = next;
    return stable;
  }, [output, viewingRole]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isAtBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [output]);

  if (messages.length === 0) {
    return (
      <div
        className={`flex-1 flex items-center justify-center ${className}`}
        style={{ color: "var(--c-fg-2)", fontSize: 14 }}
      >
        {output ? "Đang đợi pane content…" : "Chat sẽ xuất hiện khi pane chạy."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex-1 overflow-y-auto chat-scroll ${className}`}
      style={{ padding: "12px 0", overflowX: "hidden" }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {messages.map((b, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          return <MessageBubbleView key={b.id} bubble={b} prevRole={prev?.role} />;
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
