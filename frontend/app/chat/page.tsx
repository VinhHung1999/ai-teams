"use client";

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
import { useChatWs, getCachedChatEvents, seedChatCache } from "@/lib/useChatWs";
import { useFirehoseWs } from "@/lib/useFirehoseWs";
import { usePushNotifications } from "@/lib/usePushNotifications";
import type { Project } from "@/lib/types";
import type { ChatEvent } from "@/lib/chat-types";

const HISTORY_LIMIT = 200;

export default function ChatPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [roles, setRoles] = useState<string[]>(["PO", "DEV"]);

  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const oldestTsRef = useRef<string | undefined>(undefined);

  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [infoPanelTab, setInfoPanelTab] = useState<"overview" | "files" | "team">("overview");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // [392] Terminal tab is a value of selectedRole === 'TERMINAL'

  // Mobile single-view state: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  // [407] Swipe-to-back gesture: touch near left edge → slide to list
  const chatColRef = useRef<HTMLDivElement>(null);
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const swipeActive = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (mobileView !== "chat") return;
    const t = e.touches[0];
    if (t.clientX > 40) return; // only detect from left edge ≤40px
    swipeOrigin.current = { x: t.clientX, y: t.clientY };
    swipeActive.current = false;
  }, [mobileView]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeOrigin.current) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeOrigin.current.x;
    const dy = Math.abs(t.clientY - swipeOrigin.current.y);
    if (!swipeActive.current) {
      if (dy > dx) { swipeOrigin.current = null; return; } // vertical scroll wins
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

  // Last event preview per project
  const [lastEvents, setLastEvents] = useState<Record<number, string>>({});
  // Inbox: last event timestamp per project (for sort + unread detection)
  const [lastEventAt, setLastEventAt] = useState<Record<number, string>>({});
  // Inbox: last read timestamp per project (persisted in localStorage)
  const [lastReadAt, setLastReadAt] = useState<Record<number, string>>({});

  // Load lastReadAt from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("chat-read-state");
      if (stored) setLastReadAt(JSON.parse(stored));
    } catch {}
  }, []);

  // Load projects on mount + fetch last-events for inbox sort
  const loadProjects = useCallback(() => {
    api.listProjects().then((ps) => {
      setProjects(ps);
      if (ps.length > 0) {
        const ids = ps.map((p) => p.id).join(",");
        fetch(`/api/chat/last-events?projectIds=${ids}`)
          .then((r) => r.json())
          .then((data: Record<string, { lastMessageAt: string; lastMessageText: string }>) => {
            const ats: Record<number, string> = {};
            const previews: Record<number, string> = {};
            for (const [k, v] of Object.entries(data)) {
              const id = parseInt(k);
              ats[id] = v.lastMessageAt;
              previews[id] = v.lastMessageText;
            }
            setLastEventAt(ats);
            setLastEvents((p) => ({ ...p, ...previews }));
          })
          .catch(() => {});
      }
    }).catch(() => {});
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

  // [378c] Safety re-fetch: catch missed WS events every 30s + on tab focus
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  useEffect(() => {
    const refetch = async () => {
      const id = selectedIdRef.current;
      if (!id) return;
      try {
        const { events: hist } = await api.chatHistory(id, HISTORY_LIMIT);
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const seen = new Set<string>();
          const fresh = hist.filter((e) => {
            if (existingIds.has(e.id) || seen.has(e.id)) return false;
            seen.add(e.id); return true;
          });
          return fresh.length === 0 ? prev : [...prev, ...fresh].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        });
      } catch {}
    };
    const interval = setInterval(refetch, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") refetch(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  const handleSelectProject = useCallback(async (id: number, ps?: Project[]) => {
    const list = ps ?? projects;
    const proj = list.find((p) => p.id === id) ?? null;

    setSelectedId(id);
    setSelectedProject(proj);
    // [388] Restore from cache instantly; history fetch below will update/seed
    setEvents(getCachedChatEvents(id));
    oldestTsRef.current = undefined;
    setHasMore(false);
    setMobileView("chat");
    // [374] Reset InfoPanel to Overview when switching teams
    setInfoPanelOpen(false);
    setInfoPanelTab("overview");

    // Mark as read
    const now = new Date().toISOString();
    setLastReadAt((prev) => {
      const updated = { ...prev, [id]: now };
      try { localStorage.setItem("chat-read-state", JSON.stringify(updated)); } catch {}
      return updated;
    });

    if (!proj) return;

    // Enrich with roles
    try {
      const full = await api.getProject(id);
      const projectRoles = full.roles?.length ? full.roles : ["PO", "DEV"];
      setRoles(projectRoles);
      setSelectedProject(full);
      setSelectedRole(projectRoles[0] ?? null); // default to first role, no "All"
    } catch {}

    // Load initial history
    setLoadingHistory(true);
    try {
      const { events: hist, total } = await api.chatHistory(id, HISTORY_LIMIT);
      seedChatCache(id, hist); // [388] seed module cache with authoritative history
      setEvents(hist);
      setHasMore(total > hist.length);
      if (hist.length > 0) {
        oldestTsRef.current = hist[0].timestamp;
        // Update preview
        const last = hist[hist.length - 1];
        setLastEvents((prev) => ({
          ...prev,
          [id]: last.text?.slice(0, 60) ?? last.tool?.name ?? "",
        }));
      }
    } catch {} finally {
      setLoadingHistory(false);
    }
  }, [projects]);

  // Load more (older) events
  const loadMore = useCallback(async () => {
    if (!selectedId || loadingHistory || !hasMore) return;
    setLoadingHistory(true);
    try {
      const { events: older, total } = await api.chatHistory(
        selectedId, HISTORY_LIMIT, oldestTsRef.current
      );
      if (older.length > 0) {
        oldestTsRef.current = older[0].timestamp;
        setEvents((prev) => [...older, ...prev]);
      }
      setHasMore(total > older.length);
    } catch {} finally {
      setLoadingHistory(false);
    }
  }, [selectedId, loadingHistory, hasMore]);

  // [388] Singleton WS handler — appends fresh events from per-project WS
  const handleWsEvents = useCallback((fresh: ChatEvent[]) => {
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const toAdd = fresh.filter((e) => !existingIds.has(e.id));
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
    const last = fresh[fresh.length - 1];
    if (last && selectedId) {
      setLastEvents((p) => ({ ...p, [selectedId]: (last.text ?? last.tool?.name ?? "").slice(0, 60) }));
      setLastEventAt((p) => ({ ...p, [selectedId]: last.timestamp }));
    }
  }, [selectedId]);

  useChatWs(selectedId, handleWsEvents);

  // [351] Firehose — inbox preview only (lastEventAt + lastEvents for sidebar sort/badge)
  useFirehoseWs(useCallback((projectId, events) => {
    const last = events[events.length - 1];
    if (!last) return;
    setLastEventAt((p) => ({ ...p, [projectId]: last.timestamp }));
    if (last.kind === "message" && last.text) {
      setLastEvents((p) => ({ ...p, [projectId]: last.text!.slice(0, 60) }));
    }
  }, []));

  // [352] PWA Web Push
  usePushNotifications();

  const handleSend = useCallback(async (role: string, text: string) => {
    if (!selectedId) return;
    await api.chatSend(selectedId, role, text);
  }, [selectedId]);

  const openInfo = useCallback((tab: "overview" | "files" | "team" = "overview") => {
    setInfoPanelTab(tab);
    setInfoPanelOpen(true);
  }, []);

  return (
    // data-mobile-view drives CSS for single-view on mobile (list|chat slide)
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
      {/* ── Teams sidebar ── */}
      <aside
        className="glass-sidebar flex flex-col overflow-hidden chat-mobile-list"
        style={{ borderRight: "1px solid var(--c-line)", gridColumn: 1, gridRow: 1, minWidth: 0, overflowX: "hidden" }}
      >
        <div className="flex-1 overflow-y-auto chat-scroll">
          <TeamList
            projects={projects}
            activeId={selectedId}
            onSelect={(id) => handleSelectProject(id)}
            lastEvents={lastEvents}
            lastEventAt={lastEventAt}
            lastReadAt={lastReadAt}
            onCreateTeam={() => { /* PO skill scaffolds async — user refreshes to see new team */ }}
          />
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <main className="chat-wallpaper flex flex-row min-w-0 overflow-hidden chat-mobile-chat" style={{ gridColumn: 2, gridRow: 1 }}>
        {/* Chat column (flex-1) — [407] swipe-to-back gesture */}
        <div
          ref={chatColRef}
          className="flex flex-col flex-1 min-w-0 overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* [359] No team selected — show placeholder on desktop */}
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center chat-no-team-placeholder" style={{ color: "var(--c-fg-2)", gap: 12 }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span style={{ fontSize: 15 }}>Select a team to start chatting</span>
            </div>
          ) : (
            <>
              {/* [399] Sticky header zone — stays at top when mobile keyboard appears */}
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

              {/* [392] Terminal tab — full main area swap */}
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

                  <ChatStream
                    events={events}
                    loading={loadingHistory}
                    hasMore={hasMore}
                    onLoadMore={loadMore}
                    filterRole={selectedRole ?? undefined}
                    projectId={selectedId ?? undefined}
                    className="flex-1 min-h-0"
                  />

                  <ChatInput
                    roles={roles}
                    defaultRole={selectedRole ?? roles[0]}
                    disabled={!selectedId}
                    onSend={handleSend}
                    projectId={selectedId ?? undefined}
                  />
                </>
              )}
            </>
          )}

          {/* Info panel (snap open/close) */}
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
