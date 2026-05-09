"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AgentPaneView } from "@/components/AgentPaneView";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { AttachMenu } from "@/components/project/AttachMenu";
import { ChatHeader } from "@/components/project/ChatHeader";
import { ChatItem, type ChatItemData } from "@/components/project/ChatItem";
import { Composer } from "@/components/project/Composer";
import { InfoPanel } from "@/components/project/InfoPanel";
import { PinStrip } from "@/components/project/PinStrip";
import { SlashHints } from "@/components/project/SlashHints";
import { TopicBar } from "@/components/project/TopicBar";

import { api } from "@/lib/api";
import type { Board, Project } from "@/lib/types";
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

// ─── inner component (uses useSearchParams → must be inside Suspense) ────────

function ProjectShell() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [topic, setTopic] = useState<string>("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [activeSprint, setActiveSprint] = useState<{ id: number; title: string; sub: string } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // [391c] Composer-controlled mode + overlays
  const [composerText, setComposerText] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);

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

  // Active sprint for PinStrip — fetched only for the selected project.
  // [391c] now also carries `id` so the board-fetch effect below can resolve.
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
            id: active.id,
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

  // [391c] Board fetch — feeds InfoPanel Overview tab.
  useEffect(() => {
    if (!activeSprint) { setBoard(null); return; }
    let cancelled = false;
    api.getBoard(activeSprint.id)
      .then((b) => { if (!cancelled) setBoard(b); })
      .catch(() => { if (!cancelled) setBoard(null); });
    return () => { cancelled = true; };
  }, [activeSprint]);

  // Live tmux output for the active topic
  const sessionName = activeProject?.tmux_session_name ?? "";
  const { outputs, wsStatus } = useTmuxWs(sessionName || undefined, topic);

  // Swipe-back: dispatch state instead of router.back()
  const { ref: swipeRef } = useSwipeBack({
    mode: "callback",
    onTrigger: () => setMobileView("list"),
    shouldStart: () => mobileView === "chat",
  });

  // Browser-back on mobile chat view → pop to list (stay on /project).
  // Push a synthetic history entry when entering chat; popstate undoes it.
  // Desktop (≥768px) skips pushState — both panes are visible, normal nav is fine.
  const pushedChatRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mobileView === "chat" && !pushedChatRef.current) {
      if (window.innerWidth < 768) {
        window.history.pushState({ aiTeamsView: "chat" }, "");
        pushedChatRef.current = true;
      }
    } else if (mobileView === "list") {
      pushedChatRef.current = false;
    }
  }, [mobileView]);

  useEffect(() => {
    const onPop = () => {
      if (mobileView === "chat") {
        setMobileView("list");
        pushedChatRef.current = false;
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [mobileView]);

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
              onWhoClick={() => setShowInfo(true)}
              onMoreClick={() => setShowInfo(true)}
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
            {!sessionName || !topic ? (
              <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--fg-2)" }}>
                No active session
              </div>
            ) : (
              <div style={{ flex: 1, minHeight: 0, background: "#000" }}>
                <AgentPaneView
                  sessionName={sessionName}
                  role={topic}
                  isVisible={true}
                  output={outputs[topic] ?? ""}
                  wsStatus={wsStatus}
                />
              </div>
            )}
            <Composer
              sessionName={sessionName}
              role={topic}
              disabled={!sessionName || !topic}
              value={composerText}
              onChange={setComposerText}
              onAttachClick={() => setShowAttach((v) => !v)}
            />
            {composerText.startsWith("/") && (
              <SlashHints
                filterText={composerText.slice(1)}
                onSelect={(cmd) => setComposerText(cmd + " ")}
              />
            )}
            {showAttach && (
              <AttachMenu
                onClose={() => setShowAttach(false)}
              />
            )}
          </>
        )}

        <InfoPanel
          open={showInfo && !!activeProject}
          onClose={() => setShowInfo(false)}
          name={activeProject?.name ?? ""}
          sub={(activeProject?.roles ?? []).join(" · ") || "No team"}
          board={board}
          roles={activeProject?.roles ?? []}
          onSelectAgent={(r) => setTopic(r)}
        />
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
