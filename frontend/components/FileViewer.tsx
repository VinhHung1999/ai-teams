"use client";

import { useState, useEffect, useCallback } from "react";

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

interface FileViewerProps {
  rootPath: string;
}

async function fetchTree(dirPath: string): Promise<FileEntry[]> {
  const res = await fetch(`/api/files/tree?path=${encodeURIComponent(dirPath)}`);
  if (!res.ok) throw new Error("Failed to load directory");
  const data = await res.json();
  return data.entries;
}

async function fetchFile(filePath: string): Promise<FileContent> {
  const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to read file" }));
    throw new Error(err.error || "Failed to read file");
  }
  return res.json();
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onToggleDir,
  onSelectFile,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onToggleDir: (node: TreeNode) => void;
  onSelectFile: (path: string) => void;
}) {
  const isSelected = node.path === selectedPath;
  const paddingLeft = 8 + depth * 16;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => onToggleDir(node)}
          className="w-full text-left flex items-center gap-1.5 py-[3px] pr-2 hover:bg-[#292e42] transition-colors group"
          style={{ paddingLeft }}
        >
          <span className="text-[10px] text-[#565f89] w-3 text-center shrink-0">
            {node.expanded ? "\u25BE" : "\u25B8"}
          </span>
          <span className="text-[11px] text-[#7aa2f7] truncate">{node.name}</span>
        </button>
        {node.expanded && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onToggleDir={onToggleDir}
                onSelectFile={onSelectFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelectFile(node.path)}
      className={`w-full text-left flex items-center gap-1.5 py-[3px] pr-2 transition-colors ${
        isSelected ? "bg-[#292e42] text-[#c0caf5]" : "hover:bg-[#292e42]/50 text-[#a9b1d6]"
      }`}
      style={{ paddingLeft: paddingLeft + 14 }}
    >
      <span className="text-[11px] truncate">{node.name}</span>
      {node.size !== undefined && (
        <span className="text-[9px] text-[#565f89] ml-auto shrink-0">
          {formatSize(node.size)}
        </span>
      )}
    </button>
  );
}

export function FileViewer({ rootPath }: FileViewerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(true);

  // Load root tree on mount
  useEffect(() => {
    if (!rootPath) return;
    setTreeLoading(true);
    fetchTree(rootPath)
      .then((entries) => {
        setTree(
          entries.map((e) => ({
            ...e,
            children: e.type === "dir" ? [] : undefined,
            loaded: false,
            expanded: false,
          }))
        );
      })
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false));
  }, [rootPath]);

  // Deep-update a node in the tree by path
  const updateNode = useCallback(
    (nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] => {
      return nodes.map((node) => {
        if (node.path === targetPath) return updater(node);
        if (node.children && targetPath.startsWith(node.path + "/")) {
          return { ...node, children: updateNode(node.children, targetPath, updater) };
        }
        return node;
      });
    },
    []
  );

  const handleToggleDir = useCallback(
    async (node: TreeNode) => {
      if (node.expanded) {
        // Collapse
        setTree((prev) => updateNode(prev, node.path, (n) => ({ ...n, expanded: false })));
        return;
      }

      if (!node.loaded) {
        // Load children
        try {
          const entries = await fetchTree(node.path);
          const children: TreeNode[] = entries.map((e) => ({
            ...e,
            children: e.type === "dir" ? [] : undefined,
            loaded: false,
            expanded: false,
          }));
          setTree((prev) =>
            updateNode(prev, node.path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children,
            }))
          );
        } catch {
          // Silently fail
        }
      } else {
        setTree((prev) => updateNode(prev, node.path, (n) => ({ ...n, expanded: true })));
      }
    },
    [updateNode]
  );

  const handleSelectFile = useCallback(async (filePath: string) => {
    setSelectedPath(filePath);
    setLoading(true);
    setError(null);
    try {
      const content = await fetchFile(filePath);
      setSelectedFile(content);
    } catch (err: any) {
      setError(err.message || "Failed to read file");
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const lines = selectedFile?.content.split("\n") || [];

  return (
    <div className="flex h-full bg-[#1a1b26] text-[#c0caf5]">
      {/* File tree - left panel */}
      <div className="w-60 shrink-0 border-r border-[#292e42] flex flex-col overflow-hidden">
        <div className="px-3 py-2 border-b border-[#292e42] shrink-0">
          <span className="text-[10px] font-semibold text-[#565f89] uppercase tracking-wider">
            Explorer
          </span>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
          {treeLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px] text-[#565f89] animate-pulse">Loading...</span>
            </div>
          ) : tree.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-[11px] text-[#565f89]">No files found</span>
            </div>
          ) : (
            tree.map((node) => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onToggleDir={handleToggleDir}
                onSelectFile={handleSelectFile}
              />
            ))
          )}
        </div>
      </div>

      {/* Code viewer - right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedFile ? (
          <>
            {/* File header */}
            <div className="px-3 py-1.5 border-b border-[#292e42] flex items-center justify-between shrink-0">
              <span className="text-[11px] text-[#7aa2f7] font-mono truncate">
                {selectedFile.path}
              </span>
              <div className="flex items-center gap-3 shrink-0 ml-2">
                <span className="text-[10px] text-[#565f89]">{selectedFile.language}</span>
                <span className="text-[10px] text-[#565f89]">{formatSize(selectedFile.size)}</span>
                <span className="text-[10px] text-[#565f89]">{lines.length} lines</span>
              </div>
            </div>
            {/* Code content */}
            <div className="flex-1 overflow-auto">
              <pre className="text-[12px] leading-[1.6] font-mono p-0 m-0">
                <table className="border-collapse w-full">
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="hover:bg-[#292e42]/40">
                        <td className="text-right pr-4 pl-3 select-none text-[#3b4261] w-[1%] whitespace-nowrap align-top">
                          {i + 1}
                        </td>
                        <td className="pr-4 whitespace-pre text-[#a9b1d6]">
                          {line || " "}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </pre>
            </div>
          </>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-[#565f89] animate-pulse">Loading file...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-red-400">{error}</span>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[12px] text-[#3b4261]">Select a file to view</span>
          </div>
        )}
      </div>
    </div>
  );
}
