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

  // Send text (backend auto-appends Enter)
  const sendText = async (text: string) => {
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text }),
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

  // Send message (backend sends text + Enter)
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isPending) return;
    setIsPending(true);
    await sendText(inputValue);
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

  const outputHtml = ansiToHtml(cleanOutput(output));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ overscrollBehavior: "none" }}>
      {/* Output area - vertical scroll only */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 bg-[#1a1b26] cursor-text"
        style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
        onClick={() => inputRef.current?.focus()}
      >
        <pre
          className="font-mono text-[13px] whitespace-pre-wrap break-words text-[#c0caf5] leading-relaxed"
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

      {/* Input area with safe-area padding */}
      <div className="border-t border-border/40 bg-card px-3 py-2 shrink-0" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isPending ? "Sending..." : `Message ${role}...`}
            disabled={isPending}
            className="flex-1 font-mono h-9 px-3 rounded-md bg-muted/30 border border-border/40 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 disabled:opacity-50"
            style={{ fontSize: "16px" }}
            autoComplete="off"
          />
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

/* ─── Clean output: trim long separator lines ─── */
function cleanOutput(text: string): string {
  // Replace long lines of ─ (box drawing) with just the arrow/symbol if present
  // e.g. "────────── ❯ ──────────" → "❯"
  // e.g. "──────────────────────" → "───"
  return text.replace(/[─━─]{4,}([^─━\n]*?)[─━─]{4,}/g, (_, middle) => {
    const trimmed = middle.trim();
    return trimmed || "───";
  }).replace(/[─━]{10,}/g, "───");
}

/* ─── Full ANSI to HTML (16 + 256 + RGB colors, fg/bg, bold/italic/underline/dim/strikethrough) ─── */

const ANSI_16: Record<number, string> = {
  30: "#15161e", 31: "#f7768e", 32: "#9ece6a", 33: "#e0af68",
  34: "#7aa2f7", 35: "#bb9af7", 36: "#7dcfff", 37: "#a9b1d6",
  90: "#414868", 91: "#f7768e", 92: "#9ece6a", 93: "#e0af68",
  94: "#7aa2f7", 95: "#bb9af7", 96: "#7dcfff", 97: "#c0caf5",
};

const ANSI_16_BG: Record<number, string> = {
  40: "#15161e", 41: "#f7768e", 42: "#9ece6a", 43: "#e0af68",
  44: "#7aa2f7", 45: "#bb9af7", 46: "#7dcfff", 47: "#a9b1d6",
  100: "#414868", 101: "#f7768e", 102: "#9ece6a", 103: "#e0af68",
  104: "#7aa2f7", 105: "#bb9af7", 106: "#7dcfff", 107: "#c0caf5",
};

// 256-color palette (0-15 = standard, 16-231 = 6x6x6 cube, 232-255 = grayscale)
function color256(n: number): string {
  if (n < 16) {
    const c16 = [
      "#15161e","#f7768e","#9ece6a","#e0af68","#7aa2f7","#bb9af7","#7dcfff","#a9b1d6",
      "#414868","#f7768e","#9ece6a","#e0af68","#7aa2f7","#bb9af7","#7dcfff","#c0caf5",
    ];
    return c16[n];
  }
  if (n < 232) {
    const idx = n - 16;
    const r = Math.floor(idx / 36);
    const g = Math.floor((idx % 36) / 6);
    const b = idx % 6;
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  const gray = 8 + (n - 232) * 10;
  const hex = gray.toString(16).padStart(2, "0");
  return `#${hex}${hex}${hex}`;
}

function ansiToHtml(text: string): string {
  // Escape HTML first
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // Remove OSC sequences (title, color queries, etc.)
  html = html.replace(/\x1b\].*?(?:\x1b\\|\x07|\u009c)/g, "");
  // Remove cursor/erase sequences but keep SGR (color)
  html = html.replace(/\x1b\[[0-9;]*[A-LN-Za-hjklnp-z]/g, "");

  // Process SGR (Select Graphic Rendition) sequences
  let openSpans = 0;
  html = html.replace(/\x1b\[([0-9;]*)m/g, (_, codesStr) => {
    const codes = (codesStr || "0").split(";").map(Number);
    let fg = "";
    let bg = "";
    let bold = false;
    let dim = false;
    let italic = false;
    let underline = false;
    let strike = false;
    let closeAll = false;

    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { closeAll = true; continue; }
      if (c === 1) { bold = true; continue; }
      if (c === 2) { dim = true; continue; }
      if (c === 3) { italic = true; continue; }
      if (c === 4) { underline = true; continue; }
      if (c === 9) { strike = true; continue; }

      // 256-color foreground: 38;5;N
      if (c === 38 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        fg = color256(codes[i + 2]); i += 2; continue;
      }
      // RGB foreground: 38;2;R;G;B
      if (c === 38 && codes[i + 1] === 2 && codes[i + 4] !== undefined) {
        fg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`; i += 4; continue;
      }
      // 256-color background: 48;5;N
      if (c === 48 && codes[i + 1] === 5 && codes[i + 2] !== undefined) {
        bg = color256(codes[i + 2]); i += 2; continue;
      }
      // RGB background: 48;2;R;G;B
      if (c === 48 && codes[i + 1] === 2 && codes[i + 4] !== undefined) {
        bg = `rgb(${codes[i + 2]},${codes[i + 3]},${codes[i + 4]})`; i += 4; continue;
      }

      // Standard 16 colors
      if (ANSI_16[c]) { fg = ANSI_16[c]; continue; }
      if (ANSI_16_BG[c]) { bg = ANSI_16_BG[c]; continue; }
      if (c === 39) { fg = ""; continue; } // default fg
      if (c === 49) { bg = ""; continue; } // default bg
    }

    let result = "";
    if (closeAll) {
      for (let j = 0; j < openSpans; j++) result += "</span>";
      openSpans = 0;
    }

    let style = "";
    if (fg) style += `color:${fg};`;
    if (bg) style += `background:${bg};padding:0 2px;border-radius:2px;`;
    if (bold) style += "font-weight:bold;";
    if (dim) style += "opacity:0.6;";
    if (italic) style += "font-style:italic;";
    if (underline) style += "text-decoration:underline;";
    if (strike) style += "text-decoration:line-through;";

    if (style) {
      result += `<span style="${style}">`;
      openSpans++;
    }
    return result;
  });

  // Close any remaining open spans
  for (let i = 0; i < openSpans; i++) html += "</span>";

  // Clean any remaining escape sequences
  html = html.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "");

  return html;
}
