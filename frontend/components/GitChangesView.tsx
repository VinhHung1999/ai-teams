"use client";

import { useEffect, useState, useCallback } from "react";

interface GitFile {
  path: string;
  status: "modified" | "added" | "deleted" | "renamed" | "untracked" | string;
  xy: string;
}

interface GitChangesData {
  files: GitFile[];
  diff: string;
  error?: string;
}

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  modified:  { label: "M", color: "text-yellow-400 bg-yellow-400/10" },
  added:     { label: "A", color: "text-green-400 bg-green-400/10" },
  deleted:   { label: "D", color: "text-red-400 bg-red-400/10" },
  renamed:   { label: "R", color: "text-blue-400 bg-blue-400/10" },
  untracked: { label: "?", color: "text-muted-foreground/50 bg-muted/20" },
};

function DiffView({ diff }: { diff: string }) {
  if (!diff.trim()) return null;

  const lines = diff.split("\n");
  return (
    <pre className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all">
      {lines.map((line, i) => {
        let cls = "text-foreground/60";
        if (line.startsWith("+") && !line.startsWith("+++")) cls = "text-green-400 bg-green-400/5";
        else if (line.startsWith("-") && !line.startsWith("---")) cls = "text-red-400 bg-red-400/5";
        else if (line.startsWith("@@")) cls = "text-blue-400/70";
        else if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) cls = "text-muted-foreground/40";
        return (
          <span key={i} className={`block ${cls}`}>{line || " "}</span>
        );
      })}
    </pre>
  );
}

export function GitChangesView({ rootPath }: { rootPath: string }) {
  const [data, setData] = useState<GitChangesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [showFullDiff, setShowFullDiff] = useState(false);

  const fetchChanges = useCallback(async () => {
    if (!rootPath) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/git/changes?path=${encodeURIComponent(rootPath)}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.files?.length > 0 && !selectedFile) {
          setSelectedFile(json.files[0].path);
        }
      }
    } catch {}
    setLoading(false);
  }, [rootPath]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges]);

  if (!rootPath) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground/30">
        No project directory selected
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground/30 animate-pulse">
        Loading git changes...
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="flex items-center justify-center h-40 text-xs text-muted-foreground/30">
        {data.error}
      </div>
    );
  }

  if (!data || data.files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 gap-2">
        <span className="text-xs text-muted-foreground/30">No changes</span>
        <button
          onClick={fetchChanges}
          className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 px-2 py-1 rounded hover:bg-muted/20 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  // Filter diff for selected file
  const fileDiff = selectedFile
    ? extractFileDiff(data.diff, selectedFile)
    : data.diff;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/40 bg-muted/10 shrink-0">
        <span className="text-[11px] text-muted-foreground/50">
          {data.files.length} file{data.files.length !== 1 ? "s" : ""} changed
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFullDiff(!showFullDiff)}
            className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 px-2 py-0.5 rounded hover:bg-muted/20 transition-colors"
          >
            {showFullDiff ? "Split" : "Full diff"}
          </button>
          <button
            onClick={fetchChanges}
            className="text-[10px] text-muted-foreground/40 hover:text-foreground/60 px-2 py-0.5 rounded hover:bg-muted/20 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {showFullDiff ? (
        /* Full diff view */
        <div className="flex-1 overflow-y-auto p-3">
          <DiffView diff={data.diff} />
        </div>
      ) : (
        /* Split: file list + diff */
        <div className="flex-1 flex min-h-0">
          {/* File list */}
          <div className="w-48 shrink-0 border-r border-border/40 overflow-y-auto">
            {data.files.map((f) => {
              const s = STATUS_STYLE[f.status] || STATUS_STYLE.modified;
              const isSelected = selectedFile === f.path;
              return (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f.path)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-left transition-colors ${
                    isSelected
                      ? "bg-muted/40 text-foreground"
                      : "hover:bg-muted/20 text-muted-foreground/60"
                  }`}
                >
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded shrink-0 ${s.color}`}>
                    {s.label}
                  </span>
                  <span className="text-[11px] font-mono truncate" title={f.path}>
                    {f.path.split("/").pop()}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Diff content */}
          <div className="flex-1 overflow-y-auto p-3 min-w-0">
            {fileDiff ? (
              <DiffView diff={fileDiff} />
            ) : (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/30">
                {selectedFile?.includes("??") || data.files.find(f => f.path === selectedFile)?.status === "untracked"
                  ? "Untracked file — no diff available"
                  : "No diff for this file"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Extract the diff chunk for a specific file from full diff output */
function extractFileDiff(fullDiff: string, filePath: string): string {
  const lines = fullDiff.split("\n");
  const result: string[] = [];
  let inFile = false;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      inFile = line.includes(filePath);
    }
    if (inFile) result.push(line);
  }
  return result.join("\n");
}
