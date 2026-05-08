"use client";

// [382] Capture-pane chat — page wires useTmuxWs to ChatStream/ChatInput.
// No JSONL, no events[], no firehose. ChatStream gets raw pane output and
// parses it locally. ChatInput sends raw text via tmux send (no [via UI]
// BOSS: prefix).

import { useState, useEffect, useCallback, useRef } from "react";
import { TeamList } from "@/components/chat/TeamList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { TopicBar } from "@/components/chat/TopicBar";
import { PinStrip } from "@/components/chat/PinStrip";
import { ChatStream } from "@/components/chat/ChatStream";
import { ChatInput } from "@/components/chat/ChatInput";
import { InfoPanel } from "@/components/chat/InfoPanel";
import { ChatTerminalPanel } from "@/components/chat/ChatTerminalPanel";
import { api } from "@/lib/api";
import { useTmuxWs } from "@/lib/useTmuxWs";
import { usePushNotifications } from "@/lib/usePushNotifications";
import type { Project } from "@/lib/types";

export default function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [roles, setRoles] = useState<string[]>(["PO", "DEV"]);

  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [infoPanelTab, setInfoPanelTab] = useState<"overview" | "files" | "team">("overview");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // Mobile single-view state: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // [407] Swipe-to-back gesture: touch near left edge → slide to list
  const chatColRef = useRef<HTMLDivElement>(null);
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const swipeActive = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (mobileView !== "chat") return;
    const t = e.touches[0];
    if (t.clientX > 40) return;
    swipeOrigin.current = { x: t.clientX, y: t.clientY };
    swipeActive.current = false;
  }, [mobileView]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeOrigin.current) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeOrigin.current.x;
    const dy = Math.abs(t.clientY - swipeOrigin.current.y);
    if (!swipeActive.current) {
      if (dy > dx) { swipeOrigin.current = null; return; }
      if (dx > 8) swipeActive.current = true;
    }
    if (swipeActive.current && dx > 0 && chatColRef.current) {
      chatColRef.current.style.transform = `translateX(${dx}px)`;
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swipeOrigin.current || !swipeActive.current) { swipeOrigin.current = null; return; }
    const dx = e.changedTouches[0].clientX - swipeOrigin.current.x;
    swipeOrigin.current = null;
    swipeActive.current = false;
    const el = chatColRef.current;
    if (!el) return;
    if (dx > window.innerWidth / 3) {
      el.style.transition = "transform 180ms ease";
      el.style.transform = `translateX(${window.innerWidth}px)`;
      setTimeout(() => { setMobileView("list"); el.style.transition = ""; el.style.transform = ""; }, 185);
    } else {
      el.style.transition = "transform 180ms ease";
      el.style.transform = "translateX(0)";
      setTimeout(() => { el.style.transition = ""; }, 185);
    }
  }, []);

  // Inbox unread tracking — preserved across re-mounts via localStorage.
  // Last-event preview / sort dropped with firehose (Sprint 47 [382]
  // out-of-scope regression).
  const [lastReadAt, setLastReadAt] = useState<Record<number, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem("chat-read-state");
      if (stored) setLastReadAt(JSON.parse(stored));
    } catch {}
  }, []);

  const loadProjects = useCallback(() => {
    api.listProjects().then(setProjects).catch(() => {});
  }, []);

  useEffect(() => { loadProjects(); }, []);

  // [375] On mount: read ?team=<id> URL param → auto-select team
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const teamId = parseInt(params.get("team") ?? "");
    if (!isNaN(teamId)) handleSelectProject(teamId);
  }, []);

  // [375] Listen for SW postMessage select-team (from notification click)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "select-team" && e.data.projectId) {
        handleSelectProject(Number(e.data.projectId));
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);

  const handleSelectProject = useCallback(async (id: number, ps?: Project[]) => {
    const list = ps ?? projects;
    const proj = list.find((p) => p.id === id) ?? null;

    setSelectedId(id);
    setSelectedProject(proj);
    setMobileView("chat");
    setInfoPanelOpen(false);
    setInfoPanelTab("overview");

    const now = new Date().toISOString();
    setLastReadAt((prev) => {
      const updated = { ...prev, [id]: now };
      try { localStorage.setItem("chat-read-state", JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (!proj) return;

    try {
      const full = await api.getProject(id);
      const projectRoles = full.roles?.length ? full.roles : ["PO", "DEV"];
      setRoles(projectRoles);
      setSelectedProject(full);
      setSelectedRole(projectRoles[0] ?? null);
    } catch {}
  }, [projects]);

  const sessionName = selectedProject?.tmux_session_name ?? undefined;
  const subscribeRole = selectedRole && selectedRole !== "TERMINAL" ? selectedRole : roles[0] ?? "PO";
  const { outputs, wsStatus } = useTmuxWs(sessionName, subscribeRole);
  const paneOutput = outputs[subscribeRole] ?? "";

  // [352] PWA Web Push
  usePushNotifications();

  const handleSend = useCallback(async (role: string, text: string) => {
    if (!sessionName) throw new Error("No tmux session for selected project");
    const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? `Send failed (${res.status})`);
    }
  }, [sessionName]);

  const openInfo = useCallback((tab: "overview" | "files" | "team" = "overview") => {
    setInfoPanelTab(tab);
    setInfoPanelOpen(true);
  }, []);

  return (
    <div
      className="h-[100dvh] overflow-hidden"
      data-mobile-view={mobileView}
      style={{
        display: "grid",
        gridTemplateColumns: "320px 1fr",
        background: "var(--c-bg-app)",
        color: "var(--c-fg-0)",
      }}
    >
      <aside
        className="glass-sidebar flex flex-col overflow-hidden chat-mobile-list"
        style={{ borderRight: "1px solid var(--c-line)", gridColumn: 1, gridRow: 1, minWidth: 0, overflowX: "hidden" }}
      >
        <div className="flex-1 overflow-y-auto chat-scroll">
          <TeamList
            projects={projects}
            activeId={selectedId}
            onSelect={(id) => handleSelectProject(id)}
            lastReadAt={lastReadAt}
            onCreateTeam={() => { /* PO skill scaffolds async — user refreshes to see new team */ }}
          />
        </div>
      </aside>

      <main className="chat-wallpaper flex flex-row min-w-0 overflow-hidden chat-mobile-chat" style={{ gridColumn: 2, gridRow: 1 }}>
        <div
          ref={chatColRef}
          className="flex flex-col flex-1 min-w-0 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center chat-no-team-placeholder" style={{ color: "var(--c-fg-2)", gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={{ fontSize: 15 }}>Select a team to start chatting</span>
            </div>
          ) : (
            <>
              <div style={{ position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
                <ChatHeader
                  project={selectedProject}
                  onOpenInfo={openInfo}
                  onBack={() => setMobileView("list")}
                />

                <TopicBar
                  project={selectedProject}
                  selectedRole={selectedRole}
                  onSelectRole={setSelectedRole}
                />
              </div>

              {selectedRole === "TERMINAL" ? (
                <ChatTerminalPanel
                  project={selectedProject}
                  className="flex-1 min-h-0"
                />
              ) : (
                <>
                  <PinStrip
                    projectId={selectedId}
                    onClick={() => openInfo("overview")}
                  />

                  {wsStatus !== "connected" && (
                    <div
                      className="px-3 py-1 text-[11px] font-mono shrink-0"
                      style={{
                        color: wsStatus === "connecting" ? "var(--c-fg-2)" : "#ef4444",
                        background: wsStatus === "connecting" ? "transparent" : "rgba(239,68,68,0.06)",
                      }}
                    >
                      {wsStatus === "connecting" ? "connecting pane…" : "pane disconnected"}
                    </div>
                  )}

                  <ChatStream
                    output={paneOutput}
                    viewingRole={subscribeRole}
                    className="flex-1 min-h-0"
                  />

                  <ChatInput
                    roles={roles}
                    defaultRole={selectedRole ?? roles[0]}
                    disabled={!selectedId || !sessionName}
                    onSend={handleSend}
                    projectId={selectedId ?? undefined}
                  />
                </>
              )}
            </>
          )}

          <InfoPanel
            open={infoPanelOpen}
            tab={infoPanelTab}
            project={selectedProject}
            roles={roles}
            onClose={() => { setInfoPanelOpen(false); setInfoPanelTab("overview"); }}
            onTabChange={setInfoPanelTab}
            onSelectRole={(role) => { setSelectedRole(role); setInfoPanelOpen(false); setInfoPanelTab("overview"); }}
            onRefreshProjects={loadProjects}
          />
        </div>

      </main>
    </div>
  );
}
