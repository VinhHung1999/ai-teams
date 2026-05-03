"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCard } from "./ToolCard";
import type { ChatEvent } from "@/lib/chat-types";

// ── Role colors ───────────────────────────────────────────────────────────────

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

// ── Markdown components ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mdComponents: Record<string, any> = {
  p: ({ children }: any) => <p style={{ margin: "2px 0", lineHeight: 1.45 }}>{children}</p>,
  h1: ({ children }: any) => <p style={{ fontSize: 16, fontWeight: 700, margin: "6px 0 2px" }}>{children}</p>,
  h2: ({ children }: any) => <p style={{ fontSize: 15, fontWeight: 600, margin: "5px 0 2px" }}>{children}</p>,
  h3: ({ children }: any) => <p style={{ fontSize: 14, fontWeight: 600, margin: "4px 0 2px" }}>{children}</p>,
  a: ({ href, children }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "var(--c-accent)", textDecoration: "underline" }}>{children}</a>
  ),
  ul: ({ children }: any) => <ul style={{ paddingLeft: 18, margin: "3px 0" }}>{children}</ul>,
  ol: ({ children }: any) => <ol style={{ paddingLeft: 18, margin: "3px 0" }}>{children}</ol>,
  li: ({ children }: any) => <li style={{ marginBottom: 1 }}>{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote style={{ borderLeft: "3px solid var(--c-accent-soft)", paddingLeft: 10, margin: "4px 0", color: "var(--c-fg-1)" }}>
      {children}
    </blockquote>
  ),
  th: ({ children }: any) => (
    <th style={{ padding: "4px 8px", borderBottom: "1px solid var(--c-line)", textAlign: "left", fontWeight: 600 }}>{children}</th>
  ),
  td: ({ children }: any) => (
    <td style={{ padding: "3px 8px", borderBottom: "1px solid var(--c-line-soft)" }}>{children}</td>
  ),
  code: ({ className, children }: any) => {
    if (!className) {
      return (
        <code style={{ padding: "1px 5px", borderRadius: 4, background: "rgba(0,0,0,0.06)", fontFamily: "var(--font-geist-mono, monospace)", fontSize: 13, color: "var(--c-fg-0)" }}>
          {children}
        </code>
      );
    }
    return <code className={className}>{children}</code>;
  },
  pre: ({ children }: any) => (
    <pre style={{
      margin: "6px 0 4px", padding: "10px 12px", borderRadius: 8,
      background: "rgba(0,0,0,0.06)", fontFamily: "var(--font-geist-mono, monospace)",
      fontSize: 12.5, lineHeight: 1.55, overflowX: "auto", whiteSpace: "pre",
      color: "var(--c-fg-0)", maxWidth: "100%", boxSizing: "border-box",
      display: "block",
    }}>
      {children}
    </pre>
  ),
  table: ({ children }: any) => (
    <div style={{ overflowX: "auto", maxWidth: "100%", display: "block", margin: "4px 0" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>{children}</table>
    </div>
  ),
};

// ── Message bubble ────────────────────────────────────────────────────────────

// [408] Attachment card — image thumbnail or file chip
function AttachmentCard({ attachment }: { attachment: NonNullable<ChatEvent["attachment"]> }) {
  const [expanded, setExpanded] = useState(false);
  if (attachment.isImage) {
    return (
      <>
        <img
          src={attachment.url}
          alt={attachment.filename}
          onClick={() => setExpanded(true)}
          style={{ maxWidth: 220, maxHeight: 180, borderRadius: 10, cursor: "zoom-in", display: "block", objectFit: "cover" }}
        />
        <div style={{ fontSize: 11, color: "var(--c-fg-2)", marginTop: 2 }}>{attachment.filename}</div>
        {expanded && (
          <div
            onClick={() => setExpanded(false)}
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out" }}
          >
            <img src={attachment.url} alt={attachment.filename} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
          </div>
        )}
      </>
    );
  }
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, background: "rgba(0,0,0,0.05)", textDecoration: "none", color: "var(--c-fg-0)" }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
      </svg>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{attachment.filename}</span>
    </a>
  );
}

