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
  const [infoPanelTab, setInfoPanelTab] = useState<"overview" | "files" | "agents">("overview");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  // [369] Terminal panel (desktop ≥1024px only)
  const [terminalOpen, setTerminalOpen] = useState(true);

  // Mobile single-view state: 'list' | 'chat'
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

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
    setEvents([]);
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

  // [387] 500ms history polling — replaces WS for active project rendering.
  // Simple, deterministic, no dedup/optimistic complexity.
  useEffect(() => {
    if (!selectedId) return;
    const poll = async () => {
      try {
        const { events: hist } = await api.chatHistory(selectedId, HISTORY_LIMIT);
        setEvents((prev) => {
          const prevIds = new Set(prev.map((e) => e.id));
          return hist.some((e) => !prevIds.has(e.id)) ? hist : prev;
        });
      } catch {}
    };
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [selectedId]);

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
    // [387] No post-send fetch needed — 500ms interval handles it
  }, [selectedId]);

  const openInfo = useCallback((tab: "overview" | "files" | "agents" = "overview") => {
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
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--c-line)", flexShrink: 0, background: "var(--c-bg-list-glass)", backdropFilter: "blur(24px) saturate(180%)" }}>
          <button style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: "transparent", color: "var(--c-fg-1)", display: "grid", placeItems: "center", cursor: "pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M3 12h18M3 18h18"/>
            </svg>
          </button>
          <div style={{ flex: 1, height: 36, background: "rgba(0,0,0,0.04)", borderRadius: 18, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", color: "var(--c-fg-2)", fontSize: 14 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>
            </svg>
            Search
          </div>
        </div>
        <div className="flex-1 overflow-y-auto chat-scroll">
          <TeamList
            projects={projects}
            activeId={selectedId}
            onSelect={(id) => handleSelectProject(id)}
            lastEvents={lastEvents}
            lastEventAt={lastEventAt}
            lastReadAt={lastReadAt}
          />
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <main className="chat-wallpaper flex flex-row min-w-0 overflow-hidden chat-mobile-chat" style={{ gridColumn: 2, gridRow: 1 }}>
        {/* [373] Terminal panel — column 2, left of chat, desktop ≥1024px only */}
        {terminalOpen && selectedProject && (
          <div className="chat-terminal-wrap">
            <ChatTerminalPanel
              project={selectedProject}
              selectedRole={selectedRole}
              onClose={() => setTerminalOpen(false)}
              dragSide="right"
            />
          </div>
        )}

        {/* Chat column (flex-1) */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
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
              <ChatHeader
                project={selectedProject}
                onOpenInfo={openInfo}
                onBack={() => setMobileView("list")}
                terminalOpen={terminalOpen}
                onToggleTerminal={() => setTerminalOpen((v) => !v)}
              />

              <TopicBar
                project={selectedProject}
                selectedRole={selectedRole}
                onSelectRole={setSelectedRole}
              />

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

          {/* Info panel (snap open/close) */}
          <InfoPanel
            open={infoPanelOpen}
            tab={infoPanelTab}
            project={selectedProject}
            roles={roles}
            onClose={() => { setInfoPanelOpen(false); setInfoPanelTab("overview"); }}
            onTabChange={setInfoPanelTab}
            onSelectRole={(role) => { setSelectedRole(role); setInfoPanelOpen(false); }}
            onRefreshProjects={loadProjects}
          />
        </div>

      </main>
    </div>
  );
}
