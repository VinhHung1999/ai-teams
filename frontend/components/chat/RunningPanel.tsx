"use client";

// [382] Iter 3 — RunningPanel surfaces transient agent activity (tools
// + thinking) separately from the chat conversation.
//
// Activity = tools that appeared after the last assistant-response
// message + the current single-slot thinking state. The panel hides
// when both are empty, and fades after 3s of no new activity.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { parsePane, deriveActivity, type ToolBubble, type ThinkingBubble } from "@/lib/chatParser";
import { getToolIcon } from "./tool-icons";

const IDLE_FADE_MS = 3000;

const ToolChipView = memo(function ToolChipView({ bubble }: { bubble: ToolBubble }) {
  const Icon = getToolIcon(bubble.name);
  return (
    <div className="flex flex-col" style={{ marginTop: 4, maxWidth: "100%" }}>
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
});

const ThinkingMiniView = memo(function ThinkingMiniView({ bubble }: { bubble: ThinkingBubble }) {
  return (
    <div className="flex items-center gap-2" style={{ marginTop: 4, opacity: 0.7 }}>
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
});

interface RunningPanelProps {
  output: string;
  viewingRole: string;
  className?: string;
}

export function RunningPanel({ output, viewingRole, className = "" }: RunningPanelProps) {
  const toolsCacheRef = useRef<Map<string, ToolBubble>>(new Map());
  const thinkingRef = useRef<ThinkingBubble | null>(null);
  const lastActivityKeyRef = useRef<string>("");
  const [hiddenByIdle, setHiddenByIdle] = useState(false);

  const { tools, thinking } = useMemo(() => {
    const parsed = parsePane(output, viewingRole);
    const activity = deriveActivity(parsed, viewingRole);
    const cache = toolsCacheRef.current;
    const next = new Map<string, ToolBubble>();
    const stableTools = activity.tools.map((nt) => {
      const prev = cache.get(nt.id);
      const reuse =
        prev && prev.name === nt.name && prev.args === nt.args && prev.result === nt.result
          ? prev
          : nt;
      next.set(nt.id, reuse);
      return reuse;
    });
    toolsCacheRef.current = next;

    let stableThinking: ThinkingBubble | null = null;
    if (activity.thinking) {
      const prev = thinkingRef.current;
      stableThinking =
        prev && prev.id === activity.thinking.id && prev.text === activity.thinking.text
          ? prev
          : activity.thinking;
    }
    thinkingRef.current = stableThinking;

    return { tools: stableTools, thinking: stableThinking };
  }, [output, viewingRole]);

  // Idle-fade: if no new activity arrives within IDLE_FADE_MS, hide the panel.
  // The "activity key" snapshots ids + result lengths so a tool result update
  // counts as fresh activity.
  const activityKey = useMemo(() => {
    const parts = tools.map((t) => `${t.id}:${t.result.length}`);
    if (thinking) parts.push(`th:${thinking.id}`);
    return parts.join("|");
  }, [tools, thinking]);

  useEffect(() => {
    if (!activityKey) return;
    if (activityKey !== lastActivityKeyRef.current) {
      lastActivityKeyRef.current = activityKey;
      setHiddenByIdle(false);
    }
    const timer = setTimeout(() => setHiddenByIdle(true), IDLE_FADE_MS);
    return () => clearTimeout(timer);
  }, [activityKey]);

  const isEmpty = tools.length === 0 && !thinking;
  if (isEmpty || hiddenByIdle) return null;

  return (
    <div
      className={`shrink-0 ${className}`}
      style={{
        background: "var(--c-bg-list-glass, rgba(0,0,0,0.02))",
        borderTop: "1px solid var(--c-line, rgba(0,0,0,0.06))",
        padding: "8px 16px",
        transition: "opacity 200ms ease",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: "var(--c-fg-2)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            marginBottom: 2,
          }}
        >
          Running
        </div>
        {tools.map((t) => (
          <ToolChipView key={t.id} bubble={t} />
        ))}
        {thinking && <ThinkingMiniView key={thinking.id} bubble={thinking} />}
      </div>
    </div>
  );
}
