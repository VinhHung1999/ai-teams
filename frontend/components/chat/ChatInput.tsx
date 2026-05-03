"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ChatInputProps {
  roles: string[];
  defaultRole?: string;
  disabled?: boolean;
  onSend: (role: string, text: string) => Promise<void>;
}

export function ChatInput({ roles, defaultRole, disabled, onSend }: ChatInputProps) {
  const [role, setRole] = useState(defaultRole ?? roles[0] ?? "PO");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep role in sync when defaultRole changes (team switch)
  useEffect(() => {
    if (defaultRole && roles.includes(defaultRole)) setRole(defaultRole);
  }, [defaultRole, roles]);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = 6 * 24; // 6 rows × ~24px line-height
    el.style.height = Math.min(el.scrollHeight, maxH) + "px";
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setError(null);
    adjustHeight();
  };

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    setError(null);
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

  const canSend = text.trim().length > 0 && !sending && !disabled;

  return (
    <div className="border-t border-zinc-800 bg-zinc-900 px-3 py-2 flex-shrink-0">
      {error && (
        <div className="mb-1 px-2 py-1 rounded text-xs text-red-400 bg-red-900/30">
          {error}
        </div>
      )}
      <div className="flex items-end gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          disabled={disabled}
          className="flex-shrink-0 bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 h-8"
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Select a team to start chatting…" : "Message… (Enter to send, Shift+Enter for newline)"}
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-zinc-500 disabled:opacity-50 min-h-[34px]"
          style={{ overflowY: "hidden" }}
        />

        <button
          onClick={send}
          disabled={!canSend}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-white text-sm"
          title="Send"
        >
          {sending ? "…" : "↑"}
        </button>
      </div>
    </div>
  );
}