function MessageBubble({ event, prevRole }: { event: ChatEvent; prevRole?: string }) {
  const isBoss = event.role === "BOSS";
  const sameAuthor = prevRole === event.role;
  const roleColor = ROLE_COLOR[event.role] ?? "#71717a";
  const roleGradient = ROLE_GRADIENT[event.role] ?? ROLE_GRADIENT.DEV;

  return (
    <div
      className="flex items-end gap-2"
      style={{ justifyContent: isBoss ? "flex-end" : "flex-start", marginTop: sameAuthor ? 1 : 8 }}
    >
      {/* Left avatar */}
      {!isBoss && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: sameAuthor ? "transparent" : roleGradient,
          flexShrink: 0, marginBottom: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 600, fontSize: 11,
          visibility: sameAuthor ? "hidden" : "visible",
        }}>
          {event.role[0]}
        </div>
      )}

      {/* Bubble column */}
      <div
        className="chat-bubble-col"
        style={{ display: "flex", flexDirection: "column", alignItems: isBoss ? "flex-end" : "flex-start" }}
      >
        {!sameAuthor && !isBoss && (
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: roleColor }}>
            {event.role}
          </div>
        )}

        <div
          className="glass-bubble"
          style={{
            background: isBoss ? "rgba(220,250,200,0.95)" : "rgba(255,255,255,0.96)",
            borderRadius: 18,
            ...(isBoss ? { borderBottomRightRadius: 4 } : { borderBottomLeftRadius: sameAuthor ? 18 : 4 }),
            padding: "7px 12px 6px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            color: "var(--c-fg-0)",
            position: "relative",
            overflow: "hidden",
            maxWidth: "100%",
            opacity: event.pending ? 0.6 : 1,
          }}
        >
          {/* [408] Attachment card — replaces raw text for attachment messages */}
          {event.attachment ? (
            <AttachmentCard attachment={event.attachment} />
          ) : event.text && (
            <div style={{ fontSize: 14, lineHeight: 1.45, wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {event.text}
              </ReactMarkdown>
              {event.pending && (
                <span style={{ display: "inline-flex", alignItems: "center", marginLeft: 4, verticalAlign: "middle", color: "var(--c-fg-2)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                  </svg>
                </span>
              )}
            </div>
          )}
          <span style={{ float: "right", fontSize: 11, color: "var(--c-fg-2)", marginLeft: 8, marginTop: 4, userSelect: "none" }}>
            {formatTime(event.timestamp)}
          </span>
        </div>
      </div>

      {/* Right avatar (BOSS) */}
      {isBoss && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: sameAuthor ? "transparent" : roleGradient,
          flexShrink: 0, marginBottom: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "white", fontWeight: 600, fontSize: 11,
          visibility: sameAuthor ? "hidden" : "visible",
        }}>
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
      <span style={{
        background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        color: "white", fontSize: 12, fontWeight: 500, padding: "4px 10px", borderRadius: 12,
      }}>
        {formatDaySep(iso)}
      </span>
    </div>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({
  event,
  prevRole,
  prevDay,
  prevKind,
  toolResultMap,
}: {
  event: ChatEvent;
  prevRole?: string;
  prevDay?: string;
  prevKind?: string;
  toolResultMap: Map<string, ChatEvent>;
}) {
  const thisDay = dayKey(event.timestamp);
  const showDaySep = prevDay !== undefined && prevDay !== thisDay;
  const isConsecutiveTool = event.kind === "tool_use" && prevKind === "tool_use";

  return (
    <>
      {showDaySep && <DaySeparator iso={event.timestamp} />}
      {event.kind === "message" && (
        <MessageBubble event={event} prevRole={prevRole} />
      )}
      {event.kind === "tool_use" && (
        <div
          className="chat-tool-card-col"
          style={{
            marginLeft: event.role === "BOSS" ? "auto" : 36,
            marginRight: event.role === "BOSS" ? 36 : "auto",
            marginTop: isConsecutiveTool ? 0 : 8,
            minWidth: 0,
            maxWidth: "100%",
          }}
        >
          {(() => {
            const result = toolResultMap.get(event.tool?.toolUseId ?? "");
            const status = result
              ? result.tool?.isError ? "error" : "success"
              : "pending";
            return (
              <ToolCard
                name={event.tool?.name ?? "unknown"}
                input={event.tool?.input}
                output={result?.tool?.output != null ? String(result.tool.output) : undefined}
                status={status}
              />
            );
          })()}
        </div>
      )}
      {/* tool_result events are rendered inline via ToolCard — skip separate rendering */}
    </>
  );
}

// ── ChatStream ────────────────────────────────────────────────────────────────

interface ChatStreamProps {
  events: ChatEvent[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  filterRole?: string;
  sendingMessage?: string | null;
  className?: string;
}

export function ChatStream({ events, loading, hasMore, onLoadMore, filterRole, sendingMessage, className = "" }: ChatStreamProps) {
  // [358] BOSS messages only show in the topic they were sent to (targetRole).
  // Legacy events without targetRole fall back to showing in all topics.
  const filtered = filterRole
    ? events.filter((e) =>
        e.role === filterRole ||
        (e.role === "BOSS" && (!e.targetRole || e.targetRole === filterRole))
      )
    : events;

  // Build tool_result lookup (toolUseId → tool_result event)
  const toolResultMap = new Map<string, ChatEvent>();
  for (const e of filtered) {
    if (e.kind === "tool_result" && e.tool?.toolUseId) {
      toolResultMap.set(e.tool.toolUseId, e);
    }
  }

  // Exclude tool_result events from display list (they're embedded in CompactToolCard)
  const displayEvents = filtered.filter((e) => e.kind !== "tool_result");

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
  }, [displayEvents.length, scrollToBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || !hasMore || !onLoadMore) return;
    if (el.scrollTop < 80) onLoadMore();
  };

  if (displayEvents.length === 0 && !loading) {
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
      style={{ padding: "12px 0", overflowX: "hidden" }}
    >
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px", display: "flex", flexDirection: "column", gap: 0, width: "100%", boxSizing: "border-box" }}>
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

        {displayEvents.length > 0 && <DaySeparator iso={displayEvents[0].timestamp} />}

        {displayEvents.map((e, i) => (
          <EventRow
            key={e.id}
            event={e}
            prevRole={i > 0 ? displayEvents[i - 1].role : undefined}
            prevDay={i > 0 ? dayKey(displayEvents[i - 1].timestamp) : dayKey(e.timestamp)}
            prevKind={i > 0 ? displayEvents[i - 1].kind : undefined}
            toolResultMap={toolResultMap}
          />
        ))}
        {/* Ephemeral "sending…" indicator — dismissed when WS confirms arrival */}
        {sendingMessage && (
          <div className="flex items-end gap-2 justify-end" style={{ marginTop: 4, opacity: 0.55 }}>
            <div style={{ fontSize: 12, color: "var(--c-fg-2)", padding: "4px 10px", borderRadius: 12, background: "rgba(0,0,0,0.04)" }}>
              📤 Sending…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
