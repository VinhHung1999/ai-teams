"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";
import { api } from "@/lib/api";

export type DrawerTab = "kanban" | "files";

interface DrawerProps {
  open: boolean;
  tab: DrawerTab;
  project: Project | null;
  onClose: () => void;
  onTabChange: (tab: DrawerTab) => void;
}

// ── Kanban tab ──

function KanbanTab({ project }: { project: Project | null }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project) return;
    setLoading(true);
    api.getDashboard(project.id)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [project?.id]);

  if (!project) return <div className="p-4 text-sm text-zinc-500">Select a team to view its board.</div>;
  if (loading) return <div className="p-4 text-sm text-zinc-400">Loading board…</div>;
  if (error) return <div className="p-4 text-sm text-red-400">{error}</div>;
  if (!data) return null;

  const activeSprint = data.sprints.find((s: any) => s.status === "active");
  if (!activeSprint) {
    return <div className="p-4 text-sm text-zinc-500">No active sprint.</div>;
  }

  const board = data.boards?.[String(activeSprint.id)] ?? {};
  const columns = [
    { key: "todo", label: "Todo" },
    { key: "in_progress", label: "In Progress" },
    { key: "in_review", label: "In Review" },
    { key: "testing", label: "Testing" },
    { key: "done", label: "Done" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-zinc-200">Sprint {activeSprint.number}</p>
          {activeSprint.goal && <p className="text-xs text-zinc-400 truncate">{activeSprint.goal}</p>}
        </div>
        <Link
          href={`/project?id=${project.id}`}
          className="text-xs text-blue-400 hover:underline flex-shrink-0 ml-2"
        >
          Open full →
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        {columns.map(({ key, label }) => {
          const items: any[] = board[key] ?? [];
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
                <span className="text-[10px] bg-zinc-700 text-zinc-300 rounded-full px-1.5">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {items.map((item: any) => (
                  <div key={item.id} className="bg-zinc-800 rounded-md px-3 py-2 text-xs">
                    <p className="text-zinc-200 leading-snug">{item.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-zinc-500">
                      {item.priority && <span>{item.priority}</span>}
                      {item.assignee_role && <span>{item.assignee_role}</span>}
                      {item.story_points && <span>{item.story_points}pt</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Files tab ──

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

function FileTree({ nodes, onSelect }: { nodes: FileNode[]; onSelect: (path: string) => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <li key={node.path}>
          {node.type === "directory" ? (
            <FolderNode node={node} onSelect={onSelect} />
          ) : (
            <button
              onClick={() => onSelect(node.path)}
              className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-zinc-700 text-xs text-zinc-300"
            >
              <span className="text-zinc-500">📄</span>
              <span className="truncate">{node.name}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FolderNode({ node, onSelect }: { node: FileNode; onSelect: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-zinc-700 text-xs text-zinc-400"
      >
        <span>{open ? "📂" : "📁"}</span>
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children && (
        <div className="ml-4">
          <FileTree nodes={node.children} onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function FilesTab({ project }: { project: Project | null }) {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!project?.working_directory) return;
    const docsPath = `${project.working_directory}/docs`;
    fetch(`/api/files/tree?path=${encodeURIComponent(docsPath)}`)
      .then((r) => r.json())
      .then((data) => setTree(data.tree ?? data ?? []))
      .catch(() => setTree([]));
  }, [project?.working_directory]);

  const openFile = async (path: string) => {
    setSelectedFile(path);
    setLoading(true);
    setFileContent("");
    try {
      const r = await fetch(`/api/files/read?path=${encodeURIComponent(path)}`);
      const d = await r.json();
      setFileContent(d.content ?? "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!project) return <div className="p-4 text-sm text-zinc-500">Select a team to view files.</div>;

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 border-r border-zinc-800 overflow-y-auto p-2 flex-shrink-0">
        {tree.length === 0
          ? <p className="text-xs text-zinc-500 p-2">No docs/ folder found.</p>
          : <FileTree nodes={tree} onSelect={openFile} />
        }
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {!selectedFile && <p className="text-xs text-zinc-500">Select a file to preview.</p>}
        {loading && <p className="text-xs text-zinc-400">Loading…</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {selectedFile && !loading && fileContent && (
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
            {fileContent}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Drawer wrapper ──

export function Drawer({ open, tab, project, onClose, onTabChange }: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl
          w-full md:w-1/2 transition-transform duration-200 ease-out
          ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Drawer header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex-shrink-0"
            title="Close"
          >
            ✕
          </button>
          <div className="flex gap-1 ml-1">
            {(["kanban", "files"] as DrawerTab[]).map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors capitalize
                  ${tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
              >
                {t === "kanban" ? "📋 Kanban" : "📁 Files"}
              </button>
            ))}
          </div>
        </div>

        {/* Drawer content */}
        <div className="flex-1 overflow-hidden">
          {tab === "kanban" && <KanbanTab project={project} />}
          {tab === "files" && <FilesTab project={project} />}
        </div>
      </div>
    </>
  );
}
