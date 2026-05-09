"use client";
import { useRef, useState, type FC, type KeyboardEvent } from "react";
import { Ic } from "./icons";

export interface ComposerProps {
  sessionName: string;
  role: string;
  disabled?: boolean;
  /** Optional: parent-controlled text (lets SlashHints set composer text). */
  value?: string;
  /** Called when text changes — parent can sync state to detect '/' for SlashHints. */
  onChange?: (text: string) => void;
  /** Called when attach button clicked — parent toggles AttachMenu visibility. */
  onAttachClick?: () => void;
  /** Called when menu pill clicked — parent can open menu drawer (defer S51, but wire now). */
  onMenuClick?: () => void;
}

export const Composer: FC<ComposerProps> = ({
  sessionName, role, disabled,
  value, onChange,
  onAttachClick, onMenuClick,
}) => {
  const [internalText, setInternalText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Controlled if value+onChange provided; else internal state
  const text = value !== undefined ? value : internalText;
  const setText = (next: string) => {
    if (onChange) onChange(next);
    else setInternalText(next);
  };

  const isDisabled = !!disabled || !sessionName || !role || sending;
  const hasText = text.trim().length > 0;

  const autosize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const submit = async () => {
    const v = text.trim();
    if (!v || isDisabled) return;
    setSending(true);
    try {
      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, text: v }),
      });
      setText("");
      if (textareaRef.current) textareaRef.current.style.height = "";
    } catch {
      // swallow — terminal echo canonical
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
    <div className="composer">
      <button
        type="button"
        className="comp-menu-pill"
        onClick={onMenuClick}
        title="Menu (coming soon)"
      >
        <Ic name="menu" size={20} />
        <span>Menu</span>
      </button>

      <button
        type="button"
        className="comp-side-btn"
        onClick={(e) => { e.stopPropagation(); onAttachClick?.(); }}
        title="Attach"
        aria-label="Attach"
      >
        <Ic name="paperclip" size={20} />
      </button>

      <div className="composer-field">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => { setText(e.target.value); autosize(); }}
          onKeyDown={onKeyDown}
          readOnly={isDisabled}
          aria-label="Message"
          placeholder="Tin nhắn"
        />
        <button type="button" className="field-icon-btn" title="Schedule">
          <Ic name="clock" size={20} />
        </button>
      </div>

      <button
        type="button"
        className={`comp-side-btn${hasText ? " send-active" : ""}`}
        onClick={submit}
        disabled={isDisabled || !hasText}
        aria-label={hasText ? "Send message" : "Voice input"}
      >
        <Ic name={hasText ? "send" : "mic"} size={hasText ? 20 : 22} />
      </button>
    </div>
  );
};
