"use client";

/**
 * ToolCard — refined tool-call activity row.
 * Aesthetic: iOS Notification × Linear command palette × Vercel activity log.
 * Replaces CompactToolCard inline in ChatStream.
 *
 * Drop-in props mirror the merged tool_use + tool_result event from chat-types.
 * Status semantics:
 *   - pending: tool_use without paired tool_result yet (animated dot)
 *   - success: tool_result.isError !== true
 *   - error:   tool_result.isError === true
 */

import { useState, type ReactNode } from "react";
import { getToolIcon } from "./tool-icons";

export type ToolStatus = "pending" | "success" | "error";

export interface ToolCardProps {
  name: string;
  input?: Record<string, any>;
  output?: string;
  status?: ToolStatus;
  defaultExpanded?: boolean;
}

interface Summary {
  primary: string;
  meta?: string;
  mono?: boolean;
}

function pickSummary(name: string, input: Record<string, any> = {}): Summary {
  const lastTwo = (p: string) => p.split("/").filter(Boolean).slice(-2).join("/");

  if (name === "Read" || name === "Write") {
    const path = input.file_path ?? input.path ?? "";
    let meta: string | undefined;
    if (input.offset != null && input.limit != null) meta = `L${input.offset}–${Number(input.offset) + Number(input.limit)}`;
    else if (input.limit != null) meta = `L1–${input.limit}`;
    return { primary: lastTwo(path) || "(no path)", meta, mono: true };
  }
  if (name === "Edit" || name === "MultiEdit" || name === "NotebookEdit") {
    const path = input.file_path ?? input.path ?? input.notebook_path ?? "";
    const edits = input.edits?.length;
    return { primary: lastTwo(path) || "(no path)", meta: edits ? `${edits} edits` : undefined, mono: true };
  }
  if (name === "Bash" || name === "BashOutput") {
    const cmd = String(input.command ?? input.bash_id ?? "").trim();
    return { primary: cmd.length > 80 ? cmd.slice(0, 77) + "…" : cmd, mono: true };
  }
  if (name === "Grep") {
    const pattern = String(input.pattern ?? "");
    const path = input.path ? ` in ${lastTwo(input.path)}` : "";
    return { primary: pattern, meta: path || undefined, mono: true };
  }
  if (name === "Glob") {
    return { primary: String(input.pattern ?? ""), mono: true };
  }
  if (name === "WebFetch") {
    try {
      const u = new URL(input.url);
      return { primary: u.hostname + u.pathname, mono: false };
    } catch {
      return { primary: String(input.url ?? ""), mono: false };
    }
  }
  if (name === "WebSearch") {
    return { primary: String(input.query ?? ""), mono: false };
  }
  if (name === "Task") {
    return { primary: String(input.description ?? input.subagent_type ?? ""), mono: false };
  }
  if (name === "TodoWrite") {
    const n = Array.isArray(input.todos) ? input.todos.length : 0;
    const inProg = Array.isArray(input.todos) ? input.todos.filter((t: any) => t.status === "in_progress").length : 0;
    return { primary: `${n} task${n === 1 ? "" : "s"}`, meta: inProg ? `${inProg} active` : undefined };
  }
  // Fallback: first short string value
  const firstStr = Object.values(input).find((v) => typeof v === "string" && v.length < 200) as string | undefined;
  return { primary: firstStr ?? "" };
}

export function ToolCard({
  name,
  input = {},
  output,
  status = "success",
  defaultExpanded = false,
}: ToolCardProps) {
  const [open, setOpen] = useState(defaultExpanded);
  const Icon = getToolIcon(name);
  const sum = pickSummary(name, input);

  return (
    <div className={`tc-row tc-row--${status} ${open ? "tc-row--open" : ""}`}>
      <button
        type="button"
        className="tc-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="tc-glyph">
          <Icon />
        </span>
        <span className="tc-name">{name}</span>
        <span className="tc-sep" aria-hidden>·</span>
        <span className={`tc-target ${sum.mono ? "tc-target--mono" : ""}`} title={sum.primary}>
          {sum.primary}
        </span>
        {sum.meta && <span className="tc-meta">{sum.meta}</span>}
        <span className="tc-tail">
          <StatusDot status={status} />
          <ChevronGlyph open={open} />
        </span>
      </button>

      {open && (
        <div className="tc-body">
          {Object.keys(input).length > 0 && (
            <Section label="input">
              <KeyValueGrid data={input} />
            </Section>
          )}
          {output && (
            <Section label="output">
              <ToolOutput text={output} />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tc-section">
      <span className="tc-section-label">{label}</span>
      {children}
    </div>
  );
}

function KeyValueGrid({ data }: { data: Record<string, any> }) {
  const entries = Object.entries(data);
  // If single string-only value or very short, render as <pre>; else key-value rows
  const longTextFields = entries.filter(([, v]) => typeof v === "string" && v.length > 80);
  const useGrid = entries.length <= 6 && longTextFields.length === 0;

  if (!useGrid) {
    return <pre className="tc-pre">{JSON.stringify(data, null, 2)}</pre>;
  }

  return (
    <dl className="tc-kv">
      {entries.map(([k, v]) => (
        <div key={k} className="tc-kv-row">
          <dt className="tc-kv-key">{k}</dt>
          <dd className="tc-kv-val">{formatValue(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatValue(v: any): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

function ToolOutput({ text }: { text: string }) {
  const [showAll, setShowAll] = useState(false);
  const TRUNC = 800;
  const long = text.length > TRUNC;
  const visible = showAll || !long ? text : text.slice(0, TRUNC);

  return (
    <div className="tc-output">
      <pre className="tc-pre tc-pre--output">
        {visible}
        {long && !showAll ? "\n…" : ""}
      </pre>
      {long && (
        <button type="button" className="tc-show-all" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Show less" : `Show all (${text.length.toLocaleString()} chars)`}
        </button>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: ToolStatus }) {
  return <span className={`tc-dot tc-dot--${status}`} aria-hidden />;
}

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      className={`tc-chev ${open ? "tc-chev--open" : ""}`}
      width="9"
      height="9"
      viewBox="0 0 9 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 3.5l2.5 2.5L7 3.5" />
    </svg>
  );
}
