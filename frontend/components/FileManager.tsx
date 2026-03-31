"use client";

import {
  useState, useEffect, useCallback, useRef, DragEvent,
} from "react";
import { codeToHtml } from "shiki";
import {
  File, FileCode, FileJson, FileText, FileType,
  Image, Settings, Database, FileArchive, Lock,
  Folder, FolderOpen, Upload, Download,
  Trash2, Pencil, FolderPlus, FilePlus, Save, Eye,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  type: "dir" | "file";
  path: string;
  size?: number;
}

interface TreeNode extends FileEntry {
  children?: TreeNode[];
  loaded?: boolean;
  expanded?: boolean;
}

interface FileContent {
  path: string;
  content: string;
  language: string;
  size: number;
}

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
]);

export interface FileManagerProps {
  rootPath: string;
  /** If true, don't show the toolbar (read-only mode) */
  readOnly?: boolean;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

// All API calls pass `root` so the backend can enforce path-traversal protection.

async function fetchTree(dirPath: string, root: string): Promise<FileEntry[]> {
  const res = await fetch(
    `/api/files/tree?path=${encodeURIComponent(dirPath)}&root=${encodeURIComponent(root)}&show_hidden=true`
  );
  if (!res.ok) throw new Error("Failed to load directory");
  const data = await res.json();
  return data.entries;
}

async function fetchFile(filePath: string, root: string): Promise<FileContent> {
  const res = await fetch(
    `/api/files/read?path=${encodeURIComponent(filePath)}&root=${encodeURIComponent(root)}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to read file" }));
    throw new Error(err.error || "Failed to read file");
  }
  return res.json();
}

async function apiDelete(targetPath: string, root: string): Promise<void> {
  const res = await fetch(
    `/api/files?path=${encodeURIComponent(targetPath)}&root=${encodeURIComponent(root)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error || "Delete failed");
  }
}

async function apiRename(targetPath: string, newName: string, root: string): Promise<string> {
  const res = await fetch("/api/files/rename", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: targetPath, newName, root }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Rename failed" }));
    throw new Error(err.error || "Rename failed");
  }
  const data = await res.json();
  return data.path;
}

async function apiCreate(targetPath: string, type: "file" | "dir", root: string): Promise<void> {
  const res = await fetch("/api/files/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: targetPath, type, root }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Create failed" }));
    throw new Error(err.error || "Create failed");
  }
}

async function apiSave(filePath: string, content: string, root: string): Promise<void> {
  const res = await fetch("/api/files/save", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content, root }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Save failed" }));
    throw new Error(err.error || "Save failed");
  }
}

