"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectDashboard } from "@/components/ProjectDashboard";
import { WebTerminal } from "@/components/WebTerminal";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";

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
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [activeAgentTab, setActiveAgentTab] = useState<string>(ROLES[0]);
  const [pendingTerminalCommand, setPendingTerminalCommand] = useState<string | undefined>();
  const [hasSetupFile, setHasSetupFile] = useState(false);
  const [setupFilePath, setSetupFilePath] = useState("");
  const [tmuxSessionActive, setTmuxSessionActive] = useState(false);
  const [tmuxRoles, setTmuxRoles] = useState<string[]>([]);
  const sessionName = project?.tmux_session_name || undefined;
  const projectCwd = project?.working_directory || undefined;

  // Fetch project details when selection changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProject(null);
      setHasSetupFile(false);
      setTmuxSessionActive(false);
      setTmuxRoles([]);
      return;
    }
    api.getProject(selectedProjectId)
      .then(setProject)
      .catch(() => setProject(null));
  }, [selectedProjectId]);

  // Check team status: files exist? tmux running?
  const checkTeamStatus = useCallback(async () => {
    if (!sessionName) {
      setHasSetupFile(false);
      setTmuxSessionActive(false);
      setTmuxRoles([]);
      return;
    }
    try {
      const cwdParam = projectCwd ? `&working_dir=${encodeURIComponent(projectCwd)}` : "";
      const res = await fetch(`/api/tmux/session/${encodeURIComponent(sessionName)}?${cwdParam}`);
      if (res.ok) {
        const data = await res.json();
        setHasSetupFile(data.has_setup_file);
        setSetupFilePath(data.setup_file_path || "");
        setTmuxSessionActive(data.tmux_active);
        setTmuxRoles(data.roles || []);
      }
    } catch {
      setHasSetupFile(false);
      setTmuxSessionActive(false);
      setTmuxRoles([]);
    }
  }, [sessionName, projectCwd]);

  useEffect(() => { checkTeamStatus(); }, [checkTeamStatus]);

  // Sync URL when project changes
  useEffect(() => {
    if (selectedProjectId !== null) {
      const currentId = searchParams.get("id");
      if (currentId !== String(selectedProjectId)) {
        router.replace(`/project?id=${selectedProjectId}`, { scroll: false });
      }
    }
  }, [selectedProjectId, router, searchParams]);

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

  const getAgentWsUrl = getTerminalWsUrl;

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Sidebar */}
      <AppSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={handleSelectProject}
        onTeamCommand={(projectId, command) => {
          setTerminalOpen(true);
          // Small delay to let terminal connect first
          setTimeout(() => setPendingTerminalCommand(command), 1000);
        }}
      />

      {/* Main area (dashboard + terminal) + Agent panel */}
      <div className="flex-1 flex flex-row min-w-0 min-h-0">
        {/* Center: Dashboard + Terminal */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Dashboard */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {selectedProjectId ? (
              <ProjectDashboard projectId={selectedProjectId} />
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
              <div className="h-[200px] border-t border-border/40 bg-[#1a1b26] flex flex-col">
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
                  {selectedProjectId ? (
                    <WebTerminal
                      key={`boss-${selectedProjectId}`}
                      wsUrl={getTerminalWsUrl(projectCwd)}
                      sessionName={`boss-${selectedProjectId}`}
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

        {/* Agent Panel (right) */}
        <div className="hidden lg:flex flex-col">
          {agentPanelOpen ? (
            <div className="w-[320px] border-l border-border/40 bg-background flex flex-col h-full">
              {/* Header */}
              <div className="px-3 py-1.5 border-b border-border/40 flex items-center justify-between shrink-0">
                <span className="text-[11px] font-semibold text-muted-foreground/50">
                  Team
                </span>
                <button
                  onClick={() => setAgentPanelOpen(false)}
                  className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors px-1.5 py-0.5 rounded hover:bg-muted/20"
                >
                  &#x25B6;
                </button>
              </div>

              {selectedProjectId && sessionName && tmuxSessionActive ? (
                /* ── Team running: show tabs + terminals ── */
                <>
                  <div className="flex flex-wrap gap-0 border-b border-border/40 shrink-0">
                    {(tmuxRoles.length > 0 ? tmuxRoles : ROLES).map((role) => (
                      <button
                        key={role}
                        onClick={() => setActiveAgentTab(role)}
                        className={`px-3 py-1.5 text-[11px] font-mono transition-colors ${
                          activeAgentTab === role
                            ? "text-foreground/90 bg-[#1a1b26] border-b-2 border-primary"
                            : "text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/10"
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 min-h-0 bg-[#1a1b26]">
                    <WebTerminal
                      key={`agent-${selectedProjectId}-${activeAgentTab}`}
                      wsUrl={getAgentWsUrl(projectCwd)}
                      sessionName={`agent-${selectedProjectId}-${activeAgentTab}`}
                      initialCommand={`tmux select-pane -t ${sessionName}:0.$(tmux list-panes -t ${sessionName} -F '#{pane_index} #{@role_name}' | grep ' ${activeAgentTab}$' | cut -d' ' -f1) 2>/dev/null && tmux attach-session -t ${sessionName} 2>/dev/null || echo "Session '${sessionName}' not running"`}
                    />
                  </div>

                  <div className="px-2 py-1.5 border-t border-border/40 bg-background shrink-0">
                    <AgentInput sessionName={sessionName} role={activeAgentTab} />
                  </div>
                </>
              ) : selectedProjectId && hasSetupFile && !tmuxSessionActive ? (
                /* ── Setup file exists but tmux not running: Start Team ── */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground/40">Team ready to start</p>
                    <p className="text-[10px] text-muted-foreground/25 mt-1 mb-3">
                      {setupFilePath.split("/").pop()}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTerminalOpen(true);
                        setPendingTerminalCommand(`bash "${setupFilePath}"`);
                        setTimeout(checkTeamStatus, 20000);
                      }}
                      className="text-xs font-mono"
                    >
                      Start Team
                    </Button>
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
                        setPendingTerminalCommand(`cd "${dir}" && claude -p "/tmux-team-creator-mcp scrum-team for project ${project?.name}, session: ${sessionName || project?.name?.toLowerCase().replace(/\\s+/g, '-')}"`);
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
    </div>
  );
}

/* ─── Agent input box ─── */
function AgentInput({ sessionName, role }: { sessionName: string; role: string }) {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    // Use tm-send to send message to the agent's pane
    const cmd = `tm-send ${role} "BOSS: ${message.trim()}"`;
    // TODO: send via terminal WebSocket or API
    console.log("Send to agent:", cmd);
    setMessage("");
  };

  return (
    <div className="flex gap-1.5">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder={`Message ${role}...`}
        className="flex-1 text-[11px] px-2 py-1 rounded bg-muted/30 border border-border/40 text-foreground/80 placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/40"
      />
      <button
        onClick={handleSend}
        className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary/70 hover:bg-primary/30 transition-colors font-mono"
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
