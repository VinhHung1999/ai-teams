// [382] Capture-pane chat parser — shared by ChatStream + RunningPanel.
// Parses raw tmux capture-pane output into bubble events, plus a
// single-slot transient thinking state.
//
// Parser dispatch (first match wins):
//   - skip noise (box-drawing, status footer, cost bar, permission, bare ❯)
//   - ⎿ tool result → attach to nearest preceding tool above
//   - ✻ / ✳ / · thinking → single replace-only thinkingBubble slot
//   - ❯ <text>                  → BOSS message (source: 'input')
//   - ❯ <ROLE> [HH:mm]: <text>  → that role's bubble (cross-talk)
//   - ⏺ Name(...)               → tool chip
//   - ⏺ <text>                  → assistant text bubble (source: 'response')
//   - other                     → continuation appended to nearest message above

export type MessageSource = "input" | "response";

export type MessageBubble = {
  id: string;
  kind: "message";
  role: string;
  text: string;
  timestamp?: string;
  source: MessageSource;
};

export type ToolBubble = {
  id: string;
  kind: "tool";
  name: string;
  args: string;
  result: string;
};

export type ThinkingBubble = {
  id: string;
  kind: "thinking";
  text: string;
};

export type Bubble = MessageBubble | ToolBubble;

export interface ParseResult {
  bubbles: Bubble[];
  thinking: ThinkingBubble | null;
}

// ── Regex / patterns ─────────────────────────────────────────────────────────

const ANSI_CSI_RE = /\x1b\[[0-9;?]*[A-Za-z]/g;
const ANSI_OSC_RE = /\x1b\].*?(?:\x1b\\|\x07|)/g;

const SENDER_RE = /^([A-Z]{2,})\s*\[(\d{1,2}:\d{2})\]:\s*/;
const TOOL_RE = /^⏺\s+([A-Z][a-zA-Z_0-9]*)\s*\((.*)$/;
const RESULT_RE = /^\s+⎿\s+(.+)/;
// [382 Iter 3.1] Spinner glyph set — Claude Code rotates through several;
// add chars here when new glyphs leak into ChatStream as continuation.
const THINKING_RE = /^\s*[✻✳✢·⊹✺✷✦✧◦∗⋆]\s+(.+)/;
const BOX_ONLY_RE = /^[─━┌┐└┘│┃═]+$/;

export function stripAnsi(s: string): string {
  return s.replace(ANSI_OSC_RE, "").replace(ANSI_CSI_RE, "").replace(/\r/g, "");
}

function isNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (BOX_ONLY_RE.test(trimmed)) return true;
  if (/^\[(Sonnet|Opus|Haiku)\b/i.test(trimmed)) return true;
  if (trimmed.includes("░░░")) return true;
  if (trimmed.includes("⏱") || /\d+%\s*\|\s*\$\d/.test(trimmed)) return true;
  if (/⏵⏵\s*bypass\s+permissions/i.test(trimmed)) return true;
  if (trimmed === "❯") return true;
  return false;
}

function hashShort(s: string): string {
  let h = 0;
  const lim = Math.min(s.length, 64);
  for (let i = 0; i < lim; i++) h = (((h << 5) - h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function truncateArgs(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length <= 80) return trimmed;
  return trimmed.slice(0, 77) + "…";
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parsePane(output: string, viewingRole: string): ParseResult {
  const stripped = stripAnsi(output);
  const lines = stripped.split("\n");

  const bubbles: Bubble[] = [];
  let thinking: ThinkingBubble | null = null;
  let seq = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (isNoiseLine(line)) continue;

    // Tool result → attach to nearest preceding tool
    const resultMatch = line.match(RESULT_RE);
    if (resultMatch) {
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.kind === "tool") {
          if (!b.result) b.result = resultMatch[1].trim();
          break;
        }
        if (b.kind === "message") break;
      }
      thinking = null;
      continue;
    }

    // Thinking — single slot
    const thinkingMatch = line.match(THINKING_RE);
    if (thinkingMatch && !line.startsWith("⏺ ")) {
      const text = thinkingMatch[1].trim();
      thinking = { id: `thinking-${hashShort(text)}`, kind: "thinking", text };
      continue;
    }

    // BOSS / role input via ❯
    if (line.startsWith("❯ ")) {
      const rest = line.slice(2);
      const senderMatch = rest.match(SENDER_RE);
      if (senderMatch) {
        const text = rest.replace(SENDER_RE, "").trim();
        if (text) {
          bubbles.push({
            id: `msg-${seq++}-${hashShort(senderMatch[1] + text.slice(0, 32))}`,
            kind: "message",
            role: senderMatch[1],
            text,
            timestamp: senderMatch[2],
            source: "input",
          });
        }
      } else {
        const text = rest.trim();
        if (text) {
          bubbles.push({
            id: `msg-${seq++}-BOSS-${hashShort(text.slice(0, 32))}`,
            kind: "message",
            role: "BOSS",
            text,
            source: "input",
          });
        }
      }
      thinking = null;
      continue;
    }

    // Tool call: ⏺ Name(...
    const toolMatch = line.match(TOOL_RE);
    if (toolMatch) {
      let args = toolMatch[2];
      if (args.endsWith(")")) args = args.slice(0, -1);
      const name = toolMatch[1];
      bubbles.push({
        id: `tool-${seq++}-${name}-${hashShort(args.slice(0, 48))}`,
        kind: "tool",
        name,
        args: truncateArgs(args),
        result: "",
      });
      thinking = null;
      continue;
    }

    // Assistant text response: ⏺ <text>
    if (line.startsWith("⏺ ")) {
      const text = line.slice(2).trim();
      if (!text) continue;
      bubbles.push({
        id: `msg-${seq++}-${viewingRole}-${hashShort(text.slice(0, 32))}`,
        kind: "message",
        role: viewingRole,
        text,
        source: "response",
      });
      thinking = null;
      continue;
    }

    // Continuation
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.kind === "message") {
        b.text += "\n" + line;
        break;
      }
      if (b.kind === "tool") break;
    }
  }

  return { bubbles, thinking };
}

// ── Activity derivation (for RunningPanel) ───────────────────────────────────
// Active tools = tools that appeared after the most recent assistant-response
// message. If no response yet, all tools are active.
export function deriveActivity(parsed: ParseResult, viewingRole: string): {
  tools: ToolBubble[];
  thinking: ThinkingBubble | null;
} {
  const { bubbles, thinking } = parsed;
  let lastResponseIdx = -1;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (b.kind === "message" && b.role === viewingRole && b.source === "response") {
      lastResponseIdx = i;
      break;
    }
  }
  const tools: ToolBubble[] = [];
  for (let i = lastResponseIdx + 1; i < bubbles.length; i++) {
    const b = bubbles[i];
    if (b.kind === "tool") tools.push(b);
  }
  return { tools, thinking };
}

// Filter to message bubbles only — used by ChatStream.
export function filterMessages(parsed: ParseResult): MessageBubble[] {
  return parsed.bubbles.filter((b): b is MessageBubble => b.kind === "message");
}
