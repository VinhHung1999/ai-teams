"use client";

import { useEffect, useRef, useState } from "react";

interface AgentPaneViewProps {
  sessionName: string;
  role: string;
  isVisible: boolean;
  output: string; // provided by parent via useTmuxWs — no WS managed here
  wsStatus?: "connecting" | "connected" | "disconnected";
  projectCwd?: string;
}

const SPECIAL_KEYS: Record<string, string> = {
  Enter: "Enter", Backspace: "BSpace", Tab: "Tab", Escape: "Escape",
  ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
  Delete: "DC", Home: "Home", End: "End", PageUp: "PPage", PageDown: "NPage",
};

export function AgentPaneView({ sessionName, role, isVisible, output, wsStatus, projectCwd }: AgentPaneViewProps) {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevOutputLen = useRef(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechTranscript, setSpeechTranscript] = useState("");
  const [speechInterim, setSpeechInterim] = useState("");
  const recognitionRef = useRef<any>(null);

  // Auto-scroll on output change (only when visible)
  useEffect(() => {
    if (isVisible && autoScroll && outputRef.current && output.length !== prevOutputLen.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
    prevOutputLen.current = output.length;
  }, [output, autoScroll, isVisible]);

  // Refocus input after send completes
  useEffect(() => {
    if (!isPending) inputRef.current?.focus();
  }, [isPending]);

  const handleScroll = () => {
    if (!outputRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  };

  // ── Send text / key to tmux pane ──
  const sendText = async (text: string) => {
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text }),
      });
    } catch {}
  };

  const sendSpecialKey = async (key: string) => {
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, key }),
      });
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isPending) return;
    setIsPending(true);
    const oneLine = inputValue.replace(/\n+/g, ' ').trim();
    if (!oneLine) { setIsPending(false); return; }
    await sendText(oneLine);
    setInputValue("");
    setTimeout(() => setIsPending(false), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); if (inputValue.trim()) { handleSendMessage(); } else { sendSpecialKey("Enter"); } return; }
    if (e.ctrlKey && e.key === "c") { e.preventDefault(); sendSpecialKey("C-c"); return; }
    if (e.shiftKey && e.key === "Tab") { e.preventDefault(); sendSpecialKey("BTab"); return; }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault(); sendSpecialKey(SPECIAL_KEYS[e.key]); return;
    }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !inputValue) {
      e.preventDefault(); sendSpecialKey(SPECIAL_KEYS[e.key]); return;
    }
    if (e.key === "Escape") {
      e.preventDefault(); sendSpecialKey("Escape"); return;
    }
  };

  // ── Speech ──
  const startSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported"); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    let accumulated = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      let finalChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
        else interim = event.results[i][0].transcript;
      }
      if (finalChunk) { accumulated += (accumulated ? " " : "") + finalChunk; setSpeechTranscript(accumulated); }
      setSpeechInterim(interim);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    recognitionRef.current = recognition;
    setSpeechTranscript(""); setSpeechInterim(""); setIsListening(true);
  };

  const stopSpeechAndSend = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    const text = speechTranscript.trim();
    if (text) sendText(text);
    setSpeechTranscript(""); setSpeechInterim("");
  };

  const cancelSpeech = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setSpeechTranscript(""); setSpeechInterim("");
  };

  const handleUpload = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const uploadDir = (projectCwd || "/tmp/ai-teams-uploads") + "/.uploads";
      const form = new FormData();
      form.append("files", file);
      form.append("relativePaths", file.name);
      const res = await fetch(
        `/api/files/upload?dir=${encodeURIComponent(uploadDir)}&root=${encodeURIComponent(uploadDir)}`,
        { method: "POST", body: form }
      );
      if (res.ok) {
        await sendText(`[IMAGE] ${uploadDir}/${file.name}`);
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const outputHtml = ansiToHtml(cleanOutput(output));

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ overscrollBehavior: "none" }}>
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
        onClick={() => inputRef.current?.focus()}
      >
        <pre
          className="font-mono text-[13px] whitespace-pre-wrap break-words text-[#e0e0e0] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: outputHtml }}
        />
      </div>

      {/* Scroll-to-bottom button */}
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

      {/* Speech transcript overlay */}
      {isListening && (
        <div className="border-t border-red-500/30 bg-[#0a0a0a] px-3 py-2 shrink-0">
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-foreground/80 font-mono">
                {speechTranscript}
                {speechInterim && <span className="text-muted-foreground/40">{speechTranscript ? " " : ""}{speechInterim}</span>}
                {!speechTranscript && !speechInterim && <span className="text-muted-foreground/30">Listening...</span>}
              </p>
            </div>
            <button onClick={cancelSpeech} className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 shrink-0" title="Cancel">✕</button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/40 bg-card px-3 py-2 shrink-0" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          {/* Upload image button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-9 w-9 rounded-sm flex items-center justify-center shrink-0 text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/20 border border-border/30 disabled:opacity-30"
            title="Upload image"
          >
            {uploading
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            }
          </button>
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (inputValue.trim()) {
                  handleSendMessage();
                } else {
                  sendSpecialKey("Enter");
                }
                (e.target as HTMLTextAreaElement).style.height = "36px";
                return;
              }
              handleKeyDown(e as unknown as React.KeyboardEvent<HTMLInputElement>);
            }}
            placeholder={isPending ? "Sending..." : `Message ${role}...`}
            disabled={isPending}
            className="flex-1 font-mono px-3 py-2 rounded-md bg-muted/30 border border-border/40 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/40 disabled:opacity-50 resize-none overflow-y-auto"
            style={{ fontSize: "16px", height: "36px", maxHeight: "240px" }}
            autoComplete="off"
            rows={1}
          />
          {/* Mic */}
          <button
            onClick={isListening ? stopSpeechAndSend : startSpeech}
            className={`h-9 w-9 rounded-sm flex items-center justify-center shrink-0 transition-all ${
              isListening
                ? "bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse"
                : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/20 border border-border/30"
            }`}
            title={isListening ? "Stop & fill input" : "Start speech"}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </button>
          {/* Send */}
          <button
            onClick={() => {
              handleSendMessage();
              if (inputRef.current) inputRef.current.style.height = "36px";
            }}
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
  html = html.replace(/\x1b\].*?(?:\x1b\\|\x07|\u009c)/g, "");
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
