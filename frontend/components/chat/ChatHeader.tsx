"use client";

import Link from "next/link";
import type { Project } from "@/lib/types";

interface ChatHeaderProps {
  project: Project | null;
  onOpenKanban: () => void;
  onOpenFiles: () => void;
}

export function ChatHeader({ project, onOpenKanban, onOpenFiles }: ChatHeaderProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <h1 className="font-semibold text-sm text-white truncate">
          {project ? project.name : "Select a team"}
        </h1>
        {project?.tmux_session_name && (
          <p className="text-xs text-zinc-400 truncate">
            session: {project.tmux_session_name}
          </p>
        )}
      </div>

      {project && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onOpenKanban}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Open Kanban board"
          >
            <span>📋</span>
            <span className="hidden sm:inline">Kanban</span>
          </button>
          <button
            onClick={onOpenFiles}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Open Files"
          >
            <span>📁</span>
            <span className="hidden sm:inline">Files</span>
          </button>
        </div>
      )}

      <Link
        href="/project"
        className="flex-shrink-0 px-2.5 py-1.5 rounded-md text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
      >
        Dashboard →
      </Link>
    </div>
  );
}
