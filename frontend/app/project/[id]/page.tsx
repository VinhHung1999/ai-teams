"use client";

import { use, useCallback, useEffect, useState } from "react";

import { AgentPaneView } from "@/components/AgentPaneView";
import { BoardDrawer } from "@/components/project/BoardDrawer";
import { CompactKanban } from "@/components/project/CompactKanban";
import { HeaderRolePills } from "@/components/project/HeaderRolePills";
import { api } from "@/lib/api";
import type { Board, Project } from "@/lib/types";
import { useTmuxWs } from "@/lib/useTmuxWs";

function derivePaneMessage(
  project: Project | null,
  roles: string[],
  sessionName: string,
  activeRole: string,
): string | null {
  if (!project) return "Loading project…";
  if (roles.length === 0) return "No roles configured";
  if (!sessionName) return "Tmux session not running";
  if (!activeRole) return "Select a role";
  return null;
}

export default function ProjectChatPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const id = Number(params.id);
  const validId = Number.isFinite(id);

  const [project, setProject] = useState<Project | null>(null);
  const [activeRole, setActiveRole] = useState<string>("");
  const [board, setBoard] = useState<Board | null>(null);
  const [activity, setActivity] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Project (one-shot per id)
  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    api
      .getProject(id)
      .then((p) => {
        if (cancelled) return;
        setProject(p);
        const roles = p.roles ?? [];
        if (roles.length > 0) setActiveRole((curr) => curr || roles[0]);
      })
      .catch(() => !cancelled && setProject(null));
    return () => {
      cancelled = true;
    };
  }, [id, validId]);

  // Active sprint board (poll 5s, swallow failures, keep last good)
  useEffect(() => {
    if (!validId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const sprints = await api.listSprints(id);
        const active = sprints.find((s) => s.status === "active");
        if (!active) {
          if (!cancelled) setBoard(null);
          return;
        }
        const b = await api.getBoard(active.id);
        if (!cancelled) setBoard(b);
      } catch {
        /* keep last good */
      }
    };
    tick();
    const handle = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id, validId]);

  // Per-role activity pulses (REST poll mirrors dashboard convention)
  const sessionName = project?.tmux_session_name ?? "";
  useEffect(() => {
    if (!sessionName) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/activity`);
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, boolean>;
        if (!cancelled) setActivity(data);
      } catch {
        /* ignore */
      }
    };
    poll();
    const handle = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [sessionName]);

  // Live tmux output (single WS, switches on role/session change)
  const { outputs, wsStatus } = useTmuxWs(sessionName || undefined, activeRole);
  const output = activeRole ? outputs[activeRole] ?? "" : "";

  const handleRoleChange = useCallback((role: string) => setActiveRole(role), []);

  if (!validId) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Invalid project id</p>
      </div>
    );
  }

  const roles = project?.roles ?? [];
  const paneEmptyMessage = derivePaneMessage(project, roles, sessionName, activeRole);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <div className="flex flex-1 flex-col h-full min-w-0">
        <header className="sticky top-0 z-20 bg-card/40 backdrop-blur-2xl backdrop-saturate-150 border-b border-border/40 flex items-center gap-2 px-2 py-2 min-h-[56px]">
          <button
            type="button"
            title="Coming soon"
            aria-label="Sidebar (coming soon)"
            className="inline-flex items-center justify-center w-11 h-11 rounded-md text-muted-foreground opacity-50 cursor-not-allowed"
          >
            ☰
          </button>
          <div className="flex-1 min-w-0">
            <HeaderRolePills
              roles={roles}
              activeRole={activeRole}
              onRoleChange={handleRoleChange}
              activity={activity}
            />
          </div>
          <button
            type="button"
            aria-label="Open board"
            onClick={() => setDrawerOpen(true)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
          >
            📋
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-hidden">
          {paneEmptyMessage ? (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-sm text-muted-foreground">{paneEmptyMessage}</p>
            </div>
          ) : (
            <AgentPaneView
              sessionName={sessionName}
              role={activeRole}
              isVisible={true}
              output={output}
              wsStatus={wsStatus}
            />
          )}
        </div>

        {/* Composer placeholder ([386]) */}
        <div
          className="sticky bottom-0 min-h-[56px] border-t border-border/40 bg-card/40 backdrop-blur-2xl flex items-center px-3 text-sm text-muted-foreground"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          Composer ([386])
        </div>
      </div>

      <BoardDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <CompactKanban board={board} expandHref={`/project?id=${id}`} maxCardsPerLane={3} />
      </BoardDrawer>
    </div>
  );
}
