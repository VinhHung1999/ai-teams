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
      className="flex items-end gap-2 px-2 py-2 border-t"
      style={{
        borderColor: "var(--c-line)",
        background: "var(--c-bg-list-glass)",
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        paddingBottom: "max(8px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className={`glass-input-pill flex flex-1 items-end gap-2 px-3 py-2 ${
          isDisabled ? "opacity-60" : ""
        }`}
        style={{ borderRadius: "var(--c-radius-input)" }}
      >
        <button
          type="button"
          title="Attach (coming soon)"
          aria-label="Attach (coming soon)"
          disabled
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full text-muted-foreground hover:bg-foreground/5 disabled:opacity-60"
          style={{ transform: "rotate(-45deg)" }}
        >
          📎
        </button>

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

        <button
          type="button"
          title="Emoji (coming soon)"
          aria-label="Emoji (coming soon)"
          disabled
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-full text-muted-foreground hover:bg-foreground/5 disabled:opacity-60"
        >
          😊
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={isDisabled || !hasText}
        aria-label={hasText ? "Send message" : "Voice input"}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-150 disabled:opacity-60 ${
          hasText
            ? "text-white shadow-md"
            : "bg-transparent text-muted-foreground hover:text-foreground"
        }`}
        style={hasText ? { background: "var(--c-accent)" } : undefined}
      >
        {hasText ? "➤" : "🎤"}
      </button>
    </div>
  );
};
