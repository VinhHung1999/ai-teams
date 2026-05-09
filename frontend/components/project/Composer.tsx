"use client";

import { useRef, useState, type FC, type KeyboardEvent } from "react";

export interface ComposerProps {
  sessionName: string;
  role: string;
  disabled?: boolean;
}

export const Composer: FC<ComposerProps> = ({ sessionName, role, disabled }) => {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const isDisabled = !!disabled || !sessionName || !role || sending;
  const hasText = text.trim().length > 0;

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || isDisabled) return;
    setSending(true);
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text: value }),
      });
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "";
    } catch {
      // swallow — terminal echo is canonical feedback
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="flex items-end gap-2 px-2 py-2 border-t border-border/40 bg-card/40 backdrop-blur-2xl backdrop-saturate-150"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        title="Slash commands (coming soon)"
        aria-label="Slash commands (coming soon)"
        disabled={isDisabled}
        className="inline-flex h-10 w-11 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
      >
        ≡
      </button>

      <button
        type="button"
        title="Attach file (coming soon)"
        aria-label="Attach file (coming soon)"
        disabled={isDisabled}
        className="inline-flex h-10 w-11 items-center justify-center rounded-full border border-border/40 bg-card/40 text-muted-foreground backdrop-blur-md hover:bg-card/60 disabled:opacity-60"
      >
        📎
      </button>

      <div
        className={`flex flex-1 items-end gap-2 rounded-2xl border border-border/40 bg-card/60 px-3 py-2 backdrop-blur-md ${
          isDisabled ? "opacity-60" : ""
        }`}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autosize();
          }}
          onKeyDown={onKeyDown}
          readOnly={isDisabled}
          aria-label="Message"
          placeholder="Message…"
          style={{ fontSize: 16, lineHeight: 1.4, minHeight: 24, maxHeight: 96 }}
          className="flex-1 resize-none bg-transparent outline-none placeholder:text-muted-foreground/60"
        />
        <span className="self-end text-xs text-muted-foreground/60" aria-hidden="true">
          ⏱
        </span>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isDisabled || !hasText}
        aria-label={hasText ? "Send message" : "Voice input"}
        className={
          hasText
            ? "inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-60"
            : "inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground disabled:opacity-60"
        }
      >
        {hasText ? "➤" : "🎤"}
      </button>
    </div>
  );
};
