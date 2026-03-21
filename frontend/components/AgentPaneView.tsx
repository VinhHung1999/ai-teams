"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface AgentPaneViewProps {
  sessionName: string;
  role: string;
  isVisible: boolean;
}

const SPECIAL_KEYS: Record<string, string> = {
  Enter: "Enter", Backspace: "BSpace", Tab: "Tab", Escape: "Escape",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Delete: "DC", Home: "Home", End: "End", PageUp: "PPage", PageDown: "NPage",
};

export function AgentPaneView({ sessionName, role, isVisible }: AgentPaneViewProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [output, setOutput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const prevOutputLen = useRef(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch pane content
  const fetchPaneContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/pane/${encodeURIComponent(role)}`);
      if (res.ok) {
        const data = await res.json();
        setOutput(data.output || "");
      }
    } catch {}
  }, [sessionName, role]);

  // Polling
  useEffect(() => {
    if (!isVisible) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }
    fetchPaneContent();
    pollingRef.current = setInterval(fetchPaneContent, 500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isVisible, fetchPaneContent]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && outputRef.current && output.length !== prevOutputLen.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    prevOutputLen.current = output.length;
  }, [output, autoScroll]);

  const handleScroll = () => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  // Send text
  const sendKeys = async (keys: string) => {
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, keys }),
      });
    } catch {}
  };

  // Send special key
  const sendSpecialKey = async (key: string) => {
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key }),
      });
    } catch {}
  };

  // Send message (chat mode)
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isPending) return;
    setIsPending(true);
    await sendKeys(inputValue);
    await sendSpecialKey("Enter");
    setInputValue("");
    setTimeout(() => setIsPending(false), 500);
  };

  // Handle key events in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSendMessage();
      return;
    }

    // Ctrl+C → send to pane
    if (e.ctrlKey && e.key === "c") {
      e.preventDefault();
      sendSpecialKey("C-c");
      return;
    }

    // Arrow up/down → send to pane
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      sendSpecialKey(SPECIAL_KEYS[e.key]);
      return;
    }
  };

  const outputHtml = ansiToHtml(output);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-auto p-3 bg-[#1a1b26] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <pre
          className="font-mono text-[13px] whitespace-pre text-[#c0caf5] leading-relaxed"
          style={{ overflowWrap: "normal", wordBreak: "normal" }}
          dangerouslySetInnerHTML={{ __html: outputHtml }}
        />
      </div>

      {/* Streaming badge + scroll button */}
      {!autoScroll && (
        <div className="absolute bottom-14 right-4 z-10">
          <button
            onClick={() => {
              setAutoScroll(true);
              if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
            }}
            className="h-8 w-8 rounded-full shadow-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90"
          >
            ↓
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/40 bg-card px-3 py-2 shrink-0">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPending ? "Sending..." : `Message ${role}...`}
            disabled={isPending}
            className="flex-1 font-mono text-sm h-9 px-3 rounded-md bg-muted/30 border border-border/40 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 disabled:opacity-50"
            autoComplete="off"
          />
          <button
            onClick={() => sendSpecialKey("C-c")}
            className="h-9 w-9 rounded-md flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            title="Stop (Ctrl+C)"
          >
            ■
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isPending}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-xs font-mono hover:bg-primary/90 disabled:opacity-30 shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── ANSI to HTML ─── */
function ansiToHtml(text: string): string {
  const colors: Record<string, string> = {
    "30": "#15161e", "31": "#f7768e", "32": "#9ece6a", "33": "#e0af68",
    "34": "#7aa2f7", "35": "#bb9af7", "36": "#7dcfff", "37": "#a9b1d6",
    "90": "#414868", "91": "#f7768e", "92": "#9ece6a", "93": "#e0af68",
    "94": "#7aa2f7", "95": "#bb9af7", "96": "#7dcfff", "97": "#c0caf5",
  };

  let html = escapeHtml(text);
  html = html.replace(/\x1b\[([0-9;]+)m/g, (_, codes) => {
    const parts = codes.split(";");
    let style = "";
    for (const code of parts) {
      if (code === "0") return '</span>';
      if (code === "1") style += "font-weight:bold;";
      if (code === "3") style += "font-style:italic;";
      if (code === "4") style += "text-decoration:underline;";
      if (colors[code]) style += `color:${colors[code]};`;
    }
    return style ? `<span style="${style}">` : "";
  });
  html = html.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
  html = html.replace(/\x1b\][^\x07]*\x07/g, "");
  html = html.replace(/\x1b\].*?(?:\x1b\\|\x07)/g, "");
  return html;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
