"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatEvent } from "@/lib/chat-types";

interface ChatStreamProps {
  events: ChatEvent[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  filterRole?: string;
  className?: string;
}

// ── Role colors (matches design CSS) ──────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  PO:   "#8b5cf6",
  TL:   "#3b82f6",
  BE:   "#10b981",
  FE:   "#f59e0b",
  QA:   "#ec4899",
  SM:   "#f43f5e",
  DEV:  "#71717a",
  BOSS: "#3390ec",
};

const ROLE_GRADIENT: Record<string, string> = {
  PO:   "linear-gradient(135deg,#a78bfa,#7c3aed)",
  TL:   "linear-gradient(135deg,#60a5fa,#2563eb)",
  BE:   "linear-gradient(135deg,#34d399,#059669)",
  FE:   "linear-gradient(135deg,#fbbf24,#d97706)",
  QA:   "linear-gradient(135deg,#f472b6,#db2777)",
  SM:   "linear-gradient(135deg,#fb7185,#e11d48)",
  DEV:  "linear-gradient(135deg,#a1a1aa,#52525b)",
  BOSS: "linear-gradient(135deg,#60a5fa,#3390ec)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDaySep(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const key = (date: Date) => date.toISOString().slice(0, 10);
  if (key(d) === key(now)) return "TODAY";
  if (key(d) === key(yesterday)) return "YESTERDAY";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function SimpleMarkdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div style={{ fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n");
          return (
            <pre
              key={i}
              style={{
                margin: "6px 0 4px",
                padding: "10px 12px",
                borderRadius: 8,
                background: "rgba(0,0,0,0.06)",
                fontFamily: "var(--font-geist-mono, monospace)",
                fontSize: 12.5,
                lineHeight: 1.55,
                overflowX: "auto",
                whiteSpace: "pre",
                color: "var(--c-fg-0)",
              }}
            >
              {lang && (
                <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--c-fg-2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, fontFamily: "inherit" }}>
                  {lang}
                </span>
              )}
              {code}
            </pre>
          );
        }
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((p, j) =>
              p.startsWith("`") ? (
                <code key={j} style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(0,0,0,0.06)", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 13, color: "var(--c-fg-0)" }}>
                  {p.slice(1, -1)}
                </code>
              ) : <span key={j}>{p}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}

// ── Tool cards (glass style) ─────────────────────────────────────────────────

