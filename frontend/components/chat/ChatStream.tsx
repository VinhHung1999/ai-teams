"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { ChatEvent } from "@/lib/chat-types";

interface ChatStreamProps {
  events: ChatEvent[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function roleBadgeClass(role: string): string {
  if (role === "BOSS") return "bg-blue-600 text-white";
  if (role === "PO") return "bg-purple-700 text-white";
  return "bg-emerald-700 text-white";
}

// Very lightweight markdown → plain text with code block detection
function SimpleMarkdown({ text }: { text: string }) {
  // Split on fenced code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="break-words whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n");
          return (
            <pre
              key={i}
              className="my-1 p-2 rounded bg-zinc-950 border border-zinc-700 overflow-x-auto text-xs font-mono text-zinc-200"
            >
              {lang && <span className="text-zinc-500 text-xs">{lang}\n</span>}
              {code}
            </pre>
          );
        }
        // Inline code
        const inlineParts = part.split(/(`[^`]+`)/g);
        return (
          <span key={i}>
            {inlineParts.map((p, j) =>
              p.startsWith("`") ? (
                <code key={j} className="px-1 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs font-mono">
                  {p.slice(1, -1)}
                </code>
              ) : (
                <span key={j}>{p}</span>
              )
            )}
          </span>
        );
      })}
    </div>
  );
}

function ToolUseCard({ event }: { event: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tool = event.tool!;

  const inputSummary = (() => {
    if (!tool.input) return "";
    const inp = tool.input;
    if (inp.file_path) return inp.file_path;
    if (inp.command) return inp.command.slice(0, 80);
    if (inp.path) return inp.path;
    return "";
  })();

  return (
    <div className="my-1 rounded border border-zinc-700 bg-zinc-800/50 text-xs overflow-hidden">
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700/40 transition-colors"
      >
        <span className="text-zinc-400">🔧</span>
        <span className="font-mono text-zinc-200 font-medium">{tool.name}</span>
        {inputSummary && (
          <span className="text-zinc-400 truncate flex-1">{inputSummary}</span>
        )}
        <span className="text-zinc-500 ml-auto flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && tool.input && (
        <pre className="px-3 pb-2 text-xs font-mono text-zinc-300 overflow-x-auto max-h-48 overflow-y-auto border-t border-zinc-700">
          {JSON.stringify(tool.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ToolResultCard({ event }: { event: ChatEvent }) {
  const [expanded, setExpanded] = useState(false);
  const tool = event.tool!;
  const output = tool.output ?? "";
  const truncated = typeof output === "string" && output.length > 1000;
  const displayOutput = truncated && !expanded ? output.slice(0, 1000) + "…" : output;

  return (
    <div className={`my-1 rounded border text-xs overflow-hidden ${tool.isError ? "border-red-800 bg-red-950/30" : "border-zinc-700 bg-zinc-800/30"}`}>
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-700/20 transition-colors"
      >
        <span>{tool.isError ? "❌" : "✓"}</span>
        <span className="font-mono text-zinc-400">{tool.name} result</span>
        <span className="ml-auto text-zinc-500 flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div className="border-t border-zinc-700">
          <pre className="px-3 pb-2 text-xs font-mono text-zinc-400 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {displayOutput}
          </pre>
          {truncated && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="px-3 py-1 text-blue-400 hover:underline"
            >
              Show all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ event }: { event: ChatEvent }) {
  const isBoss = event.role === "BOSS";
  return (
    <div className={`flex gap-2 ${isBoss ? "justify-end" : "justify-start"}`}>
      {!isBoss && (
        <div className={`flex-shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${roleBadgeClass(event.role)}`}>
          {event.role[0]}
        </div>
      )}
      <div className={`max-w-[80%] flex flex-col ${isBoss ? "items-end" : "items-start"}`}>
        <div className="flex items-center gap-2 mb-0.5">
          {!isBoss && <span className="text-[10px] text-zinc-500 font-mono">{event.role}</span>}
          <span className="text-[10px] text-zinc-600">{formatTime(event.timestamp)}</span>
        </div>
        <div className={`px-3 py-2 rounded-xl ${isBoss ? "bg-blue-600 text-white rounded-tr-sm" : "bg-zinc-800 text-zinc-100 rounded-tl-sm"}`}>
          <SimpleMarkdown text={event.text ?? ""} />
        </div>
      </div>
      {isBoss && (
        <div className={`flex-shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${roleBadgeClass(event.role)}`}>
          B
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: ChatEvent }) {
  if (event.kind === "message") return <MessageBubble event={event} />;
  if (event.kind === "tool_use") return (
    <div className="mx-8">
      <ToolUseCard event={event} />
    </div>
  );
  if (event.kind === "tool_result") return (
    <div className="mx-8">
      <ToolResultCard event={event} />
    </div>
  );
  return null;
}

export function ChatStream({ events, loading, hasMore, onLoadMore, className = "" }: ChatStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Track whether user is at bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 60;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to bottom when events arrive (if already at bottom)
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [events.length, scrollToBottom]);

  // Load more on scroll to top
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || !hasMore || !onLoadMore) return;
    if (el.scrollTop < 80) onLoadMore();
  };

  if (events.length === 0 && !loading) {
    return (
      <div className={`flex-1 flex items-center justify-center text-zinc-500 text-sm ${className}`}>
        No messages yet — chat sẽ xuất hiện khi pane PO/DEV chạy.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2 ${className}`}
    >
      {loading && (
        <div className="text-center text-xs text-zinc-500 py-2">Loading older messages…</div>
      )}
      {hasMore && !loading && (
        <button
          onClick={onLoadMore}
          className="text-center text-xs text-blue-400 hover:underline py-1"
        >
          Load more
        </button>
      )}
      {events.map((e) => (
        <EventRow key={e.id} event={e} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
