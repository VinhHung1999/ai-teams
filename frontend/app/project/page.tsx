"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AgentPaneView } from "@/components/AgentPaneView";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { Bubble, type BubbleMessage } from "@/components/project/Bubble";
import { ChatHeader } from "@/components/project/ChatHeader";
import { ChatItem, type ChatItemData } from "@/components/project/ChatItem";
import { Composer } from "@/components/project/Composer";
import { PinStrip } from "@/components/project/PinStrip";
import { TopicBar } from "@/components/project/TopicBar";

import { api } from "@/lib/api";
import {
  filterMessages,
  parsePane,
  type MessageBubble,
} from "@/lib/chatParser";
import type { Project } from "@/lib/types";
import { useSwipeBack } from "@/lib/useSwipeBack";
import { useTmuxWs } from "@/lib/useTmuxWs";

// ─── helpers ─────────────────────────────────────────────────────────────────

function relativeShort(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.max(0, Date.now() - then);
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)}d`;
  return new Date(iso).toLocaleDateString();
}

function projectToChatItem(
  p: Project,
  activeSprintTitle: string | null,
): ChatItemData {
  const rolesText = p.roles && p.roles.length > 0 ? p.roles.join(" · ") : "No team";
  return {
    id: p.id,
    name: p.name,
    time: relativeShort(p.created_at),
    last: activeSprintTitle ?? rolesText,
    pinned: !!p.pinned,
    isBot: false,
  };
}

interface BubbleEntry {
  msg: BubbleMessage;
  mine: boolean;
  key: string;
}

// chatParser → Bubble adapter. Maps BOSS sender → ME (self-bubble), and
// collapses author repeats into the `same` flag so consecutive bubbles from
// the same role hide their avatar/header.
function adaptBubbles(messages: MessageBubble[]): BubbleEntry[] {
  return messages.map((m, i) => {
    const prev = i > 0 ? messages[i - 1] : null;
    const same = prev !== null && prev.role === m.role;
    const fromKind = m.role === "BOSS" ? "ME" : m.role;
    return {
      key: m.id,
      mine: m.role === "BOSS",
      msg: {
        from: fromKind as BubbleMessage["from"],
        text: m.text,
        time: m.timestamp ?? "",
        same,
      },
    };
  });
}

// ─── inner component (uses useSearchParams → must be inside Suspense) ────────

function ProjectShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [paneOpen, setPaneOpen] = useState(false);
  const [activeSprint, setActiveSprint] = useState<{ title: string; sub: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Derived state — recomputed on every render, no effect / no extra state.
  const activeProject =
    activeId !== null ? projects?.find((x) => x.id === activeId) ?? null : null;

  // Fetch projects once
  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  // URL deeplink: ?team=ID (kept legacy ?id= alias for old bookmarks).
  // Initial mount only — guard prevents re-firing on internal URL pushes.
  useEffect(() => {
    const param = searchParams.get("team") ?? searchParams.get("id");
    if (!param) return;
    const id = Number(param);
    if (!Number.isFinite(id)) return;
    setActiveId(id);
    setMobileView("chat");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once at mount; subsequent URL syncs done via history.replaceState
  }, []);

  // Default topic when project loads / changes — only if no topic chosen yet.
  useEffect(() => {
    if (!activeProject) return;
    const roles = activeProject.roles ?? [];
    if (roles.length === 0) return;
    setTopic((curr) => (roles.includes(curr) ? curr : roles[0]));
  }, [activeProject]);

  // Sync URL when active project changes (no router.push — avoids navigation).
  useEffect(() => {
    if (activeId === null || typeof window === "undefined") return;
    window.history.replaceState(null, "", `/project?team=${activeId}`);
  }, [activeId]);

  // Active sprint for PinStrip — fetched only for the selected project
  useEffect(() => {
    if (activeId === null) {
      setActiveSprint(null);
      return;
    }
    let cancelled = false;
    api
      .listSprints(activeId)
      .then((sprints) => {
        if (cancelled) return;
        const active = sprints.find((s) => s.status === "active");
        if (active) {
          setActiveSprint({
            title: `Sprint ${active.number}`,
            sub: active.goal ?? "",
          });
        } else {
          setActiveSprint(null);
        }
      })
      .catch(() => !cancelled && setActiveSprint(null));
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  // Live tmux output for the active topic
  const sessionName = activeProject?.tmux_session_name ?? "";
  const { outputs, wsStatus } = useTmuxWs(sessionName || undefined, topic);

  // Swipe-back: dispatch state instead of router.back()
  const { ref: swipeRef } = useSwipeBack({
    mode: "callback",
    onTrigger: () => setMobileView("list"),
    shouldStart: () => mobileView === "chat" && !paneOpen,
  });

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <div className="app" data-mobile-view={mobileView}>
      {/* Left list */}
      <aside
        className="list"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--bg-list)",
          borderRight: "1px solid var(--line)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--line)",
            minHeight: 56,
          }}
        >
          <h1 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 600, color: "var(--fg-0)" }}>
            AI Teams
          </h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="New project"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 0,
              background: "transparent",
              color: "var(--accent)",
              fontSize: 22,
              cursor: "pointer",
            }}
          >
            +
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {projects === null && (
            <div style={{ padding: 16, color: "var(--fg-2)" }}>Loading…</div>
          )}
          {projects?.length === 0 && (
            <div style={{ padding: 16, color: "var(--fg-2)" }}>No projects</div>
          )}
          {projects?.map((p) => (
            <ChatItem
              key={p.id}
              c={projectToChatItem(p, p.id === activeId ? activeSprint?.title ?? null : null)}
              active={p.id === activeId}
              onClick={() => {
                setActiveId(p.id);
                setMobileView("chat");
                setPaneOpen(false);
              }}
            />
          ))}
        </div>
      </aside>

      {/* Right chat */}
      <main
        className="chat"
        ref={swipeRef}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          background: "var(--bg-chat)",
        }}
      >
        {!activeProject ? (
          <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--fg-2)" }}>
            Select a team to start
          </div>
        ) : (
          <>
            <ChatHeader
              name={activeProject.name}
              sub={topic ? `Topic: ${topic}` : "Select an agent"}
              onBack={() => setMobileView("list")}
              onMoreClick={() => setPaneOpen((v) => !v)}
            />
            {(activeProject.roles?.length ?? 0) > 0 && (
              <TopicBar
                roles={activeProject.roles ?? []}
                active={topic}
                onSelect={setTopic}
              />
            )}
            {activeSprint && (
              <PinStrip title={activeSprint.title} text={activeSprint.sub} />
            )}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                minHeight: 0,
                padding: 12,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {(() => {
                if (!sessionName || !topic) {
                  return (
                    <div style={{ margin: "auto", color: "var(--fg-2)" }}>
                      No active session
                    </div>
                  );
                }
                const adapted = adaptBubbles(
                  filterMessages(parsePane(outputs[topic] ?? "", topic)),
                );
                if (adapted.length === 0) {
                  return (
                    <div style={{ margin: "auto", color: "var(--fg-2)" }}>
                      No messages yet
                    </div>
                  );
                }
                return adapted.map((b) => (
                  <Bubble key={b.key} m={b.msg} mine={b.mine} />
                ));
              })()}
            </div>
            <Composer
              sessionName={sessionName}
              role={topic}
              disabled={!sessionName || !topic}
            />
          </>
        )}

        {/* Collapsible AgentPaneView (layout-a — Boss-recommended dark wrapper) */}
        {paneOpen && sessionName && topic && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "#000",
              borderLeft: "1px solid var(--line)",
              boxShadow: "-4px 0 24px rgba(0,0,0,0.25)",
              display: "flex",
              flexDirection: "column",
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0a0a0a",
                color: "#fff",
                borderBottom: "1px solid #1f1f1f",
              }}
            >
              <span style={{ flex: 1, fontFamily: "var(--font-chat-mono)", fontSize: 12 }}>
                Terminal · {topic}
              </span>
              <button
                type="button"
                onClick={() => setPaneOpen(false)}
                aria-label="Close terminal"
                style={{
                  width: 32,
                  height: 32,
                  border: 0,
                  background: "transparent",
                  color: "#888",
                  cursor: "pointer",
                  borderRadius: 4,
                  fontSize: 16,
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AgentPaneView
                sessionName={sessionName}
                role={topic}
                isVisible={true}
                output={outputs[topic] ?? ""}
                wsStatus={wsStatus}
              />
            </div>
          </div>
        )}
      </main>

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(projectId) => {
          setCreateOpen(false);
          // Refresh project list so the new row appears, then select it
          api.listProjects().then((next) => {
            setProjects(next);
            setActiveId(projectId);
            setMobileView("chat");
          }).catch(() => {
            router.push(`/project?team=${projectId}`);
          });
        }}
      />
    </div>
  );
}

// ─── default export — Suspense wrapper required for useSearchParams (Next 15) ─

export default function ProjectListPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: "100dvh",
            background: "var(--bg-app)",
            color: "var(--fg-2)",
          }}
        >
          Loading…
        </div>
      }
    >
      <ProjectShell />
    </Suspense>
  );
}
