"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ChatInputProps {
  roles: string[];
  defaultRole?: string;
  disabled?: boolean;
  onSend: (role: string, text: string) => Promise<void>;
}

const SLASH_CMDS = [
  ["/status", "Show current status"],
  ["/assign", "Assign task to role"],
  ["/move", "Move task to column"],
  ["/sprint", "Sprint summary"],
];

const ATTACH_ITEMS = [
  { label: "File", color: "#3b82f6" },
  { label: "Photo", color: "#10b981" },
  { label: "Task card", color: "#a78bfa" },
  { label: "Poll", color: "#f59e0b" },
  { label: "Link / PR", color: "#ec4899" },
];

export function ChatInput({ roles, defaultRole, disabled, onSend }: ChatInputProps) {
  const [role, setRole] = useState(defaultRole ?? roles[0] ?? "PO");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultRole && roles.includes(defaultRole)) setRole(defaultRole);
  }, [defaultRole, roles]);

  // Close attach menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowAttach(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setError(null);
    setShowSlash(val.startsWith("/"));
    adjustHeight();
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    setError(null);
    setShowSlash(false);
    try {
      await onSend(role, trimmed);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.focus();
      }
    } catch (e: any) {
      setError(e.message ?? "Send failed");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div ref={containerRef} className="flex-shrink-0" style={{ position: "relative" }}>
      {/* Slash command hints */}
      {showSlash && (
        <div
          className="absolute left-4 right-4 z-10"
          style={{
            bottom: "calc(100% + 4px)",
            background: "var(--c-bg-list)",
            border: "1px solid var(--c-line)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {SLASH_CMDS.filter(([cmd]) => cmd.startsWith(text) || text === "/").map(([cmd, desc]) => (
            <button
              key={cmd}
              onClick={() => { setText(cmd + " "); setShowSlash(false); textareaRef.current?.focus(); }}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="font-mono font-medium" style={{ color: "var(--c-accent)", fontSize: 14 }}>{cmd}</span>
              <span style={{ color: "var(--c-fg-1)", fontSize: 13 }}>{desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Attach menu */}
      {showAttach && (
        <div
          className="absolute z-10"
          style={{
            bottom: "calc(100% + 4px)",
            right: 56,
            background: "var(--c-bg-list)",
            border: "1px solid var(--c-line)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            padding: 6,
            minWidth: 200,
          }}
        >
          {ATTACH_ITEMS.map(({ label, color }) => (
            <button
              key={label}
              onClick={() => setShowAttach(false)}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
              style={{ background: "transparent", fontSize: 14, color: "var(--c-fg-0)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="flex items-center justify-center text-white rounded-full"
                style={{ width: 36, height: 36, background: color, flexShrink: 0 }}
              >
                📎
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="mx-3 mb-1 px-3 py-1 rounded text-xs" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
          {error}
        </div>
      )}

      {/* ── 4-frame composer ── */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ background: "transparent" }}
      >
        {/* Frame 1: Menu pill (accent blue) */}
        <button
          onClick={() => setShowSlash((s) => !s)}
          className="flex items-center gap-1.5 flex-shrink-0 font-medium"
          style={{
            height: 40,
            padding: "0 16px 0 14px",
            background: "var(--c-accent)",
            color: "white",
            borderRadius: 20,
            border: "none",
            fontSize: 15,
          }}
        >
          {/* ≡ icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
          <span className="composer-menu-label">
            {role}
          </span>
        </button>

        {/* Frame 2: Attach round (glass) */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowAttach((s) => !s); }}
          className="glass-composer-btn flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, color: "var(--c-fg-1)" }}
          title="Attach"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* Frame 3: Input pill (glass, flex-1) */}
        <div
          className="glass-input-pill flex-1 flex items-center gap-1"
          style={{ borderRadius: 20, padding: "0 6px 0 16px", minHeight: 40 }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Select a team…" : "Tin nhắn…"}
            rows={1}
            disabled={disabled || sending}
            className="flex-1 outline-none resize-none"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--c-fg-0)",
              fontSize: 16, // prevents iOS zoom
              lineHeight: 1.4,
              fontFamily: "inherit",
              minHeight: 22,
              maxHeight: 160,
              padding: 0,
              alignSelf: "center",
            }}
          />
          {/* Clock icon (schedule send placeholder) */}
          <button
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, color: "var(--c-fg-2)", background: "transparent" }}
            title="Schedule (coming soon)"
            onClick={() => {}}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>

        {/* Frame 4: Mic/Send swap */}
        <button
          onClick={send}
          disabled={disabled || sending}
          className="flex-shrink-0 flex items-center justify-center rounded-full glass-composer-btn"
          style={{
            width: 40, height: 40,
            background: hasText ? "var(--c-accent)" : undefined,
            color: hasText ? "white" : "var(--c-fg-1)",
            border: hasText ? "none" : undefined,
            transition: "background 0.12s, color 0.12s, transform 0.12s",
          }}
          title={hasText ? "Send" : "Mic (coming soon)"}
        >
          {hasText ? (
            // Send icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          ) : (
            // Mic icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