function ToolUseCard({ event }: { event: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tool = event.tool!;

  const inputSummary = (() => {
    const inp = tool.input;
    if (!inp) return "";
    if (inp.file_path) return inp.file_path as string;
    if (inp.command) return (inp.command as string).slice(0, 80);
    if (inp.path) return inp.path as string;
    return "";
  })();

  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid var(--c-line)",
        background: "rgba(0,0,0,0.04)",
        overflow: "hidden",
        fontSize: 12,
        marginTop: 4,
      }}
    >
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-2 text-left"
        style={{ padding: "8px 12px", background: "transparent", color: "var(--c-fg-1)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.04)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>🔧</span>
        <span style={{ fontFamily: "var(--font-geist-mono, monospace)", fontWeight: 600, color: "var(--c-fg-0)" }}>{tool.name}</span>
        {inputSummary && <span style={{ color: "var(--c-fg-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inputSummary}</span>}
        <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--c-fg-3)" }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && tool.input && (
        <pre
          style={{
            padding: "0 12px 8px",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 11.5,
            color: "var(--c-fg-1)",
            overflowX: "auto",
            maxHeight: 192,
            overflowY: "auto",
            borderTop: "1px solid var(--c-line)",
          }}
        >
          {JSON.stringify(tool.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultCard({ event }: { event: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tool = event.tool!;
  const output = String(tool.output ?? "");
  const truncated = output.length > 1000;
  const displayOutput = truncated && !expanded ? output.slice(0, 1000) + "…" : output;

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${tool.isError ? "rgba(239,68,68,0.3)" : "var(--c-line)"}`,
        background: tool.isError ? "rgba(239,68,68,0.06)" : "rgba(0,0,0,0.03)",
        overflow: "hidden",
        fontSize: 12,
        marginTop: 4,
      }}
    >
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-2 text-left"
        style={{ padding: "6px 12px", background: "transparent", color: "var(--c-fg-2)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.03)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <span>{tool.isError ? "❌" : "✓"}</span>
        <span style={{ fontFamily: "var(--font-geist-mono, monospace)", color: "var(--c-fg-2)" }}>{tool.name}</span>
        <span style={{ marginLeft: "auto", flexShrink: 0, color: "var(--c-fg-3)" }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <pre
          style={{
            padding: "0 12px 8px",
            fontFamily: "var(--font-geist-mono, monospace)",
            fontSize: 11.5,
            color: "var(--c-fg-2)",
            overflowX: "auto",
            maxHeight: 192,
            overflowY: "auto",
            borderTop: "1px solid var(--c-line)",
            whiteSpace: "pre-wrap",
          }}
        >
          {displayOutput}
        </pre>
      )}
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ event, prevRole }: { event: ChatEvent; prevRole?: string }) {
  const isBoss = event.role === "BOSS";
  const sameAuthor = prevRole === event.role;
  const roleColor = ROLE_COLOR[event.role] ?? "#71717a";
  const roleGradient = ROLE_GRADIENT[event.role] ?? ROLE_GRADIENT.DEV;

  return (
    <div
      className="flex items-end gap-2"
      style={{
        justifyContent: isBoss ? "flex-end" : "flex-start",
        marginTop: sameAuthor ? 1 : 8,
      }}
    >
      {/* Left avatar (agent) */}
      {!isBoss && (
        <div
          style={{
            width: 28, height: 28,
            borderRadius: "50%",
            background: sameAuthor ? "transparent" : roleGradient,
            flexShrink: 0,
            marginBottom: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 600, fontSize: 11,
            visibility: sameAuthor ? "hidden" : "visible",
          }}
        >
          {event.role[0]}
        </div>
      )}

      {/* Bubble column */}
      <div
        className="chat-bubble-col"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isBoss ? "flex-end" : "flex-start",
        }}
      >
        {/* Author row (only first message in a sequence) */}
        {!sameAuthor && !isBoss && (
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: roleColor }}>
            {event.role}
          </div>
        )}

        {/* Bubble */}
        <div
          className="glass-bubble"
          style={{
            background: isBoss ? "rgba(220,250,200,0.95)" : "rgba(255,255,255,0.96)",
            borderRadius: 14,
            ...(isBoss ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: sameAuthor ? 14 : 4 }),
            padding: "7px 12px 6px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            color: "var(--c-fg-0)",
            position: "relative",
          }}
        >
          {event.text && <SimpleMarkdown text={event.text} />}

          {/* Time float right */}
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
            {formatTime(event.timestamp)}
          </span>
        </div>
      </div>

      {/* Right avatar (BOSS) */}
      {isBoss && (
        <div
          style={{
            width: 28, height: 28,
            borderRadius: "50%",
            background: sameAuthor ? "transparent" : roleGradient,
            flexShrink: 0,
            marginBottom: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 600, fontSize: 11,
            visibility: sameAuthor ? "hidden" : "visible",
          }}
        >
          B
        </div>
      )}
    </div>
  );
}

// ── Day separator ─────────────────────────────────────────────────────────────

function DaySeparator({ iso }: { iso: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 8px" }}>
      <span
        style={{
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          color: "white",
          fontSize: 12,
          fontWeight: 500,
          padding: "4px 10px",
          borderRadius: 12,
        }}
      >
        {formatDaySep(iso)}
      </span>
    </div>
  );
}

// ── Event row (with tool cards in bubble-width column) ────────────────────────

function EventRow({ event, prevRole, prevDay }: { event: ChatEvent; prevRole?: string; prevDay?: string }) {
  const thisDay = dayKey(event.timestamp);
  const showDaySep = prevDay !== undefined && prevDay !== thisDay;

  return (
    <>
      {showDaySep && <DaySeparator iso={event.timestamp} />}
      {event.kind === "message" && (
        <MessageBubble event={event} prevRole={prevRole} />
      )}
      {event.kind === "tool_use" && (
        <div style={{ marginLeft: event.role === "BOSS" ? "auto" : 36, marginRight: event.role === "BOSS" ? 36 : "auto", maxWidth: "65%" }}>
          <ToolUseCard event={event} />
        </div>
      )}
      {event.kind === "tool_result" && (
        <div style={{ marginLeft: event.role === "BOSS" ? "auto" : 36, marginRight: event.role === "BOSS" ? 36 : "auto", maxWidth: "65%" }}>
          <ToolResultCard event={event} />
        </div>
      )}
    </>
  );
}

// ── Main ChatStream ───────────────────────────────────────────────────────────

export function ChatStream({ events, loading, hasMore, onLoadMore, filterRole, className = "" }: ChatStreamProps) {
  const visibleEvents = filterRole
    ? events.filter((e) => e.role === "BOSS" || e.role === filterRole)
    : events;

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

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
    if (isAtBottomRef.current) scrollToBottom();
  }, [visibleEvents.length, scrollToBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || !hasMore || !onLoadMore) return;
    if (el.scrollTop < 80) onLoadMore();
  };

  if (visibleEvents.length === 0 && !loading) {
    return (
      <div className={`flex-1 flex items-center justify-center ${className}`} style={{ color: "var(--c-fg-2)", fontSize: 14 }}>
        {filterRole
          ? `No messages with ${filterRole} yet.`
          : "No messages yet — chat sẽ xuất hiện khi pane PO/DEV chạy."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto chat-scroll ${className}`}
      style={{ padding: "12px 0" }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 0 }}>
        {loading && (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--c-fg-2)", padding: "8px 0" }}>
            Loading older messages…
          </div>
        )}
        {hasMore && !loading && (
          <button
            onClick={onLoadMore}
            style={{ textAlign: "center", fontSize: 12, color: "var(--c-accent)", padding: "4px 0", background: "transparent", border: "none", cursor: "pointer" }}
          >
            Load more
          </button>
        )}

        {/* Inject day separator before the very first event */}
        {visibleEvents.length > 0 && <DaySeparator iso={visibleEvents[0].timestamp} />}

        {visibleEvents.map((e, i) => (
          <EventRow
            key={e.id}
            event={e}
            prevRole={i > 0 ? visibleEvents[i - 1].role : undefined}
            prevDay={i > 0 ? dayKey(visibleEvents[i - 1].timestamp) : dayKey(e.timestamp)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