async function apiUpload(dir: string, root: string, files: File[]): Promise<void> {
  const form = new FormData();
  for (const f of files) {
    form.append("files", f);
    // Send relative path so backend can recreate folder structure
    form.append("relativePaths", (f as any).webkitRelativePath || f.name);
  }
  const res = await fetch(
    `/api/files/upload?dir=${encodeURIComponent(dir)}&root=${encodeURIComponent(root)}`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

// ─── File Icon ────────────────────────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const lowerName = name.toLowerCase();

  let Icon = File;
  let colorClass = "text-[#555555]";

  if (["ts", "tsx"].includes(ext)) { Icon = FileCode; colorClass = "text-blue-500"; }
  else if (["js", "jsx", "mjs", "cjs"].includes(ext)) { Icon = FileCode; colorClass = "text-yellow-500"; }
  else if (["py", "pyw"].includes(ext)) { Icon = FileCode; colorClass = "text-green-500"; }
  else if (["md", "mdx"].includes(ext)) { Icon = FileText; colorClass = "text-purple-500"; }
  else if (["json", "yaml", "yml", "toml"].includes(ext)) { Icon = FileJson; colorClass = "text-orange-500"; }
  else if (["html", "htm"].includes(ext)) { Icon = FileCode; colorClass = "text-orange-600"; }
  else if (["css", "scss", "sass", "less"].includes(ext)) { Icon = FileCode; colorClass = "text-pink-500"; }
  else if (["sh", "bash", "zsh"].includes(ext)) { Icon = FileCode; colorClass = "text-green-600"; }
  else if (ext === "go") { Icon = FileCode; colorClass = "text-cyan-500"; }
  else if (ext === "rs") { Icon = FileCode; colorClass = "text-orange-700"; }
  else if (ext === "rb") { Icon = FileCode; colorClass = "text-red-600"; }
  else if (ext === "sql" || ext === "prisma") { Icon = Database; colorClass = "text-blue-400"; }
  else if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"].includes(ext)) { Icon = Image; colorClass = "text-purple-400"; }
  else if (["zip", "tar", "gz", "rar"].includes(ext)) { Icon = FileArchive; colorClass = "text-amber-400"; }
  else if (["exe", "dll", "so", "bin"].includes(ext)) { Icon = Lock; colorClass = "text-red-400"; }
  else if (["woff", "woff2", "ttf", "otf"].includes(ext)) { Icon = FileType; colorClass = "text-[#555555]"; }
  else if (lowerName.includes("config") || lowerName.includes(".env") || ext === "lock" || lowerName.startsWith(".")) {
    Icon = Settings; colorClass = "text-[#555555]";
  }

  return <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />;
}

// ─── Inline rename input ──────────────────────────────────────────────────────

function RenameInput({
  initial,
  onConfirm,
  onCancel,
}: {
  initial: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onConfirm(value.trim());
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onBlur={() => onCancel()}
      className="flex-1 min-w-0 bg-[#0d1f17] border border-[#10b981]/50 text-[11px] text-[#e0e0e0] font-mono px-1 rounded outline-none"
      autoFocus
    />
  );
}

// ─── Tree Item ────────────────────────────────────────────────────────────────

function TreeItem({
  node,
  depth,
  selectedPath,
  renamingPath,
  onToggleDir,
  onSelectFile,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDelete,
  onDownload,
  onNewFile,
  onNewFolder,
  onUpload,
  onUploadFolder,
  readOnly,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  renamingPath: string | null;
  onToggleDir: (node: TreeNode) => void;
  onSelectFile: (path: string) => void;
  onStartRename: (path: string) => void;
  onConfirmRename: (oldPath: string, newName: string) => void;
  onCancelRename: () => void;
  onDelete: (path: string, type: "dir" | "file") => void;
  onDownload: (path: string, name: string) => void;
  onNewFile: (dirPath: string) => void;
  onNewFolder: (dirPath: string) => void;
  onUpload: (dirPath: string) => void;
  onUploadFolder: (dirPath: string) => void;
  readOnly?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const isRenaming = renamingPath === node.path;
  const paddingLeft = 8 + depth * 16;

  const actions = !readOnly && showActions;

  if (node.type === "dir") {
    return (
      <div>
        <div
          className="w-full flex items-center gap-1.5 py-[3px] pr-1 hover:bg-[#0a0a0a] transition-colors group"
          style={{ paddingLeft }}
          onMouseEnter={() => setShowActions(true)}
          onMouseLeave={() => setShowActions(false)}
        >
          <button
            onClick={() => onToggleDir(node)}
            className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
          >
            <span className="text-[10px] text-[#555555] w-3 text-center shrink-0">
              {node.expanded ? "▾" : "▸"}
            </span>
            {node.expanded
              ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
              : <Folder className="h-3.5 w-3.5 shrink-0 text-[#10b981]" />
            }
            {isRenaming ? (
              <RenameInput
                initial={node.name}
                onConfirm={(name) => onConfirmRename(node.path, name)}
                onCancel={onCancelRename}
              />
            ) : (
              <span className="text-[11px] text-[#10b981] truncate">{node.name}</span>
            )}
          </button>
          {actions && !isRenaming && (
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                title="New file"
                onClick={(e) => { e.stopPropagation(); onNewFile(node.path); }}
                className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
              >
                <FilePlus className="h-3 w-3" />
              </button>
              <button
                title="New folder"
                onClick={(e) => { e.stopPropagation(); onNewFolder(node.path); }}
                className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
              >
                <FolderPlus className="h-3 w-3" />
              </button>
              <button
                title="Upload files here"
                onClick={(e) => { e.stopPropagation(); onUpload(node.path); }}
                className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
              >
                <Upload className="h-3 w-3" />
              </button>
              <button
                title="Upload folder here"
                onClick={(e) => { e.stopPropagation(); onUploadFolder(node.path); }}
                className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
              >
                <FolderPlus className="h-3 w-3" />
              </button>
              <button
                title="Rename"
                onClick={(e) => { e.stopPropagation(); onStartRename(node.path); }}
                className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                title="Delete"
                onClick={(e) => { e.stopPropagation(); onDelete(node.path, "dir"); }}
                className="p-0.5 hover:text-red-400 text-[#555555] transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
        {node.expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                renamingPath={renamingPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
                onStartRename={onStartRename}
                onConfirmRename={onConfirmRename}
                onCancelRename={onCancelRename}
                onDelete={onDelete}
                onDownload={onDownload}
                onNewFile={onNewFile}
                onNewFolder={onNewFolder}
                onUpload={onUpload}
                onUploadFolder={onUploadFolder}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const isSelected = node.path === selectedPath;
  return (
    <div
      className={`flex items-center gap-1.5 py-[3px] pr-1 transition-colors ${
        isSelected ? "bg-[#161616] text-[#e0e0e0]" : "hover:bg-[#0a0a0a]/50 text-[#888888]"
      }`}
      style={{ paddingLeft: paddingLeft + 14 }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={() => onSelectFile(node.path)}
        className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
      >
        <FileIcon name={node.name} />
        {isRenaming ? (
          <RenameInput
            initial={node.name}
            onConfirm={(name) => onConfirmRename(node.path, name)}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="text-[11px] truncate">{node.name}</span>
        )}
        {node.size !== undefined && !isRenaming && (
          <span className="text-[9px] text-[#555555] ml-auto shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </button>
      {actions && !isRenaming && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            title="Download"
            onClick={(e) => { e.stopPropagation(); onDownload(node.path, node.name); }}
            className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
          >
            <Download className="h-3 w-3" />
          </button>
          <button
            title="Rename"
            onClick={(e) => { e.stopPropagation(); onStartRename(node.path); }}
            className="p-0.5 hover:text-[#10b981] text-[#555555] transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            title="Delete"
            onClick={(e) => { e.stopPropagation(); onDelete(node.path, "file"); }}
            className="p-0.5 hover:text-red-400 text-[#555555] transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-5 w-80 shadow-2xl">
        <p className="text-[12px] text-[#e0e0e0] mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[11px] rounded border border-[#333333] text-[#888888] hover:text-[#e0e0e0] hover:border-[#555555] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1 text-[11px] rounded bg-red-600/80 text-white hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Item Dialog ──────────────────────────────────────────────────────────

function NewItemDialog({
  type,
  dirPath,
  onConfirm,
  onCancel,
}: {
  type: "file" | "dir";
  dirPath: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-5 w-80 shadow-2xl">
        <p className="text-[11px] text-[#555555] mb-1">
          New {type === "file" ? "file" : "folder"} in:
        </p>
        <p className="text-[10px] text-[#10b981] font-mono mb-3 truncate">{dirPath}</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
            if (e.key === "Escape") onCancel();
          }}
          placeholder={type === "file" ? "filename.ts" : "folder-name"}
          className="w-full bg-[#111] border border-[#333] text-[12px] text-[#e0e0e0] font-mono px-2 py-1.5 rounded outline-none focus:border-[#10b981]/50 mb-3"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-[11px] rounded border border-[#333333] text-[#888888] hover:text-[#e0e0e0] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onConfirm(name.trim())}
            disabled={!name.trim()}
            className="px-3 py-1 text-[11px] rounded bg-[#10b981]/80 text-white hover:bg-[#10b981] transition-colors disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main FileManager Component ───────────────────────────────────────────────

export function FileManager({ rootPath, readOnly = false }: FileManagerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeVisible, setTreeVisible] = useState(true);

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // CRUD state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ path: string; type: "dir" | "file"; name: string } | null>(null);
  const [newItemDialog, setNewItemDialog] = useState<{ type: "file" | "dir"; dirPath: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadDir, setUploadDir] = useState<string>("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Load root tree on mount / rootPath change
  useEffect(() => {
    if (!rootPath) return;
    setTreeLoading(true);
    setUploadDir(rootPath);
    fetchTree(rootPath, rootPath)
      .then((entries) =>
        setTree(
          entries.map((e) => ({
            ...e,
            children: e.type === "dir" ? [] : undefined,
            loaded: false,
            expanded: false,
          }))
        )
      )
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [rootPath]);

  // Deep-update a node in the tree by path
  const updateNode = useCallback(
    (nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] =>
      nodes.map((node) => {
        if (node.path === targetPath) return updater(node);
        if (node.children && targetPath.startsWith(node.path + "/")) {
          return { ...node, children: updateNode(node.children, targetPath, updater) };
        }
        return node;
      }),
    []
  );

  // Refresh a directory node's children
  const refreshDir = useCallback(
    async (dirPath: string) => {
      try {
        const entries = await fetchTree(dirPath, rootPath);
        const children: TreeNode[] = entries.map((e) => ({
          ...e,
          children: e.type === "dir" ? [] : undefined,
          loaded: false,
          expanded: false,
        }));
        if (dirPath === rootPath) {
          setTree(children);
        } else {
          setTree((prev) =>
            updateNode(prev, dirPath, (n) => ({ ...n, loaded: true, children }))
          );
        }
      } catch {
        // silently fail
      }
    },
    [rootPath, updateNode]
  );

  const handleToggleDir = useCallback(
    async (node: TreeNode) => {
      if (node.expanded) {
        setTree((prev) => updateNode(prev, node.path, (n) => ({ ...n, expanded: false })));
        return;
      }
      if (!node.loaded) {
        try {
          const entries = await fetchTree(node.path, rootPath);
          const children: TreeNode[] = entries.map((e) => ({
            ...e,
            children: e.type === "dir" ? [] : undefined,
            loaded: false,
            expanded: false,
          }));
          setTree((prev) =>
            updateNode(prev, node.path, (n) => ({ ...n, expanded: true, loaded: true, children }))
          );
        } catch {
          // silently fail
        }
      } else {
        setTree((prev) => updateNode(prev, node.path, (n) => ({ ...n, expanded: true })));
      }
    },
    [updateNode]
  );

  const handleSelectFile = useCallback(async (filePath: string) => {
    setSelectedPath(filePath);
    setEditMode(false);
    setEditContent("");

    // Check if image
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    if (IMAGE_EXTENSIONS.has(ext)) {
      setSelectedImagePath(filePath);
      setSelectedFile(null);
      setError(null);
      return;
    }

    setSelectedImagePath(null);
    setLoading(true);
    setError(null);
    try {
      const content = await fetchFile(filePath, rootPath);
      setSelectedFile(content);
    } catch (err: any) {
      setError(err.message || "Failed to read file");
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  }, [rootPath]);

  const handleSaveFile = useCallback(async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await apiSave(selectedFile.path, editContent, rootPath);
      setSelectedFile({ ...selectedFile, content: editContent, size: new Blob([editContent]).size });
      setEditMode(false);
      showToast("File saved");
    } catch (err: any) {
      showToast(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }, [selectedFile, editContent, rootPath]);

  // Shiki syntax highlighting
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const highlightingRef = useRef(false);

  useEffect(() => {
    if (!selectedFile) { setHighlightedHtml(""); return; }
    const langMap: Record<string, string> = {
      typescript: "typescript", javascript: "javascript", python: "python",
      markdown: "markdown", json: "json", yaml: "yaml", html: "html",
      css: "css", scss: "scss", shell: "bash", bash: "bash",
      sql: "sql", go: "go", rust: "rust", ruby: "ruby", java: "java",
      cpp: "cpp", c: "c", php: "php", swift: "swift", kotlin: "kotlin",
      toml: "toml", xml: "xml", graphql: "graphql", dockerfile: "dockerfile",
      prisma: "prisma", tsx: "tsx", jsx: "jsx",
    };
    const lang = langMap[selectedFile.language] || "text";
    highlightingRef.current = true;
    codeToHtml(selectedFile.content, { lang, theme: "vitesse-black" })
      .then((html) => { if (highlightingRef.current) setHighlightedHtml(html); })
      .catch(() => setHighlightedHtml(""));
    return () => { highlightingRef.current = false; };
  }, [selectedFile]);

  // ─── CRUD handlers ──────────────────────────────────────────────────────────

  const handleDelete = useCallback((targetPath: string, type: "dir" | "file") => {
    const name = targetPath.split("/").pop() || targetPath;
    setDeleteConfirm({ path: targetPath, type, name });
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    try {
      await apiDelete(deleteConfirm.path, rootPath);
      // Remove from tree + clear selected if needed
      const removePath = deleteConfirm.path;
      setTree((prev) => {
        const removeFrom = (nodes: TreeNode[]): TreeNode[] =>
          nodes
            .filter((n) => n.path !== removePath)
            .map((n) =>
              n.children ? { ...n, children: removeFrom(n.children) } : n
            );
        return removeFrom(prev);
      });
      if (selectedPath === removePath || selectedPath?.startsWith(removePath + "/")) {
        setSelectedPath(null);
        setSelectedFile(null);
      }
      showToast(`Deleted: ${deleteConfirm.name}`);
    } catch (err: any) {
      showToast(`Error: ${err.message}`);
    } finally {
      setDeleteConfirm(null);
    }
  }, [deleteConfirm, selectedPath]);

  const handleStartRename = useCallback((targetPath: string) => {
    setRenamingPath(targetPath);
  }, []);

  const handleConfirmRename = useCallback(
    async (oldPath: string, newName: string) => {
      setRenamingPath(null);
      if (!newName) return;
      try {
        const newPath = await apiRename(oldPath, newName, rootPath);
        const parentDir = oldPath.substring(0, oldPath.lastIndexOf("/"));
        await refreshDir(parentDir || rootPath);
        if (selectedPath === oldPath) {
          setSelectedPath(newPath);
          handleSelectFile(newPath);
        }
        showToast(`Renamed to: ${newName}`);
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    },
    [rootPath, refreshDir, selectedPath, handleSelectFile]
  );

  const handleNewFile = useCallback((dirPath: string) => {
    setNewItemDialog({ type: "file", dirPath });
  }, []);

  const handleNewFolder = useCallback((dirPath: string) => {
    setNewItemDialog({ type: "dir", dirPath });
  }, []);

  const confirmNewItem = useCallback(
    async (name: string) => {
      if (!newItemDialog) return;
      const targetPath = `${newItemDialog.dirPath}/${name}`;
      setNewItemDialog(null);
      try {
        await apiCreate(targetPath, newItemDialog.type, rootPath);
        await refreshDir(newItemDialog.dirPath);
        showToast(`Created: ${name}`);
        if (newItemDialog.type === "file") {
          handleSelectFile(targetPath);
        }
      } catch (err: any) {
        showToast(`Error: ${err.message}`);
      }
    },
    [newItemDialog, refreshDir, handleSelectFile]
  );

  const handleDownload = useCallback((filePath: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = `/api/files/download?path=${encodeURIComponent(filePath)}`;
    a.download = fileName;
    a.click();
  }, []);

  const handleUploadFiles = useCallback(
    async (dir: string, files: File[]) => {
      if (!files.length) return;
      try {
        await apiUpload(dir, rootPath, files);
        await refreshDir(dir);
        showToast(`Uploaded ${files.length} file(s) to ${dir.split("/").pop()}`);
      } catch (err: any) {
        showToast(`Upload error: ${err.message}`);
      }
    },
    [refreshDir, rootPath]
  );

  const handleUploadClick = useCallback((dirPath: string) => {
    setUploadDir(dirPath);
    fileInputRef.current?.click();
  }, []);

  const handleFolderUploadClick = useCallback((dirPath: string) => {
    setUploadDir(dirPath);
    folderInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length) handleUploadFiles(uploadDir, files);
      e.target.value = "";
    },
    [uploadDir, handleUploadFiles]
  );

  // Drag & drop over the tree panel
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) handleUploadFiles(rootPath, files);
    },
    [rootPath, handleUploadFiles]
  );

  const lines = selectedFile?.content.split("\n") || [];

  return (
    <div className="flex h-full bg-[#000000] text-[#e0e0e0] relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      {/* Hidden folder input */}
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-ignore — webkitdirectory is not in TS types but works in all modern browsers
        webkitdirectory=""
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          message={`Delete "${deleteConfirm.name}"${deleteConfirm.type === "dir" ? " and all its contents" : ""}?`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* New item dialog */}
      {newItemDialog && (
        <NewItemDialog
          type={newItemDialog.type}
          dirPath={newItemDialog.dirPath}
          onConfirm={confirmNewItem}
          onCancel={() => setNewItemDialog(null)}
        />
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="absolute top-2 right-2 z-40 bg-[#0d1f17] border border-[#10b981]/40 text-[#10b981] text-[11px] font-mono px-3 py-1.5 rounded shadow-lg">
          {toastMsg}
        </div>
      )}

      {/* File tree — left panel */}
      <div
        className={`shrink-0 border-r border-[#1f1f1f] flex flex-col overflow-hidden transition-all ${treeVisible ? "w-64" : "w-0 border-r-0"} ${dragOver ? "bg-[#0d1f17]/50" : ""}`}
        onDragOver={!readOnly ? handleDragOver : undefined}
        onDragLeave={!readOnly ? handleDragLeave : undefined}
        onDrop={!readOnly ? handleDrop : undefined}
      >
        {/* Tree header */}
        <div className="px-3 py-2 border-b border-[#1f1f1f] shrink-0 flex items-center justify-between gap-1">
          <span className="text-[10px] font-semibold text-[#555555] uppercase tracking-wider">
            Explorer
          </span>
          {!readOnly && (
            <div className="flex items-center gap-1 ml-auto mr-1">
              <button
                title="Upload files"
                onClick={() => handleUploadClick(rootPath)}
                className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
              >
                <Upload className="h-3 w-3" />
              </button>
              <button
                title="Upload folder"
                onClick={() => handleFolderUploadClick(rootPath)}
                className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
              >
                <FolderPlus className="h-3 w-3" />
              </button>
              <button
                title="New file"
                onClick={() => handleNewFile(rootPath)}
                className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
              >
                <FilePlus className="h-3 w-3" />
              </button>
              <button
                title="New folder"
                onClick={() => handleNewFolder(rootPath)}
                className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
              >
                <FolderPlus className="h-3 w-3" />
              </button>
            </div>
          )}
          <button
            onClick={() => setTreeVisible(false)}
            className="text-[10px] text-[#555555] hover:text-[#888888] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Drag overlay hint */}
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-[#0d1f17] border border-[#10b981]/50 rounded-lg px-4 py-2">
              <span className="text-[11px] text-[#10b981] font-mono">Drop to upload</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {treeLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px] text-[#555555] animate-pulse">Loading...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px] text-[#555555]">No files found</span>
            </div>
          ) : (
            tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                renamingPath={renamingPath}
                onToggleDir={handleToggleDir}
                onSelectFile={handleSelectFile}
                onStartRename={handleStartRename}
                onConfirmRename={handleConfirmRename}
                onCancelRename={() => setRenamingPath(null)}
                onDelete={handleDelete}
                onDownload={handleDownload}
                onNewFile={handleNewFile}
                onNewFolder={handleNewFolder}
                onUpload={handleUploadClick}
                onUploadFolder={handleFolderUploadClick}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      </div>

      {/* Code viewer / image viewer — right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Image preview */}
        {selectedImagePath ? (
          <>
            <div className="px-3 py-1.5 border-b border-[#1f1f1f] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {!treeVisible && (
                  <button onClick={() => setTreeVisible(true)} className="text-[#555555] hover:text-[#888888] transition-colors shrink-0">
                    <Folder className="h-4 w-4" />
                  </button>
                )}
                <span className="text-[11px] text-[#10b981] font-mono truncate">{selectedImagePath}</span>
              </div>
              {!readOnly && (
                <button
                  title="Download"
                  onClick={() => handleDownload(selectedImagePath, selectedImagePath.split("/").pop() || "image")}
                  className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/files/image?path=${encodeURIComponent(selectedImagePath)}`}
                alt={selectedImagePath.split("/").pop()}
                className="max-w-full max-h-full object-contain rounded"
                style={{ imageRendering: "auto" }}
              />
            </div>
          </>
        ) : selectedFile ? (
          <>
            {/* File header */}
            <div className="px-3 py-1.5 border-b border-[#1f1f1f] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {!treeVisible && (
                  <button
                    onClick={() => setTreeVisible(true)}
                    className="text-[#555555] hover:text-[#888888] transition-colors shrink-0"
                    title="Show file tree"
                  >
                    <Folder className="h-4 w-4" />
                  </button>
                )}
                <span className="text-[11px] text-[#10b981] font-mono truncate">
                  {selectedFile.path}
                  {editMode && <span className="text-[#555555] ml-1">— editing</span>}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="text-[10px] text-[#555555]">{selectedFile.language}</span>
                <span className="text-[10px] text-[#555555]">{formatSize(selectedFile.size)}</span>
                <span className="text-[10px] text-[#555555]">{lines.length} lines</span>
                {!readOnly && (
                  <>
                    {editMode ? (
                      <>
                        <button
                          title="Save (Ctrl+S)"
                          onClick={handleSaveFile}
                          disabled={saving}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30 transition-colors disabled:opacity-50"
                        >
                          <Save className="h-3 w-3" />
                          {saving ? "Saving..." : "Save"}
                        </button>
                        <button
                          title="Cancel edit"
                          onClick={() => { setEditMode(false); setEditContent(""); }}
                          className="px-1.5 py-0.5 text-[10px] rounded border border-[#333] text-[#888] hover:text-[#e0e0e0] transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        title="Edit file"
                        onClick={() => { setEditMode(true); setEditContent(selectedFile.content); }}
                        className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      title="Download"
                      onClick={() => handleDownload(selectedFile.path, selectedFile.path.split("/").pop() || "file")}
                      className="p-0.5 text-[#555555] hover:text-[#10b981] transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content: editor or viewer */}
            <div className="flex-1 overflow-auto">
              {editMode ? (
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSaveFile();
                    }
                  }}
                  className="w-full h-full resize-none bg-[#000] text-[#e0e0e0] text-[12px] leading-[1.6] font-mono p-3 outline-none border-0"
                  spellCheck={false}
                />
              ) : highlightedHtml ? (
                <div className="flex text-[12px] leading-[1.6] font-mono">
                  <div className="select-none text-right pr-4 pl-3 text-[#333333] shrink-0 pt-3 pb-3">
                    {lines.map((_, i) => <div key={i}>{i + 1}</div>)}
                  </div>
                  <div
                    className="flex-1 min-w-0 overflow-x-auto pt-3 pb-3 pr-4 [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!text-[12px] [&_code]:!leading-[1.6]"
                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                  />
                </div>
              ) : (
                <pre className="text-[12px] leading-[1.6] font-mono p-0 m-0">
                  <table className="border-collapse w-full">
                    <tbody>
                      {lines.map((line, i) => (
                        <tr key={i} className="hover:bg-[#0a0a0a]/40">
                          <td className="text-right pr-4 pl-3 select-none text-[#333333] w-[1%] whitespace-nowrap align-top">
                            {i + 1}
                          </td>
                          <td className="pr-4 whitespace-pre text-[#888888]">{line || " "}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </pre>
              )}
            </div>
          </>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-[#555555] animate-pulse">Loading file...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-red-400">{error}</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            {!treeVisible && (
              <button onClick={() => setTreeVisible(true)} className="text-2xl">📁</button>
            )}
            <span className="text-[12px] text-[#333333]">Select a file to view</span>
            {!readOnly && (
              <span className="text-[11px] text-[#333333]">Drag & drop files onto the tree to upload</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
