"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TeamList } from "@/components/chat/TeamList";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatStream } from "@/components/chat/ChatStream";
import { ChatInput } from "@/components/chat/ChatInput";
import { Drawer, type DrawerTab } from "@/components/chat/Drawer";
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("kanban");

  // Sidebar mobile state
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

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
    setMobileSidebarOpen(false);

    if (!proj) return;

    // Enrich with roles
    try {
      const full = await api.getProject(id);
      setRoles(full.roles?.length ? full.roles : ["PO", "DEV"]);
      setSelectedProject(full);
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

  const openDrawer = useCallback((tab: DrawerTab) => {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* ── Mobile sidebar overlay ── */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Teams sidebar ── */}
      <aside
        className={`
          flex-shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900 overflow-hidden
          fixed inset-y-0 left-0 z-40 w-72 transition-transform duration-200
          md:relative md:translate-x-0
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <span className="font-semibold text-sm text-white flex-1">AI Teams</span>
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-700 text-zinc-400"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <TeamList
            projects={projects}
            activeId={selectedId}
            onSelect={(id) => handleSelectProject(id)}
            lastEvents={lastEvents}
          />
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile hamburger */}
        <div className="md:hidden absolute left-3 top-3 z-10">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-zinc-800 text-zinc-400"
          >
            ☰
          </button>
        </div>

        <ChatHeader
          project={selectedProject}
          onOpenKanban={() => openDrawer("kanban")}
          onOpenFiles={() => openDrawer("files")}
        />

        <ChatStream
          events={events}
          loading={loadingHistory}
          hasMore={hasMore}
          onLoadMore={loadMore}
          className="flex-1 min-h-0"
        />

        <ChatInput
          roles={roles}
          defaultRole={roles[0]}
          disabled={!selectedId}
          onSend={handleSend}
        />

        {/* Drawer overlay */}
        <Drawer
          open={drawerOpen}
          tab={drawerTab}
          project={selectedProject}
          onClose={() => setDrawerOpen(false)}
          onTabChange={setDrawerTab}
        />
      </main>
    </div>
  );
}
