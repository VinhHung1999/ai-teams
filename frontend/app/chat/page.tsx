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

  // Load projects on mount
  useEffect(() => {
    api.listProjects().then((ps) => {
      setProjects(ps);
      if (ps.length > 0 && selectedId === null) {
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
    setMobileView("chat"); // on mobile: auto-switch to chat view

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

  // WS: append new events, deduplicate by id
  const handleWsEvents = useCallback((newEvts: ChatEvent[]) => {
    setEvents((prev) => {
      const existingIds = new Set(prev.map((e) => e.id));
      const fresh = newEvts.filter((e) => !existingIds.has(e.id));
      if (fresh.length === 0) return prev;
      // Update preview
      const last = fresh[fresh.length - 1];
      if (selectedId) {
        setLastEvents((p) => ({
          ...p,
          [selectedId]: last.text?.slice(0, 60) ?? last.tool?.name ?? "",
        }));
      }
      return [...prev, ...fresh];
    });
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
