"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { AgentPaneView } from "@/components/AgentPaneView";
import { useTmuxWs } from "@/lib/useTmuxWs";

export default function AssistantPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ensure the assistant tmux session exists with @role_name=assistant
  useEffect(() => {
    fetch("/api/assistant/ensure-session", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setReady(true);
        else setError(d.error ?? "Failed to create session");
      })
      .catch(() => setError("Backend unavailable"));
  }, []);

  const { outputs, wsStatus } = useTmuxWs(
    ready ? "assistant" : undefined,
    "assistant",
  );

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden">
      {/* Chat — PRIMARY, left, fills remaining space */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header bar */}
        <div className="h-9 flex items-center gap-3 px-4 border-b border-border/40 shrink-0 bg-muted/10">
          <span className="text-[11px] font-semibold font-mono text-foreground/70">
            Assistant
          </span>
          <span className="text-[10px] font-mono text-muted-foreground/40">
            tmux:assistant
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {wsStatus === "connected" && (
              <>
                <div className="w-[5px] h-[5px] rounded-full bg-[#10b981] status-pulse" />
                <span className="text-[10px] font-mono text-muted-foreground/30">live</span>
              </>
            )}
            {wsStatus === "connecting" && (
              <span className="text-[10px] font-mono text-yellow-500/60 animate-pulse">connecting…</span>
            )}
            {wsStatus === "disconnected" && !error && (
              <span className="text-[10px] font-mono text-muted-foreground/30">disconnected</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 relative">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-[12px] font-mono text-red-400/70">{error}</p>
            </div>
          ) : (
            <AgentPaneView
              sessionName="assistant"
              role="assistant"
              isVisible={true}
              output={outputs["assistant"] ?? ""}
              wsStatus={wsStatus}
            />
          )}
        </div>
      </div>

      {/* Sidebar — SECONDARY, right, fixed width (~220px expanded / 48px collapsed) */}
      <div className="border-l border-[#1f1f1f]">
        <AppSidebar
          selectedProjectId={null}
          onSelectProject={(id) => router.push(`/project?id=${id}`)}
        />
      </div>
    </div>
  );
}
