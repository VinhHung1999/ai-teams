"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TeamList } from "@/components/chat/TeamList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { TopicBar } from "@/components/chat/TopicBar";
import { PinStrip } from "@/components/chat/PinStrip";
import { ChatStream } from "@/components/chat/ChatStream";
import { ChatInput } from "@/components/chat/ChatInput";
import { InfoPanel } from "@/components/chat/InfoPanel";
import { api } from "@/lib/api";
import { useChatWs } from "@/lib/useChatWs";
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
  useEffect(() => {
    api.listProjects().then((ps) => {
      setProjects(ps);
      // Fetch last-event timestamps for all projects
      if (ps.length > 0) {
        const ids = ps.map((p) => p.id).join(",");
        fetch(`/api/chat/last-events?projectIds=${ids}`)
          .then((r) => r.json())
          .then((data: Record<string, string>) => {
            const typed: Record<number, string> = {};
            for (const [k, v] of Object.entries(data)) typed[parseInt(k)] = v;
            setLastEventAt(typed);
          })
          .catch(() => {});
        handleSelectProject(ps[0].id, ps);
      }
    }).catch(() => {});
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

  // [343] WS dedup: for BOSS message events, replace matching optimistic (5s window) to avoid dup.
  // Backend now strips '[via UI] BOSS: ' prefix; this also handles legacy events that still have it.
  const BOSS_PREFIX_RE = /^\[via UI\]\s*BOSS:\s*/;
  const DEDUP_WINDOW_MS = 5000;

  const handleWsEvents = useCallback((newEvts: ChatEvent[]) => {
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const result = [...prev];

      for (const evt of newEvts) {
        if (existingIds.has(evt.id)) continue;

        if (evt.role === "BOSS" && evt.kind === "message") {
          // Strip legacy prefix if backend hasn't stripped it yet
          const cleanText = evt.text?.replace(BOSS_PREFIX_RE, "") ?? "";
          const evtTime = new Date(evt.timestamp).getTime();
          const optIdx = result.findIndex(
            (e) =>
              e.id.startsWith("optimistic-") &&
              e.role === "BOSS" &&
              e.text === cleanText &&
              Math.abs(new Date(e.timestamp).getTime() - evtTime) < DEDUP_WINDOW_MS,
          );
          if (optIdx !== -1) {
            result[optIdx] = { ...evt, text: cleanText };
          } else {
            result.push({ ...evt, text: cleanText });
          }
          existingIds.add(evt.id);
          continue;
        }

        result.push(evt);
        existingIds.add(evt.id);
      }
      return result;
    });

    // Update preview + lastEventAt outside the updater
    const last = newEvts[newEvts.length - 1];
    if (last && selectedId) {
      const cleanText = last.text?.replace(BOSS_PREFIX_RE, "") ?? last.tool?.name ?? "";
      setLastEvents((p) => ({ ...p, [selectedId]: cleanText.slice(0, 60) }));
      setLastEventAt((p) => ({ ...p, [selectedId]: last.timestamp }));
    }
  }, [selectedId]);

  useChatWs(selectedId, handleWsEvents);

  const handleSend = useCallback(async (role: string, text: string) => {
    if (!selectedId) throw new Error("No team selected");

    // Optimistic BOSS event
    const optimistic: ChatEvent = {
      id: `optimistic-${Date.now()}`,
      role: "BOSS",
      sessionId: "ui",
      timestamp: new Date().toISOString(),
      kind: "message",
      text,
    };
    setEvents((prev) => [...prev, optimistic]);

    await api.chatSend(selectedId, role, text);
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
        style={{ borderRight: "1px solid var(--c-line)", gridColumn: 1, gridRow: 1 }}
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
      <main className="chat-wallpaper flex flex-col min-w-0 overflow-hidden chat-mobile-chat" style={{ gridColumn: 2, gridRow: 1 }}>
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

        {/* Info panel (snap open/close, no animation per design) */}
        <InfoPanel
          open={infoPanelOpen}
          tab={infoPanelTab}
          project={selectedProject}
          roles={roles}
          onClose={() => setInfoPanelOpen(false)}
          onTabChange={setInfoPanelTab}
          onSelectRole={(role) => { setSelectedRole(role); setInfoPanelOpen(false); }}
        />
      </main>
    </div>
  );
}
