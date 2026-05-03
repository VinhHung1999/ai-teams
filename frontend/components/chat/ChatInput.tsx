"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface ChatInputProps {
  roles: string[];
  defaultRole?: string;
  disabled?: boolean;
  onSend: (role: string, text: string) => Promise<void>;
  projectId?: number;
}

interface Skill {
  name: string;
  description: string;
  folder: string;
}

// ── Voice recording state ─────────────────────────────────────────────────────
type VoiceState = "idle" | "recording" | "uploading";

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export function ChatInput({ roles, defaultRole, disabled, onSend, projectId }: ChatInputProps) {
  const [role, setRole] = useState(defaultRole ?? roles[0] ?? "PO");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSlash, setShowSlash] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // [348] Skills picker state
  const [showSkills, setShowSkills] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillsLoaded, setSkillsLoaded] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

  // Voice state
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceDuration, setVoiceDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const voiceStartRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micBtnRef = useRef<HTMLButtonElement>(null);
  const cancelledRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (defaultRole && roles.includes(defaultRole)) setRole(defaultRole);
  }, [defaultRole, roles]);

  // Load skills when menu opens
  useEffect(() => {
    if (!showSkills || skillsLoaded) return;
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => { setSkills(data); setSkillsLoaded(true); })
      .catch(() => setSkillsLoaded(true));
  }, [showSkills, skillsLoaded]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setShowAttach(false);
        setShowSkills(false);
      }
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // ── [348] Skills picker ───────────────────────────────────────────────────────

  const filteredSkills = skills.filter((s) =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
    s.description.toLowerCase().includes(skillSearch.toLowerCase())
  );

  const insertSkill = (skillName: string) => {
    const prefix = `/${skillName} `;
    setText((prev) => prefix + prev.replace(/^\/\S*\s?/, ""));
    setShowSkills(false);
    setSkillSearch("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // ── [349] File/image attach ───────────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File, isImage: boolean) => {
    if (!projectId) { setError("No team selected"); return; }
    setError(null);
    const form = new FormData();
    form.append("role", role);
    form.append("file", file, file.name);
    try {
      const res = await fetch(`/api/chat/${projectId}/attach`, { method: "POST", body: form });
      if (res.status === 413) { setError("File too large (max 20MB)"); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Attach failed");
        return;
      }
    } catch (e: any) {
      setError(e.message ?? "Attach failed");
    }
  }, [projectId, role]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file, isImage);
    e.target.value = "";
  }, [uploadFile]);

  // ── Voice ─────────────────────────────────────────────────────────────────────

  const stopRecordingAndUpload = useCallback(async () => {
    const mr = mediaRecorderRef.current;
    if (!mr) return;
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    const duration = Date.now() - voiceStartRef.current;
    mr.stop();
    if (cancelledRef.current || duration < 500) {
      chunksRef.current = [];
      mr.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      setVoiceState("idle");
      setVoiceDuration(0);
      return;
    }
    await new Promise<void>((resolve) => {
      mr.addEventListener("stop", () => resolve(), { once: true });
    });
    const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
    chunksRef.current = [];
    mr.stream.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    if (!projectId) { setVoiceState("idle"); setVoiceDuration(0); return; }
    setVoiceState("uploading");
    try {
      const form = new FormData();
      form.append("role", role);
      form.append("audio", blob, "voice.webm");
      const res = await fetch(`/api/chat/${projectId}/voice`, { method: "POST", body: form });
      if (res.status === 413) { setError("Recording too large (max 5MB)"); return; }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Voice upload failed");
      }
    } catch (e: any) {
      setError(e.message ?? "Voice upload failed");
    } finally {
      setVoiceState("idle");
      setVoiceDuration(0);
    }
  }, [projectId, role]);

  const startRecording = useCallback(async () => {
    if (voiceState !== "idle" || disabled) return;
    setError(null);
    cancelledRef.current = false;
    chunksRef.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Cần quyền microphone");
      return;
    }
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(100);
    voiceStartRef.current = Date.now();
    setVoiceState("recording");
    setVoiceDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setVoiceDuration(Date.now() - voiceStartRef.current);
    }, 100);
    maxDurationTimerRef.current = setTimeout(() => stopRecordingAndUpload(), 60000);
  }, [voiceState, disabled, stopRecordingAndUpload]);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    stopRecordingAndUpload();
  }, [stopRecordingAndUpload]);

  const handlePointerLeave = useCallback(() => {
    if (voiceState === "recording") cancelRecording();
  }, [voiceState, cancelRecording]);

  const hasText = text.trim().length > 0;
  const isRecording = voiceState === "recording";
  const isUploading = voiceState === "uploading";

  return (
    <div ref={containerRef} className="flex-shrink-0 chat-composer-wrap" style={{ position: "relative" }}>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={(e) => handleFileInput(e, false)} />
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFileInput(e, true)} />

      {/* [348] Skills picker dropdown */}
      {showSkills && (
        <div
          className="absolute left-0 z-10"
          style={{
            bottom: "calc(100% + 4px)",
            minWidth: 280, maxWidth: 360,
            background: "var(--c-bg-list)",
            border: "1px solid var(--c-line)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--c-line)" }}>
            <input
              autoFocus
              value={skillSearch}
              onChange={(e) => setSkillSearch(e.target.value)}
              placeholder="Search skills…"
              style={{
                width: "100%", border: "none", outline: "none",
                background: "transparent", fontSize: 13, color: "var(--c-fg-0)",
                fontFamily: "inherit",
              }}
            />
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            {!skillsLoaded && (
              <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--c-fg-2)" }}>Loading…</div>
            )}
            {skillsLoaded && filteredSkills.length === 0 && (
              <div style={{ padding: "12px 16px", fontSize: 13, color: "var(--c-fg-2)" }}>No skills found</div>
            )}
            {filteredSkills.map((s) => (
              <button
                key={s.name}
                onClick={() => insertSkill(s.name)}
                className="w-full text-left"
                style={{ padding: "8px 14px", background: "transparent", display: "block" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--c-fg-0)" }}>/{s.name}</div>
                {s.description && (
                  <div style={{ fontSize: 11, color: "var(--c-fg-2)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.description.slice(0, 80)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Slash command hints (kept for manual / typing) */}
      {showSlash && !showSkills && (
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
          {skills.filter((s) => `/${s.name}`.startsWith(text) || text === "/").slice(0, 6).map((s) => (
            <button
              key={s.name}
              onClick={() => { insertSkill(s.name); }}
              className="w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="font-mono font-medium" style={{ color: "var(--c-accent)", fontSize: 14 }}>/{s.name}</span>
              <span style={{ color: "var(--c-fg-1)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.description.slice(0, 60)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Attach menu — only File + Photo wired; others removed per [349] spec */}
      {showAttach && (
        <div
          className="absolute z-10"
          style={{
            bottom: "calc(100% + 4px)", right: 56,
            background: "var(--c-bg-list)",
            border: "1px solid var(--c-line)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            padding: 6, minWidth: 180,
          }}
        >
          {[
            { label: "File", color: "#3b82f6", action: () => fileInputRef.current?.click() },
            { label: "Photo", color: "#10b981", action: () => photoInputRef.current?.click() },
          ].map(({ label, color, action }) => (
            <button
              key={label}
              onClick={() => { action(); setShowAttach(false); }}
              className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg transition-colors"
              style={{ background: "transparent", fontSize: 14, color: "var(--c-fg-0)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--c-bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="flex items-center justify-center text-white rounded-full" style={{ width: 36, height: 36, background: color, flexShrink: 0 }}>
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

      {/* Voice status bar */}
      {(isRecording || isUploading) && (
        <div className="flex items-center gap-2 mx-3 mb-1 px-3 py-1.5 rounded-xl"
          style={{ background: isRecording ? "rgba(239,68,68,0.08)" : "rgba(51,144,236,0.08)", fontSize: 13 }}>
          <span style={{ color: isRecording ? "#ef4444" : "var(--c-accent)", animation: isRecording ? "status-pulse 1.2s ease-in-out infinite" : "none" }}>
            {isRecording ? "🎤" : "📝"}
          </span>
          <span style={{ color: isRecording ? "#ef4444" : "var(--c-accent)" }}>
            {isRecording ? `Recording… ${formatDuration(voiceDuration)}` : "Transcribing…"}
          </span>
          {isRecording && (
            <button onClick={cancelRecording} style={{ marginLeft: "auto", color: "var(--c-fg-2)", fontSize: 12, background: "transparent", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          )}
        </div>
      )}

      {/* ── 4-frame composer ── */}
      <div className="flex items-end gap-2 px-3 pt-2" style={{ background: "transparent" }}>
        {/* Frame 1: Menu pill → skills picker */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowSkills((s) => !s); setShowAttach(false); }}
          className="flex items-center gap-1.5 flex-shrink-0 font-medium"
          style={{
            height: 40, padding: "0 16px 0 14px",
            background: "var(--c-accent)", color: "white",
            borderRadius: 20, border: "none", fontSize: 15,
          }}
          title="Skills picker"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
          <span className="composer-menu-label">{role}</span>
        </button>

        {/* Frame 2: Attach */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowAttach((s) => !s); setShowSkills(false); }}
          className="glass-composer-btn flex-shrink-0 flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, color: "var(--c-fg-1)" }}
          title="Attach file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>

        {/* Frame 3: Input pill */}
        <div className="glass-input-pill flex-1 flex items-center gap-1"
          style={{ borderRadius: 20, padding: "0 6px 0 16px", minHeight: 40 }}>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Select a team…" : "Tin nhắn…"}
            rows={1}
            disabled={disabled || sending || isRecording || isUploading}
            className="flex-1 outline-none resize-none"
            style={{
              background: "transparent", border: "none",
              color: "var(--c-fg-0)", fontSize: 16, lineHeight: 1.4,
              fontFamily: "inherit", minHeight: 22, maxHeight: 160,
              padding: 0, alignSelf: "center",
            }}
          />
          <button className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 32, height: 32, color: "var(--c-fg-2)", background: "transparent" }}
            title="Schedule (coming soon)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
        </div>

        {/* Frame 4: Mic / Send swap */}
        {hasText ? (
          <button onClick={send} disabled={disabled || sending}
            className="flex-shrink-0 flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, background: "var(--c-accent)", color: "white", border: "none" }}
            title="Send">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>
            </svg>
          </button>
        ) : (
          <button
            ref={micBtnRef}
            disabled={disabled || isUploading}
            onPointerDown={startRecording}
            onPointerUp={stopRecordingAndUpload}
            onPointerLeave={handlePointerLeave}
            className="flex-shrink-0 flex items-center justify-center rounded-full glass-composer-btn"
            style={{
              width: 40, height: 40,
              background: isRecording ? "#ef4444" : undefined,
              color: isRecording ? "white" : isUploading ? "var(--c-accent)" : "var(--c-fg-1)",
              border: isRecording ? "none" : undefined,
              animation: isRecording ? "status-pulse 1.2s ease-in-out infinite" : "none",
            }}
            title={isRecording ? "Release to send" : isUploading ? "Transcribing…" : "Hold to record"}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0"/>
              <line x1="12" y1="18" x2="12" y2="22"/>
              <line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
