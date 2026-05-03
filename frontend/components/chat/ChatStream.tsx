"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

function fileBasename(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}

function toolIcon(name: string): string {
  if (name === "Read") return "📖";
  if (name === "Edit" || name === "Write") return "✏️";
  if (name === "Bash") return "💻";
  if (name.includes("Grep") || name === "Glob") return "🔍";
  if (name === "WebFetch" || name === "WebSearch") return "🌐";
  if (name === "Agent" || name === "Task") return "🤖";
  return "⚡";
}

function toolSummary(name: string, input: any): string {
  if (!input) return "";
  if ((name === "Read" || name === "Edit" || name === "Write") && input.file_path) {
    return fileBasename(String(input.file_path));
  }
  if (name === "Bash" && input.command) {
    const cmd = String(input.command);
    return cmd.length > 60 ? cmd.slice(0, 60) + "…" : cmd;
  }
  if ((name.includes("Grep") || name === "Glob") && (input.pattern || input.glob)) {
    const p = String(input.pattern || input.glob);
    return p.length > 60 ? p.slice(0, 60) + "…" : p;
  }
  return "";
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
  table: ({ children }: any) => (
    <div style={{ overflowX: "auto", margin: "4px 0" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>{children}</table>
    </div>
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
      color: "var(--c-fg-0)",
    }}>
      {children}
    </pre>
  ),
};

// ── Compact tool card (tool_use + paired tool_result merged) ──────────────────

function CompactToolCard({ event, result }: { event: ChatEvent; result?: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tool = event.tool!;
  const icon = toolIcon(tool.name);
  const summary = toolSummary(tool.name, tool.input);
  const hasResult = !!result;
  const isError = result?.tool?.isError ?? false;

  return (
    <div style={{ borderLeft: `2px solid ${isError ? "rgba(239,68,68,0.35)" : "var(--c-accent-soft)"}`, marginBottom: 1 }}>
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-1.5 text-left"
        style={{
          padding: "3px 8px", fontSize: 12, lineHeight: 1.5,
          background: isError ? "rgba(239,68,68,0.03)" : "rgba(0,0,0,0.025)",
          color: "var(--c-fg-2)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = isError ? "rgba(239,68,68,0.03)" : "rgba(0,0,0,0.025)")}
      >
        <span style={{ flexShrink: 0, fontSize: 11 }}>{icon}</span>
        <span style={{ fontFamily: "var(--font-geist-mono, monospace)", color: "var(--c-fg-1)", fontWeight: 600, flexShrink: 0 }}>
          {tool.name}
        </span>
        {summary && (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, color: "var(--c-fg-2)", marginLeft: 4 }}>
            {summary}
          </span>
        )}
        <span style={{ marginLeft: "auto", flexShrink: 0, paddingLeft: 6 }}>
          {!hasResult && <span style={{ color: "var(--c-fg-3)", fontSize: 10 }}>…</span>}
          {hasResult && <span style={{ color: isError ? "#ef4444" : "#10b981", fontWeight: 700 }}>{isError ? "✗" : "✓"}</span>}
        </span>
        <span style={{ flexShrink: 0, color: "var(--c-fg-3)", fontSize: 9, marginLeft: 4 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div style={{ padding: "4px 8px 6px", borderTop: "1px solid var(--c-line-soft)", background: "rgba(0,0,0,0.015)" }}>
          {tool.input && (
            <pre style={{
              fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11, color: "var(--c-fg-2)",
              overflowX: "auto", maxHeight: 150, overflowY: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-all", margin: "0 0 4px",
            }}>
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          )}
          {result?.tool?.output != null && (
            <pre style={{
              fontFamily: "var(--font-geist-mono, monospace)", fontSize: 11,
              color: isError ? "#ef4444" : "var(--c-fg-2)",
              overflowX: "auto", maxHeight: 150, overflowY: "auto",
              whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0,
              borderTop: tool.input ? "1px solid var(--c-line-soft)" : "none",
              paddingTop: tool.input ? 4 : 0,
            }}>
              {String(result.tool.output)}
            </pre>
          )}
        </div>
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
          }}
        >
          {event.text && (
            <div style={{ fontSize: 14, lineHeight: 1.45 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {event.text}
              </ReactMarkdown>
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
          }}
        >
          <CompactToolCard
            event={event}
            result={toolResultMap.get(event.tool?.toolUseId ?? "")}
          />
        </div>
      )}
      {/* tool_result events are rendered inline via CompactToolCard — skip separate rendering */}
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
  className?: string;
}

export function ChatStream({ events, loading, hasMore, onLoadMore, filterRole, className = "" }: ChatStreamProps) {
  const filtered = filterRole
    ? events.filter((e) => e.role === "BOSS" || e.role === filterRole)
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
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
