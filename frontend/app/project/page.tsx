"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { FileManager } from "@/components/FileManager";
import { GitChangesView } from "@/components/GitChangesView";
import { WebTerminal } from "@/components/WebTerminal";
import { AgentPaneView } from "@/components/AgentPaneView";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";
import { useBoardWs } from "@/lib/useBoardWs";
import { useTmuxWs } from "@/lib/useTmuxWs";

const ROLES = ["PO", "SM", "TL", "BE", "FE", "QA"] as const;

function ProjectPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idFromUrl = searchParams.get("id");

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    idFromUrl ? Number(idFromUrl) : null
  );
  const [project, setProject] = useState<Project | null>(null);

  // Panels collapse state
  const [agentPanelOpen, setAgentPanelOpen] = useState(true);
  const [agentPanelWidth, setAgentPanelWidth] = useState(600);
  const [teamFocusMode, setTeamFocusMode] = useState(false);
  const [mobileTeamOpen, setMobileTeamOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState<number>(() => {
    if (typeof window === "undefined") return 200;
    return parseInt(localStorage.getItem("boss-terminal-height") || "200", 10);
  });
  const [activeAgentTab, setActiveAgentTab] = useState<string>(ROLES[0]);
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | undefined>();
  const [bossTerminalKey, setBossTerminalKey] = useState(0);
  const [hasSetupFile, setHasSetupFile] = useState(false);
  const [setupFilePath, setSetupFilePath] = useState("");
  const [tmuxSessionActive, setTmuxSessionActive] = useState(false);
  const [tmuxRoles, setTmuxRoles] = useState<string[]>([]);
  const [teamStarting, setTeamStarting] = useState(false);
  const [roleActivity, setRoleActivity] = useState<Record<string, boolean>>({});
  const [centerTab, setCenterTab] = useState<"dashboard" | "files" | "git">("dashboard");
  const [filesVisited, setFilesVisited] = useState(false);
  const [gitVisited, setGitVisited] = useState(false);
  const [dashboardData, setDashboardData] = useState<Record<number, any>>({});
  const sessionName = project?.tmux_session_name || undefined;
  const projectCwd = project?.working_directory || undefined;
  const projectCacheRef = useRef<Map<number, Project>>(new Map());

  // Persistent board WebSocket — dashboard updates + notifications
  useBoardWs(
    selectedProjectId,
    useCallback((data: any) => {
      if (data.project?.id) {
        setDashboardData(prev => ({ ...prev, [data.project.id]: data }));
      }
    }, []),
  );

  // REST activity poll — only for the currently focused project
  useEffect(() => {
    if (!tmuxSessionActive || !sessionName) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/activity`);
        if (res.ok) setRoleActivity(await res.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [tmuxSessionActive, sessionName]);

  // Apply project data to state + update cache
  const applyProjectData = useCallback((data: Project) => {
    projectCacheRef.current.set(data.id, data);
    setProject(data);
    setHasSetupFile(data.has_setup_file ?? false);
    setSetupFilePath(data.setup_file_path ?? "");
    setTmuxSessionActive(data.tmux_active ?? false);
    setTmuxRoles(data.roles ?? []);
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setProject(null);
      setHasSetupFile(false);
      setTmuxSessionActive(false);
      setTmuxRoles([]);
      return;
    }
    // Use cache if available — only fetch on first visit to this project
    const cached = projectCacheRef.current.get(selectedProjectId);
    if (cached) {
      applyProjectData(cached);
      return;
    }
    api.getProject(selectedProjectId)
      .then(applyProjectData)
      .catch(() => setProject(null));
  }, [selectedProjectId, applyProjectData]);

  // Re-fetch project (used after kill/restart to refresh tmux status)
  const refreshTeamStatus = useCallback(async () => {
    if (!selectedProjectId) return;
    try {
      const data = await api.getProject(selectedProjectId);
      applyProjectData(data);
    } catch {}
  }, [selectedProjectId, applyProjectData]);

  // Activity now pushed via Board WS (see useBoardWs onActivity callback below)

  // Sync URL when project changes
  useEffect(() => {
    if (selectedProjectId !== null) {
      const currentId = searchParams.get("id");
      if (currentId !== String(selectedProjectId)) {
        router.replace(`/project?id=${selectedProjectId}`, { scroll: false });
      }
    }
  }, [selectedProjectId, router, searchParams]);

  // Reset active agent tab + lazy tab state when project changes
  useEffect(() => {
    setActiveAgentTab(ROLES[0]);
    setFilesVisited(false);
    setGitVisited(false);
  }, [selectedProjectId]);

  const handleSelectProject = (id: number) => {
    setSelectedProjectId(id);
  };

  // Build WebSocket URL for terminal
  // Next.js rewrites don't proxy WebSocket, so connect directly to backend
  const getTerminalWsUrl = useCallback((cwd?: string) => {
    const cwdParam = cwd ? `?cwd=${encodeURIComponent(cwd)}` : "";
    if (typeof window !== "undefined") {
      const { hostname, protocol } = window.location;
      const wsProtocol = protocol === "https:" ? "wss" : "ws";

      // Via tunnel: scrum-team.hungphu.work → scrum-api.hungphu.work
      if (hostname.includes("hungphu.work")) {
        const apiHost = hostname.replace("scrum-team", "scrum-api");
        return `${wsProtocol}://${apiHost}/ws/terminal${cwdParam}`;
      }

      // Local: connect directly to backend port
      return `${wsProtocol}://${hostname}:17070/ws/terminal${cwdParam}`;
    }
    return `ws://localhost:17070/ws/terminal${cwdParam}`;
  }, []);

  // 1 WS per pane — each role has its own persistent WS, only active role polls
  const { outputs: paneOutputs, wsStatus: tmuxWsStatus } = useTmuxWs(
    sessionName,
    activeAgentTab,
  );

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onTeamCommand={(projectId, command) => {
          setTerminalOpen(true);
          setTimeout(() => setPendingTerminalCommand(command), 1000);
        }}
        mobileOpenExternal={mobileSidebarOpen}
        onMobileOpenChange={setMobileSidebarOpen}
      />

      {/* Main area (dashboard + terminal) + Agent panel */}
      <div className="flex-1 flex flex-row min-w-0 min-h-0">
        {/* Center: Dashboard + Terminal (hidden in focus mode) */}
        <div className={`flex-1 flex flex-col min-w-0 min-h-0 ${teamFocusMode ? "hidden" : ""}`}>
          {/* Center tabs + content */}
          {selectedProjectId && (
            <div className="flex gap-0.5 px-2 h-9 items-center border-b border-border/40 bg-muted/20 shrink-0">
              <button
                onClick={() => setCenterTab("dashboard")}
                className={`px-3 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  centerTab === "dashboard"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/30"
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setCenterTab("files"); setFilesVisited(true); }}
                className={`px-3 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  centerTab === "files"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/30"
                }`}
              >
                Files
              </button>
              <button
                onClick={() => { setCenterTab("git"); setGitVisited(true); }}
                className={`px-3 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  centerTab === "git"
                    ? "bg-background text-foreground shadow-sm font-semibold"
                    : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/30"
                }`}
              >
                Git Changes
              </button>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-y-auto relative">
            {selectedProjectId ? (
              <>
                <div className={`absolute inset-0 overflow-y-auto ${centerTab === "dashboard" ? "" : "hidden"}`}>
                  <ProjectDashboard projectId={selectedProjectId} wsData={dashboardData[selectedProjectId]} />
                </div>
                {filesVisited && (
                  <div className={`absolute inset-0 overflow-y-auto ${centerTab === "files" ? "" : "hidden"}`}>
                    <FileManager rootPath={projectCwd || ""} />
                  </div>
                )}
                {gitVisited && (
                  <div className={`absolute inset-0 flex flex-col ${centerTab === "git" ? "" : "hidden"}`}>
                    <GitChangesView rootPath={projectCwd || ""} />
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-2xl bg-muted/20 border border-border/30 flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl text-muted-foreground/15">&#x25A6;</span>
                  </div>
                  <p className="text-sm text-muted-foreground/40">
                    Select a project to get started
                  </p>
                  <p className="text-xs text-muted-foreground/25 mt-1">
                    or create a new one from the sidebar
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Boss Terminal (bottom) */}
          <div className="hidden lg:flex flex-col">
            {terminalOpen ? (
              <div className="border-t border-border/40 bg-[#1a1b26] flex flex-col" style={{ height: `${terminalHeight}px` }}>
                {/* Drag handle — ns-resize */}
                <div
                  className="group h-[5px] shrink-0 cursor-ns-resize flex items-center justify-center hover:bg-primary/20 active:bg-primary/30 transition-colors"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startY = e.clientY;
                    const startH = terminalHeight;
                    const onMove = (ev: MouseEvent) => {
                      const next = Math.max(80, Math.min(600, startH - (ev.clientY - startY)));
                      setTerminalHeight(next);
                      localStorage.setItem("boss-terminal-height", String(next));
                    };
                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                      document.removeEventListener("mouseup", onUp);
                      document.body.style.cursor = "";
                      document.body.style.userSelect = "";
                    };
                    document.body.style.cursor = "ns-resize";
                    document.body.style.userSelect = "none";
                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp);
                  }}
                >
                  <div className="flex gap-[3px] opacity-0 group-hover:opacity-60 transition-opacity">
                    <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                    <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                    <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                    <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                    <span className="w-[3px] h-[3px] rounded-full bg-muted-foreground" />
                  </div>
                </div>
                <div className="px-3 py-1.5 border-b border-border/40 flex items-center justify-between shrink-0 bg-background">
                  <span className="text-[11px] font-semibold text-muted-foreground/50">
                    Terminal
                  </span>
                  <button
                    onClick={() => setTerminalOpen(false)}
                    className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded hover:bg-muted/20"
                  >
                    &#x25BC;
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {selectedProjectId && projectCwd ? (
                    <WebTerminal
                      key={`boss-${selectedProjectId}-${bossTerminalKey}-${projectCwd}`}
                      wsUrl={getTerminalWsUrl(projectCwd)}
                      sessionName={`boss-${selectedProjectId}-${bossTerminalKey}-${btoa(projectCwd || "").slice(0, 8)}`}
                      initialCommand={pendingTerminalCommand}
                      onConnected={() => {
                        if (pendingTerminalCommand) {
                          setPendingTerminalCommand(undefined);
                        }
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-muted-foreground/30">Select a project</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-t border-border/40 bg-background">
                <button
                  onClick={() => setTerminalOpen(true)}
                  className="w-full px-3 py-1.5 flex items-center gap-2 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/10 transition-colors"
                >
                  <span>&#x25B2;</span>
                  <span className="text-[11px] font-semibold text-muted-foreground/50">Terminal</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Agent Panel (right) - resizable */}
        <div className={`hidden lg:flex flex-col ${teamFocusMode ? "flex-1 min-w-0" : ""}`}>
          {agentPanelOpen ? (
            <div className={`bg-background flex flex-col h-full relative ${teamFocusMode ? "flex-1 w-full" : "border-l border-border/40"}`} style={teamFocusMode ? undefined : { width: `${agentPanelWidth}px` }}>
              {/* Resize handle (hidden in focus mode) */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10 ${teamFocusMode ? "hidden" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = agentPanelWidth;
                  const onMove = (ev: MouseEvent) => {
                    const delta = startX - ev.clientX;
                    setAgentPanelWidth(Math.max(250, Math.min(900, startWidth + delta)));
                  };
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />

              {/* Header */}
              <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground/50">
                    {sessionName || "Team"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {tmuxSessionActive && sessionName && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Kill team "${sessionName}"? This will stop all agents.`)) return;
                        try {
                          await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/kill`, { method: "POST" });
                        } catch {}
                        setTmuxSessionActive(false);
                        setTmuxRoles([]);
                        refreshTeamStatus();
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Kill team"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  )}
                  {tmuxSessionActive && sessionName && setupFilePath && (
                    <button
                      onClick={async () => {
                        if (!confirm("Restart team? This will kill all agents and start fresh.")) return;
                        setTeamStarting(true);
                        // 1. Kill tmux session
                        try {
                          await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/kill`, { method: "POST" });
                        } catch {}
                        // 2. Kill boss terminal session so a fresh one starts
                        try {
                          await fetch(`/api/terminal/sessions/boss-${selectedProjectId}`, { method: "DELETE" });
                        } catch {}
                        setTmuxSessionActive(false);
                        setTmuxRoles([]);
                        setTerminalOpen(true);
                        // 3. Force re-mount boss terminal with new key + command
                        setBossTerminalKey((k) => k + 1);
                        setPendingTerminalCommand(`bash "${setupFilePath}"`);
                        const cwdParam = projectCwd ? `&working_dir=${encodeURIComponent(projectCwd)}` : "";
                        const poll = setInterval(async () => {
                          try {
                            const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}?${cwdParam}`);
                            if (res.ok) {
                              const data = await res.json();
                              if (data.tmux_active) {
                                clearInterval(poll);
                                setTeamStarting(false);
                                refreshTeamStatus();
                              }
                            }
                          } catch {}
                        }, 5000);
                        setTimeout(() => { clearInterval(poll); setTeamStarting(false); }, 120000);
                      }}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                      title="Restart team"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    </button>
                  )}
                  <button
                    onClick={() => setTeamFocusMode(!teamFocusMode)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/30 transition-colors"
                    title={teamFocusMode ? "Collapse" : "Expand"}
                  >
                    {teamFocusMode ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    )}
                  </button>
                  {!teamFocusMode && (
                    <button
                      onClick={() => setAgentPanelOpen(false)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/20 transition-colors"
                      title="Hide panel"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
                    </button>
                  )}
                </div>
              </div>

              {selectedProjectId && sessionName && tmuxSessionActive ? (
                /* ── Team running: show tabs + pane view ── */
                <>
                  {/* Horizontal scrollable tabs */}
                  <div className="border-b border-border/40 bg-muted/20 overflow-x-auto shrink-0">
                    <div className="flex gap-0.5 px-1 h-10 items-center w-max">
                      {(tmuxRoles.length > 0 ? tmuxRoles : ROLES).map((role) => (
                        <button
                          key={role}
                          onClick={() => setActiveAgentTab(role)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap ${
                            activeAgentTab === role
                              ? "bg-background text-foreground shadow-sm font-semibold"
                              : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/30"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-300 ${
                            roleActivity[role]
                              ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse"
                              : "bg-gray-500"
                          }`} />
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pane views - all mounted, only active visible */}
                  <div className="flex-1 min-h-0 relative">
                    {(tmuxRoles.length > 0 ? tmuxRoles : ROLES).map((role) => (
                      <div
                        key={`agent-${role}`}
                        className={`absolute inset-0 ${activeAgentTab === role ? "" : "hidden"}`}
                      >
                        <AgentPaneView
                          sessionName={sessionName!}
                          role={role}
                          isVisible={activeAgentTab === role}
                          output={paneOutputs[role] ?? ""}
                          wsStatus={activeAgentTab === role ? tmuxWsStatus : undefined}
                          projectCwd={projectCwd}
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : selectedProjectId && hasSetupFile && !tmuxSessionActive ? (
                /* ── Setup file exists but tmux not running: Start Team ── */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    {teamStarting ? (
                      <>
                        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-xs text-muted-foreground/50">Starting team...</p>
                        <p className="text-[10px] text-muted-foreground/25 mt-1">Check terminal for progress</p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground/40">Team ready to start</p>
                        <p className="text-[10px] text-muted-foreground/25 mt-1 mb-3">
                          {setupFilePath.split("/").pop()}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setTeamStarting(true);
                            setTerminalOpen(true);
                            setPendingTerminalCommand(`bash "${setupFilePath}"`);
                            // Poll until team is up
                            const cwdParam = projectCwd ? `&working_dir=${encodeURIComponent(projectCwd)}` : "";
                            const poll = setInterval(async () => {
                              try {
                                const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName!)}?${cwdParam}`);
                                if (res.ok) {
                                  const data = await res.json();
                                  if (data.tmux_active) {
                                    clearInterval(poll);
                                    setTeamStarting(false);
                                    refreshTeamStatus();
                                  }
                                }
                              } catch {}
                            }, 5000);
                            setTimeout(() => { clearInterval(poll); setTeamStarting(false); }, 120000);
                          }}
                          className="text-xs font-mono"
                        >
                          Start Team
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : selectedProjectId ? (
                /* ── No setup file: Create Team ── */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground/40">No team yet</p>
                    <p className="text-[10px] text-muted-foreground/25 mt-1 mb-3">
                      Generate team files first
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setTerminalOpen(true);
                        const dir = projectCwd || "~";
                        setPendingTerminalCommand(`cd "${dir}" && claude -p "/tmux-team-creator-md scrum-team for project ${project?.name}, session: ${sessionName || project?.name?.toLowerCase().replace(/\\s+/g, '-')}"`);
                      }}
                      className="text-xs font-mono"
                    >
                      Create Team
                    </Button>
                  </div>
                </div>
              ) : (
                /* ── No project selected ── */
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/30">Select a project</p>
                </div>
              )}
            </div>
          ) : (
            <div className="border-l border-border/40 bg-background h-full">
              <button
                onClick={() => setAgentPanelOpen(true)}
                className="h-full px-1.5 flex flex-col items-center justify-start pt-3 gap-2 text-muted-foreground/30 hover:text-muted-foreground/60 hover:bg-muted/10 transition-colors"
              >
                <span className="text-[10px]">&#x25C0;</span>
                <span className="text-[10px] font-semibold text-muted-foreground/50 [writing-mode:vertical-lr]">
                  Team
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: floating Team button - always show when project selected */}
      {selectedProjectId && (
        <button
          onClick={() => setMobileTeamOpen(true)}
          className="fixed bottom-4 right-4 z-50 lg:hidden w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center text-lg"
        >
          👥
        </button>
      )}

      {/* Mobile: Team overlay */}
      {mobileTeamOpen && (
        <div className="fixed inset-0 z-50 lg:hidden bg-background flex flex-col">
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setMobileSidebarOpen(true); }}
                className="flex flex-col gap-[4px] p-1.5 rounded-md hover:bg-muted/30 transition-colors"
                title="Projects"
              >
                <span className="block w-[16px] h-[1.5px] bg-foreground/60 rounded-full" />
                <span className="block w-[12px] h-[1.5px] bg-foreground/40 rounded-full" />
                <span className="block w-[16px] h-[1.5px] bg-foreground/60 rounded-full" />
              </button>
              <span className="text-xs font-semibold text-muted-foreground/50">{sessionName || "Team"}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {tmuxSessionActive && sessionName && (
                <button
                  onClick={async () => {
                    if (!confirm(`Kill team "${sessionName}"? This will stop all agents.`)) return;
                    try {
                      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/kill`, { method: "POST" });
                    } catch {}
                    setTmuxSessionActive(false);
                    setTmuxRoles([]);
                    setMobileTeamOpen(false);
                    refreshTeamStatus();
                  }}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Kill team"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
              {tmuxSessionActive && sessionName && setupFilePath && (
                <button
                  onClick={async () => {
                    if (!confirm("Restart team? This will kill all agents and start fresh.")) return;
                    setTeamStarting(true);
                    setMobileTeamOpen(false);
                    try {
                      await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/kill`, { method: "POST" });
                    } catch {}
                    try {
                      await fetch(`/api/terminal/sessions/boss-${selectedProjectId}`, { method: "DELETE" });
                    } catch {}
                    setTmuxSessionActive(false);
                    setTmuxRoles([]);
                    setTerminalOpen(true);
                    setBossTerminalKey((k) => k + 1);
                    setPendingTerminalCommand(`bash "${setupFilePath}"`);
                    const cwdParam = projectCwd ? `&working_dir=${encodeURIComponent(projectCwd)}` : "";
                    const poll = setInterval(async () => {
                      try {
                        const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}?${cwdParam}`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.tmux_active) {
                            clearInterval(poll);
                            setTeamStarting(false);
                            refreshTeamStatus();
                          }
                        }
                      } catch {}
                    }, 5000);
                    setTimeout(() => { clearInterval(poll); setTeamStarting(false); }, 120000);
                  }}
                  className="w-8 h-8 rounded-md flex items-center justify-center text-amber-400/50 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  title="Restart team"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                </button>
              )}
              <button
                onClick={() => setMobileTeamOpen(false)}
                className="text-xs px-3 py-1.5 rounded-md border border-border/50 text-foreground/70 hover:bg-muted/30"
              >
                ← Close
              </button>
            </div>
          </div>

          {selectedProjectId && sessionName && tmuxSessionActive ? (
            /* ── Team running: show tabs + pane view ── */
            <>
              <div className="border-b border-border/40 bg-muted/20 overflow-x-auto shrink-0">
                <div className="flex gap-0.5 px-1 h-10 items-center w-max">
                  {(tmuxRoles.length > 0 ? tmuxRoles : ROLES).map((role) => (
                    <button
                      key={role}
                      onClick={() => setActiveAgentTab(role)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap ${
                        activeAgentTab === role
                          ? "bg-background text-foreground shadow-sm font-semibold"
                          : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-muted/30"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 transition-all duration-300 ${
                        roleActivity[role]
                          ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse"
                          : "bg-gray-500"
                      }`} />
                      {role}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
                {(tmuxRoles.length > 0 ? tmuxRoles : ROLES).map((role) => (
                  <div
                    key={`mobile-agent-${role}`}
                    className={`absolute inset-0 ${activeAgentTab === role ? "" : "hidden"}`}
                  >
                    <AgentPaneView
                      sessionName={sessionName!}
                      role={role}
                      isVisible={mobileTeamOpen && activeAgentTab === role}
                      output={paneOutputs[role] ?? ""}
                      projectCwd={projectCwd}
                    />
                  </div>
                ))}
              </div>
            </>
          ) : selectedProjectId && hasSetupFile && !tmuxSessionActive ? (
            /* ── Setup file exists but tmux not running: Start Team ── */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                {teamStarting ? (
                  <>
                    <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs text-muted-foreground/50">Starting team...</p>
                    <p className="text-[10px] text-muted-foreground/25 mt-1">Check terminal for progress</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground/40">Team ready to start</p>
                    <p className="text-[10px] text-muted-foreground/25 mt-1 mb-3">
                      {setupFilePath.split("/").pop()}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTeamStarting(true);
                        setMobileTeamOpen(false);
                        setTerminalOpen(true);
                        setPendingTerminalCommand(`bash "${setupFilePath}"`);
                        const cwdParam = projectCwd ? `&working_dir=${encodeURIComponent(projectCwd)}` : "";
                        const poll = setInterval(async () => {
                          try {
                            const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName!)}?${cwdParam}`);
                            if (res.ok) {
                              const data = await res.json();
                              if (data.tmux_active) {
                                clearInterval(poll);
                                setTeamStarting(false);
                                refreshTeamStatus();
                              }
                            }
                          } catch {}
                        }, 5000);
                        setTimeout(() => { clearInterval(poll); setTeamStarting(false); }, 120000);
                      }}
                      className="text-xs font-mono"
                    >
                      Start Team
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : selectedProjectId ? (
            /* ── No setup file: Create Team ── */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-muted-foreground/40">No team yet</p>
                <p className="text-[10px] text-muted-foreground/25 mt-1 mb-3">
                  Generate team files first
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setMobileTeamOpen(false);
                    setTerminalOpen(true);
                    const dir = projectCwd || "~";
                    setPendingTerminalCommand(`cd "${dir}" && claude -p "/tmux-team-creator-md scrum-team for project ${project?.name}, session: ${sessionName || project?.name?.toLowerCase().replace(/\\s+/g, '-')}"`);
                  }}
                  className="text-xs font-mono"
                >
                  Create Team
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-muted-foreground/30">Select a project</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Agent input box ─── */
function AgentInput({ sessionName, role, projectCwd }: { sessionName: string; role: string; projectCwd?: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendText = async (text: string) => {
    await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, text }),
    });
  };

  const handleSend = async () => {
    if (!message.trim() || pending) return;
    setPending(true);
    try { await sendText(message.trim()); } catch {}
    setMessage("");
    setPending(false);
  };

  const sendKey = (key: string) => {
    fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}/send-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, key }),
    }).catch(() => {});
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (message.trim()) { handleSend(); } else { sendKey("Enter"); }
      return;
    }
    if (e.shiftKey && e.key === "Tab") { e.preventDefault(); sendKey("BackTab"); return; }
    if (e.ctrlKey && e.key === "c") { e.preventDefault(); sendKey("C-c"); return; }
  };

  const handleUpload = async (file: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const uploadDir = projectCwd || "/tmp/ai-teams-uploads";
      const form = new FormData();
      form.append("files", file);
      form.append("relativePaths", file.name);
      const res = await fetch(
        `/api/files/upload?dir=${encodeURIComponent(uploadDir)}&root=${encodeURIComponent(uploadDir)}`,
        { method: "POST", body: form }
      );
      if (res.ok) {
        const savedPath = `${uploadDir}/${file.name}`;
        await sendText(`[IMAGE] ${savedPath}`);
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex gap-1.5 items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="text-[11px] px-1.5 py-1 rounded text-muted-foreground/40 hover:text-foreground/60 hover:bg-muted/20 border border-border/30 transition-colors disabled:opacity-30"
        title="Upload image"
      >
        {uploading ? "⏳" : "📷"}
      </button>
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={pending ? "Sending..." : `Message ${role}...`}
        disabled={pending}
        className="flex-1 text-[11px] px-2 py-1 rounded bg-muted/30 border border-border/40 text-foreground/80 placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/40 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || pending}
        className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary/70 hover:bg-primary/30 transition-colors font-mono disabled:opacity-30"
      >
        Send
      </button>
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <span className="font-mono text-sm text-muted-foreground/50 animate-pulse">
            Loading...
          </span>
        </div>
      }
    >
      <ProjectPageContent />
    </Suspense>
  );
}
