"use client";

// [382] Capture-pane chat — Iteration 2.
// Parses raw tmux capture-pane output into role bubbles, tool chips,
// tool results and a single thinking-state mini-bubble.
//
// Parser order (per spec, first match wins):
//   - skip noise (box-drawing, status footer, cost bar, permission,
//     bottom empty ❯)
//   - ⎿ tool result → attach to nearest tool above
//   - ✻ / ✳ / · thinking → single replace-only thinkingBubble slot
//   - ❯ <text>         → BOSS bubble (no role prefix)
//   - ❯ <ROLE> [HH:mm]: <text> → that role's bubble (tm-send from agent)
//   - ⏺ Name(...)      → compact tool chip
//   - ⏺ <text>         → assistant text bubble (viewingRole)
//   - other            → continuation appended to nearest message above
//
// Incremental render: bubble objects are reference-stable across parses
// (reused via id when content unchanged), and BubbleRow is React.memo'd
// with shallow comparison — unchanged rows do not re-render.

import { memo, useEffect, useMemo, useRef } from "react";
import { getToolIcon } from "./tool-icons";

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

// ── Bubble model ──────────────────────────────────────────────────────────────

type MessageBubble = {
  id: string;
  kind: "message";
  role: string;
  text: string;
  timestamp?: string;
};

type ToolBubble = {
  id: string;
  kind: "tool";
  name: string;
  args: string;
  result: string;
};

type ThinkingBubble = {
  id: string;
  kind: "thinking";
  text: string;
};

type Bubble = MessageBubble | ToolBubble;

// ── Regexes ───────────────────────────────────────────────────────────────────

const ANSI_CSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const ANSI_OSC_RE = /\x1b\].*?(?:\x1b\\|\x07|)/g;

const SENDER_RE = /^([A-Z]{2,})\s*\[(\d{1,2}:\d{2})\]:\s*/;
const TOOL_RE = /^⏺\s+([A-Z][a-zA-Z_0-9]*)\s*\((.*)$/;
const RESULT_RE = /^\s+⎿\s+(.+)/;
const THINKING_RE = /^\s*[✻✳·]\s+(.+)/;
const BOX_ONLY_RE = /^[─━┌┐└┘│┃═]+$/;

function stripAnsi(s: string): string {
  return s.replace(ANSI_OSC_RE, "").replace(ANSI_CSI_RE, "").replace(/\r/g, "");
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  // Box drawing only (any amount of whitespace + box chars)
  if (BOX_ONLY_RE.test(trimmed)) return true;
  // Status footer: starts with [Sonnet | [Opus | [Haiku
  if (/^\[(Sonnet|Opus|Haiku)\b/i.test(trimmed)) return true;
  // Progress bar
  if (trimmed.includes("░░░")) return true;
  // Cost / time bar
  if (trimmed.includes("⏱") || /\d+%\s*\|\s*\$\d/.test(trimmed)) return true;
  // Permission line
  if (/⏵⏵\s*bypass\s+permissions/i.test(trimmed)) return true;
  // Bottom empty prompt
  if (trimmed === "❯") return true;
  return false;
}

function hashShort(s: string): string {
  let h = 0;
  const lim = Math.min(s.length, 64);
  for (let i = 0; i < lim; i++) h = (((h << 5) - h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function truncateArgs(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77) + "…";
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParseResult {
  bubbles: Bubble[];
  thinking: ThinkingBubble | null;
}

export function parsePane(output: string, viewingRole: string): ParseResult {
  const stripped = stripAnsi(output);
  const lines = stripped.split("\n");

  const bubbles: Bubble[] = [];
  let thinking: ThinkingBubble | null = null;
  let seq = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (isNoiseLine(line)) continue;

    // Tool result: ⎿ ... → attach to nearest preceding tool
    const resultMatch = line.match(RESULT_RE);
    if (resultMatch) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.kind === "tool") {
          if (!b.result) b.result = resultMatch[1].trim();
          break;
        }
        if (b.kind === "message") break; // result must follow tool, not message
      }
      thinking = null;
      continue;
    }

    // Thinking: ✻ ✳ · — single slot
    const thinkingMatch = line.match(THINKING_RE);
    if (thinkingMatch && !line.startsWith("⏺ ")) {
      const text = thinkingMatch[1].trim();
      thinking = { id: `thinking-${hashShort(text)}`, kind: "thinking", text };
      continue;
    }

    // BOSS / role input: ❯ ...
    if (line.startsWith("❯ ")) {
      const rest = line.slice(2);
      const senderMatch = rest.match(SENDER_RE);
      if (senderMatch) {
        const text = rest.replace(SENDER_RE, "").trim();
        if (text) {
          bubbles.push({
            id: `msg-${seq++}-${hashShort(senderMatch[1] + text.slice(0, 32))}`,
            kind: "message",
            role: senderMatch[1],
            text,
            timestamp: senderMatch[2],
          });
        }
      } else {
        const text = rest.trim();
        if (text) {
          bubbles.push({
            id: `msg-${seq++}-BOSS-${hashShort(text.slice(0, 32))}`,
            kind: "message",
            role: "BOSS",
            text,
          });
        }
      }
      thinking = null;
      continue;
    }

    // Tool call: ⏺ Name(...
    const toolMatch = line.match(TOOL_RE);
    if (toolMatch) {
      let args = toolMatch[2];
      // strip trailing closing paren if balanced on same line
      if (args.endsWith(")")) {
        // simple heuristic: drop last ')' for display
        args = args.slice(0, -1);
      }
      const name = toolMatch[1];
      bubbles.push({
        id: `tool-${seq++}-${name}-${hashShort(args.slice(0, 48))}`,
        kind: "tool",
        name,
        args: truncateArgs(args),
        result: "",
      });
      thinking = null;
      continue;
    }

    // Assistant text: ⏺ <text>  (already eliminated tool / thinking / result variants)
    if (line.startsWith("⏺ ")) {
      const text = line.slice(2).trim();
      if (!text) continue;
      bubbles.push({
        id: `msg-${seq++}-${viewingRole}-${hashShort(text.slice(0, 32))}`,
        kind: "message",
        role: viewingRole,
        text,
      });
      thinking = null;
      continue;
    }

    // Continuation — append to nearest message bubble (skip extending tools)
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.kind === "message") {
        b.text += "\n" + line;
        break;
      }
      if (b.kind === "tool") break; // tools don't accept message continuation
    }
  }

  return { bubbles, thinking };
}

