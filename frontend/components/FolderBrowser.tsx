"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface DirEntry {
  name: string;
  path: string;
}

interface FolderBrowserProps {
  value: string;
  onSelect: (path: string) => void;
}

export function FolderBrowser({ value, onSelect }: FolderBrowserProps) {
  const [current, setCurrent] = useState("");
  const [parent, setParent] = useState("");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const browse = async (path?: string) => {
    setLoading(true);
    try {
      const data = await api.browseDirs(path);
      setCurrent(data.current);
      setParent(data.parent);
      setDirs(data.dirs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const result = await api.createDir(current, newFolderName.trim());
      setNewFolderName("");
      setCreatingFolder(false);
      // Navigate into the new folder
      await browse(result.path);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (open) browse(value || undefined);
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 w-full flex items-center justify-between px-3 py-2 rounded-md border border-border bg-muted/30 text-left hover:bg-muted/50 transition-colors"
      >
        <span className={`text-sm font-mono truncate ${value ? "text-foreground/80" : "text-muted-foreground/40"}`}>
          {value || "Browse folders..."}
        </span>
        <span className="text-muted-foreground/40 font-mono text-xs ml-2 shrink-0">▼</span>
      </button>
    );
  }

  return (
    <div className="mt-1 border border-border rounded-lg bg-muted/20 overflow-hidden">
      {/* Current path bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 bg-muted/30 min-w-0">
        <p className="text-[10px] font-mono text-muted-foreground/50 truncate flex-1 min-w-0 break-all line-clamp-1">
          {current}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCreatingFolder(!creatingFolder)}
            className="text-[10px] h-6 px-1.5 font-mono text-muted-foreground/50"
            title="New folder"
          >
            +
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => { onSelect(current); setOpen(false); }}
            className="text-[10px] h-6 px-2 font-mono"
          >
            OK
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="text-[10px] h-6 w-6 p-0 font-mono text-muted-foreground/50"
          >
            ✕
          </Button>
        </div>
      </div>

      {/* New folder input */}
      {creatingFolder && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30 bg-muted/10">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="h-7 text-[11px] font-mono bg-muted/30 flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            className="text-[10px] h-7 px-2 font-mono"
          >
            Create
          </Button>
        </div>
      )}

      {/* Folder list */}
      <div
        className="overflow-y-auto overscroll-contain"
        style={{ maxHeight: "150px", WebkitOverflowScrolling: "touch" }}
      >
        <div className="p-1">
          {current !== parent && (
            <button
              type="button"
              onClick={() => browse(parent)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left active:bg-muted/40"
            >
              <span className="text-muted-foreground/50 font-mono text-[11px]">↑</span>
              <span className="text-[12px] font-mono text-muted-foreground/60">..</span>
            </button>
          )}

          {loading ? (
            <div className="px-3 py-3 text-center">
              <span className="text-[11px] font-mono text-muted-foreground/40 animate-pulse">Loading...</span>
            </div>
          ) : dirs.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <span className="text-[11px] font-mono text-muted-foreground/30">No subdirectories</span>
            </div>
          ) : (
            dirs.map((dir) => (
              <button
                key={dir.path}
                type="button"
                onClick={() => browse(dir.path)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left active:bg-muted/40"
              >
                <span className="text-amber-400/60 font-mono text-[11px] shrink-0">▸</span>
                <span className="text-[12px] font-mono text-foreground/70 truncate">{dir.name}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
