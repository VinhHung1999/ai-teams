"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { api } from "@/lib/api";
import type { Project } from "@/lib/types";

const AVATAR_PALETTE = [
  "var(--c-role-PO)",
  "var(--c-role-TL)",
  "var(--c-role-BE)",
  "var(--c-role-FE)",
  "var(--c-role-QA)",
  "var(--c-role-SM)",
  "var(--c-role-DEV)",
];

function avatarColorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 86400 * 7) return `${Math.floor(diffSec / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function ProjectListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Backwards compat: /project?id=X → /project/X
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam) router.replace(`/project/${idParam}`);
  }, [searchParams, router]);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <div
      className="flex flex-col h-[100dvh] w-full"
      style={{
        background: "var(--c-bg-app)",
        color: "var(--c-fg-0)",
        fontFamily: "var(--c-font-stack)",
      }}
    >
      <header
        className="glass-header sticky top-0 z-20 flex items-center px-3 border-b"
        style={{
          borderColor: "var(--c-line)",
          minHeight: "var(--c-tap-min)",
          gap: "var(--c-space-2)",
        }}
      >
        <button
          type="button"
          title="Menu (coming soon)"
          aria-label="Menu (coming soon)"
          disabled
          className="inline-flex items-center justify-center rounded-full disabled:opacity-50"
          style={{ width: "var(--c-tap-min)", height: "var(--c-tap-min)", color: "var(--c-fg-1)" }}
        >
          ☰
        </button>
        <h1
          className="flex-1 text-center font-semibold"
          style={{ fontSize: "17px", color: "var(--c-fg-0)" }}
        >
          AI Teams
        </h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          aria-label="New project"
          className="inline-flex items-center justify-center rounded-full hover:bg-[var(--c-bg-hover)]"
          style={{
            width: "var(--c-tap-min)",
            height: "var(--c-tap-min)",
            color: "var(--c-accent)",
            fontSize: "24px",
          }}
        >
          +
        </button>
      </header>

      <main
        className="flex-1 min-h-0 overflow-y-auto"
        style={{ background: "var(--c-bg-list)" }}
      >
        <div className="mx-auto" style={{ maxWidth: "480px" }}>
          {projects === null && (
            <div
              className="flex items-center justify-center"
              style={{ padding: "var(--c-space-4)", color: "var(--c-fg-2)" }}
            >
              Loading…
            </div>
          )}
          {projects !== null && projects.length === 0 && (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ padding: "var(--c-space-5)", color: "var(--c-fg-2)" }}
            >
              <p style={{ marginBottom: "var(--c-space-3)" }}>No projects yet</p>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                style={{ color: "var(--c-accent)", fontSize: "var(--c-font-size-base)" }}
              >
                Create your first project
              </button>
            </div>
          )}
          {projects !== null && projects.length > 0 && (
            <ul role="list" className="divide-y" style={{ borderColor: "var(--c-line)" }}>
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/project/${p.id}`)}
                    className="w-full flex items-center text-left transition-colors hover:bg-[var(--c-bg-hover)] active:bg-[var(--c-bg-active)]"
                    style={{
                      minHeight: "var(--c-tap-min)",
                      padding: "var(--c-space-2) var(--c-space-3)",
                      gap: "var(--c-space-3)",
                    }}
                  >
                    <div
                      className="shrink-0 inline-flex items-center justify-center font-semibold text-white"
                      style={{
                        width: "var(--c-avatar-md)",
                        height: "var(--c-avatar-md)",
                        borderRadius: "var(--c-radius-avatar)",
                        background: avatarColorFor(p.name),
                        fontSize: "18px",
                      }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate"
                        style={{
                          fontSize: "var(--c-font-size-base)",
                          color: "var(--c-fg-0)",
                          lineHeight: 1.3,
                        }}
                      >
                        {p.name}
                      </div>
                      <div
                        className="truncate"
                        style={{
                          fontSize: "var(--c-font-size-sm)",
                          color: "var(--c-fg-1)",
                          marginTop: "2px",
                        }}
                      >
                        {p.roles && p.roles.length > 0
                          ? p.roles.join(" · ")
                          : "No team configured"}
                      </div>
                    </div>
                    <div
                      className="shrink-0"
                      style={{ fontSize: "var(--c-font-size-xs)", color: "var(--c-fg-2)" }}
                    >
                      {relativeTime(p.created_at)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(projectId) => router.push(`/project/${projectId}`)}
      />
    </div>
  );
}

export default function ProjectListPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center h-[100dvh]"
          style={{ background: "var(--c-bg-app)", color: "var(--c-fg-2)" }}
        >
          Loading…
        </div>
      }
    >
      <ProjectListContent />
    </Suspense>
  );
}
