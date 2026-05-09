"use client";

import { useEffect, useRef, useState } from "react";

interface AgentPaneViewProps {
  sessionName: string;
  role: string;
  isVisible: boolean;
  output: string; // provided by parent via useTmuxWs — no WS managed here
  wsStatus?: "connecting" | "connected" | "disconnected";
}

export function AgentPaneView({ sessionName, role, isVisible, output, wsStatus }: AgentPaneViewProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const prevOutputLen = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll on output change (only when visible)
  useEffect(() => {
    if (isVisible && autoScroll && outputRef.current && output.length !== prevOutputLen.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    prevOutputLen.current = output.length;
  }, [output, autoScroll, isVisible]);

  const handleScroll = () => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  const outputHtml = ansiToHtml(cleanOutput(output));

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ overscrollBehavior: "none" }}
      data-session={sessionName}
      data-role={role}
    >
      {/* WS status — top bar */}
      {wsStatus && wsStatus !== "connected" && (
        <div className={`flex items-center gap-1 px-3 py-1 text-[10px] font-mono shrink-0 border-b ${
          wsStatus === "connecting" ? "text-yellow-400 border-yellow-500/20 bg-yellow-500/5" : "text-red-400 border-red-500/20 bg-red-500/5"
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${wsStatus === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
          {wsStatus}
        </div>
      )}
      {/* Output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-3 bg-[#000000] cursor-text"
        style={{ overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" }}
      >
        <pre
          className="font-mono text-[13px] whitespace-pre-wrap break-words text-[#e0e0e0] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: outputHtml }}
        />
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <div className="absolute bottom-4 right-4 z-10">
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
    </div>
  );
}

/* ─── Clean separator lines ─── */
function cleanOutput(text: string): string {
  return text
    .replace(/[─━─]{4,}([^─━\n]*?)[─━─]{4,}/g, (_, middle) => middle.trim() || "───")
    .replace(/[─━]{10,}/g, "───");
}

/* ─── ANSI → HTML ─── */
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

function color256(n: number): string {
  if (n < 16) return ["#15161e","#f7768e","#9ece6a","#e0af68","#7aa2f7","#bb9af7","#7dcfff","#a9b1d6","#414868","#f7768e","#9ece6a","#e0af68","#7aa2f7","#bb9af7","#7dcfff","#c0caf5"][n];
  if (n < 232) {
    const idx = n - 16;
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, "0");
    return `#${toHex(Math.floor(idx / 36))}${toHex(Math.floor((idx % 36) / 6))}${toHex(idx % 6)}`;
  }
  const gray = (8 + (n - 232) * 10).toString(16).padStart(2, "0");
  return `#${gray}${gray}${gray}`;
}

function ansiToHtml(text: string): string {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  html = html.replace(/\x1b\].*?(?:\x1b\\|\x07|)/g, "");
  html = html.replace(/\x1b\[[0-9;]*[A-LN-Za-hjklnp-z]/g, "");

  let openSpans = 0;
  html = html.replace(/\x1b\[([0-9;]*)m/g, (_, codesStr) => {
    const codes = (codesStr || "0").split(";").map(Number);
    let fg = "", bg = "", bold = false, dim = false, italic = false, underline = false, strike = false, closeAll = false;
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { closeAll = true; continue; }
      if (c === 1) { bold = true; continue; }
      if (c === 2) { dim = true; continue; }
      if (c === 3) { italic = true; continue; }
      if (c === 4) { underline = true; continue; }
      if (c === 9) { strike = true; continue; }
      if (c === 38 && codes[i+1] === 5 && codes[i+2] !== undefined) { fg = color256(codes[i+2]); i += 2; continue; }
      if (c === 38 && codes[i+1] === 2 && codes[i+4] !== undefined) { fg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; i += 4; continue; }
      if (c === 48 && codes[i+1] === 5 && codes[i+2] !== undefined) { bg = color256(codes[i+2]); i += 2; continue; }
      if (c === 48 && codes[i+1] === 2 && codes[i+4] !== undefined) { bg = `rgb(${codes[i+2]},${codes[i+3]},${codes[i+4]})`; i += 4; continue; }
      if (ANSI_16[c]) { fg = ANSI_16[c]; continue; }
      if (ANSI_16_BG[c]) { bg = ANSI_16_BG[c]; continue; }
      if (c === 39) { fg = ""; continue; }
      if (c === 49) { bg = ""; continue; }
    }
    let result = "";
    if (closeAll) { for (let j = 0; j < openSpans; j++) result += "</span>"; openSpans = 0; }
    let style = "";
    if (fg) style += `color:${fg};`;
    if (bg) style += `background:${bg};padding:0 2px;border-radius:2px;`;
    if (bold) style += "font-weight:bold;";
    if (dim) style += "opacity:0.6;";
    if (italic) style += "font-style:italic;";
    if (underline) style += "text-decoration:underline;";
    if (strike) style += "text-decoration:line-through;";
    if (style) { result += `<span style="${style}">`; openSpans++; }
    return result;
  });
  for (let i = 0; i < openSpans; i++) html += "</span>";
  html = html.replace(/\x1b\[[^a-zA-Z]*[a-zA-Z]/g, "");
  return html;
}
