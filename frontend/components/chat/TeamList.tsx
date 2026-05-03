"use client";

import type { Project } from "@/lib/types";

interface TeamListProps {
  projects: Project[];
  activeId: number | null;
  onSelect: (id: number) => void;
  lastEvents?: Record<number, string>; // projectId → last event preview text
}

function avatarLetter(name: string): string {
  return name.charAt(0).toUpperCase();
}

function avatarColor(id: number): string {
  const colors = [
    "bg-blue-600", "bg-purple-600", "bg-emerald-600",
    "bg-orange-600", "bg-pink-600", "bg-teal-600",
  ];
  return colors[id % colors.length];
}

export function TeamList({ projects, activeId, onSelect, lastEvents = {} }: TeamListProps) {
  if (projects.length === 0) {
    return (
      <div className="p-4 text-xs text-zinc-500">
        No teams yet. Create a project first.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 p-2">
      {projects.map((p) => {
        const active = p.id === activeId;
        const preview = lastEvents[p.id] ?? "";
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors w-full
              ${active
                ? "bg-zinc-700 text-white"
                : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
          >
            <div className={`flex-shrink-0 w-9 h-9 rounded-full ${avatarColor(p.id)} flex items-center justify-center text-white font-semibold text-sm`}>
              {avatarLetter(p.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{p.name}</div>
              {preview && (
                <div className="text-xs text-zinc-400 truncate mt-0.5">{preview}</div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