// ── Render helpers ────────────────────────────────────────────────────────────

function MessageBubbleView({ bubble, prevRole }: { bubble: MessageBubble; prevRole?: string }) {
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
}

function ToolChipView({ bubble }: { bubble: ToolBubble }) {
  const Icon = getToolIcon(bubble.name);
  return (
    <div className="flex flex-col" style={{ marginLeft: 36, marginTop: 6, maxWidth: "78%" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          background: "rgba(0,0,0,0.045)",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: 999,
          fontSize: 12,
          color: "var(--c-fg-1)",
          width: "fit-content",
          maxWidth: "100%",
        }}
      >
        <Icon style={{ color: "var(--c-fg-1)", flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: "var(--c-fg-0)" }}>{bubble.name}</span>
        {bubble.args && (
          <span
            style={{
              color: "var(--c-fg-2)",
              fontFamily: "var(--font-geist-mono, monospace)",
              fontSize: 11.5,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
            }}
          >
            {bubble.args}
          </span>
        )}
      </div>
      {bubble.result && (
        <div
          style={{
            marginTop: 2,
            marginLeft: 12,
            fontSize: 11.5,
            color: "var(--c-fg-2)",
            fontFamily: "var(--font-geist-mono, monospace)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            opacity: 0.85,
          }}
        >
          ⎿ {bubble.result}
        </div>
      )}
    </div>
  );
}

function ThinkingMiniView({ bubble }: { bubble: ThinkingBubble }) {
  return (
    <div
      className="flex items-center gap-2"
      style={{ marginLeft: 36, marginTop: 6, opacity: 0.65 }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--c-fg-2)",
          animation: "status-pulse 1.2s ease-in-out infinite",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 12.5,
          fontStyle: "italic",
          color: "var(--c-fg-2)",
          fontFamily: "var(--font-geist-mono, monospace)",
        }}
      >
        {bubble.text}
      </span>
    </div>
  );
}

// React.memo — shallow compare on bubble + prevRole; unchanged rows skip render.
const MemoBubbleRow = memo(function BubbleRow({
  bubble,
  prevRole,
}: {
  bubble: Bubble;
  prevRole?: string;
}) {
  if (bubble.kind === "tool") return <ToolChipView bubble={bubble} />;
  return <MessageBubbleView bubble={bubble} prevRole={prevRole} />;
});

const MemoThinking = memo(ThinkingMiniView);

// ── ChatStream ────────────────────────────────────────────────────────────────

interface ChatStreamProps {
  output: string;
  viewingRole: string;
  className?: string;
}

export function ChatStream({ output, viewingRole, className = "" }: ChatStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Identity-stable bubble cache: id → previous Bubble reference.
  // When parser yields a bubble whose content matches the cached one,
  // we reuse the cached reference so React.memo can skip re-render.
  const cacheRef = useRef<Map<string, Bubble>>(new Map());
  const thinkingRef = useRef<ThinkingBubble | null>(null);

  const { bubbles, thinking } = useMemo(() => {
    const parsed = parsePane(output, viewingRole);
    const cache = cacheRef.current;
    const nextCache = new Map<string, Bubble>();
    const stable: Bubble[] = parsed.bubbles.map((nb) => {
      const prev = cache.get(nb.id);
      let result: Bubble = nb;
      if (prev && prev.kind === nb.kind) {
        if (prev.kind === "message" && nb.kind === "message") {
          if (prev.text === nb.text && prev.role === nb.role && prev.timestamp === nb.timestamp) {
            result = prev;
          }
        } else if (prev.kind === "tool" && nb.kind === "tool") {
          if (prev.name === nb.name && prev.args === nb.args && prev.result === nb.result) {
            result = prev;
          }
        }
      }
      nextCache.set(nb.id, result);
      return result;
    });
    cacheRef.current = nextCache;

    let stableThinking: ThinkingBubble | null = null;
    if (parsed.thinking) {
      const prev = thinkingRef.current;
      stableThinking =
        prev && prev.id === parsed.thinking.id && prev.text === parsed.thinking.text
          ? prev
          : parsed.thinking;
    }
    thinkingRef.current = stableThinking;

    return { bubbles: stable, thinking: stableThinking };
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

  if (bubbles.length === 0 && !thinking) {
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
        {bubbles.map((b, i) => {
          const prev = i > 0 ? bubbles[i - 1] : null;
          const prevRole = prev && prev.kind === "message" ? prev.role : undefined;
          return <MemoBubbleRow key={b.id} bubble={b} prevRole={prevRole} />;
        })}
        {thinking && <MemoThinking key={thinking.id} bubble={thinking} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
