"use client";

/**
 * Preview page for the new ToolCard design.
 * Boss visits /chat/tool-preview to verify visual before DEV swaps in ChatStream.
 */

import { ToolCard } from "@/components/chat/ToolCard";

const SAMPLE_OUTPUT_LONG = `1→// example output rendering
2→async function fetchData() {
3→  const res = await fetch("/api/chat/14/history?limit=50");
4→  if (!res.ok) throw new Error("Network response was not ok");
5→  const data = await res.json();
6→  return data.events;
7→}
8→
9→// More lines...
10→export const config = {
11→  runtime: "nodejs",
12→  dynamic: "force-dynamic",
13→};
14→
... (truncated)
${"x".repeat(900)}`;

const SAMPLE_BASH = `Build clean ✓
- backend: 0 errors
- frontend: 0 errors
- 12 packages, 0 vulnerabilities`;

export default function ToolPreviewPage() {
  return (
    <main className="chat-wallpaper" style={{ minHeight: "100dvh", padding: "48px 0" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px", display: "flex", flexDirection: "column", gap: 32 }}>
        <header>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: 0, color: "rgba(15,23,42,0.95)" }}>
            ToolCard preview
          </h1>
          <p style={{ fontSize: 14, color: "rgba(15,23,42,0.55)", marginTop: 6 }}>
            iOS Notification × Linear command palette × Vercel activity log.
            <br />
            Click any row to expand input + output.
          </p>
        </header>

        <Section title="Single tool calls — collapsed default">
          <ToolCard
            name="Read"
            input={{ file_path: "/Users/hungphu/Documents/AI_Projects/ai-teams/CLAUDE.md", offset: 1, limit: 50 }}
            output="...50 lines of CLAUDE.md content..."
            status="success"
          />
          <ToolCard
            name="Edit"
            input={{ file_path: "frontend/app/globals.css", edits: [{ old_string: "...", new_string: "..." }, { old_string: "...", new_string: "..." }, { old_string: "...", new_string: "..." }] }}
            output="The file frontend/app/globals.css has been updated successfully."
            status="success"
          />
          <ToolCard
            name="Bash"
            input={{ command: "git log --oneline -5 && git diff --stat HEAD~1 HEAD" }}
            output={SAMPLE_BASH}
            status="success"
          />
          <ToolCard
            name="Grep"
            input={{ pattern: "tmux_active|roles", path: "frontend/lib" }}
            output="frontend/lib/types.ts:10:  tmux_active?: boolean;\nfrontend/lib/types.ts:11:  roles?: string[];"
            status="success"
          />
          <ToolCard
            name="Glob"
            input={{ pattern: "**/*.tsx" }}
            output="142 matching files"
            status="success"
          />
          <ToolCard
            name="WebFetch"
            input={{ url: "https://api.anthropic.com/v1/design/h/IF2QXAaPw2SpHXmRx0RoXQ", prompt: "extract design" }}
            output="Binary content (application/gzip, 2.2MB)"
            status="success"
          />
          <ToolCard
            name="Task"
            input={{ description: "Independent migration review", subagent_type: "code-reviewer" }}
            output="Review complete — 0 critical issues, 2 minor suggestions."
            status="success"
          />
          <ToolCard
            name="TodoWrite"
            input={{
              todos: [
                { content: "Build foundation", status: "completed" },
                { content: "Migrate routes", status: "in_progress" },
                { content: "Cleanup", status: "pending" },
              ],
            }}
            status="success"
          />
        </Section>

        <Section title="Status variants">
          <ToolCard
            name="Bash"
            input={{ command: "npm run typecheck" }}
            output="error TS2304: Cannot find name 'foo'.\nerror TS2552: Cannot find name 'bar'.\n2 errors"
            status="error"
          />
          <ToolCard
            name="WebFetch"
            input={{ url: "https://example.com/down" }}
            status="pending"
          />
          <ToolCard
            name="Read"
            input={{ file_path: "src/missing.ts" }}
            output="Error: ENOENT: no such file"
            status="error"
          />
        </Section>

        <Section title="Stacked group (consecutive — visually merged)">
          <ToolCard name="Glob" input={{ pattern: "**/*.test.ts" }} output="42 files" status="success" />
          <ToolCard name="Read" input={{ file_path: "src/lib/JsonStorage.test.ts" }} output="...test file..." status="success" />
          <ToolCard name="Bash" input={{ command: "npm test JsonStorage" }} output="PASS  src/lib/JsonStorage.test.ts\n12 tests passed" status="success" />
        </Section>

        <Section title="Default expanded">
          <ToolCard
            name="Read"
            input={{ file_path: "frontend/app/globals.css", offset: 220, limit: 40 }}
            output={SAMPLE_OUTPUT_LONG}
            status="success"
            defaultExpanded
          />
        </Section>

        <Section title="Inside a chat bubble (real context)">
          <div className="glass-bubble" style={{ alignSelf: "flex-start", maxWidth: "70%", padding: "10px 14px", borderRadius: 18 }}>
            <p style={{ margin: 0, marginBottom: 8, fontSize: 14, color: "rgba(15,23,42,0.85)" }}>
              Em đã đọc xong codebase và phát hiện 2 places dùng prisma. Để em fix:
            </p>
            <ToolCard name="Grep" input={{ pattern: "prisma\\.", path: "src/" }} output="3 matches across 2 files" status="success" />
            <ToolCard name="Edit" input={{ file_path: "src/routes/projects.ts", edits: [{}, {}] }} output="updated" status="success" />
            <ToolCard name="Bash" input={{ command: "npm run typecheck" }} output="0 errors" status="success" />
            <p style={{ margin: 0, marginTop: 8, fontSize: 14, color: "rgba(15,23,42,0.85)" }}>
              Done — TypeScript build clean, no remaining prisma references.
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <h2 style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(15,23,42,0.45)", margin: "0 0 4px 0" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
