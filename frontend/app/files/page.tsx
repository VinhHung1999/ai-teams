"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { FileManager } from "@/components/FileManager";
import { FolderOpen, ChevronRight, Home, ArrowLeft } from "lucide-react";

const DEFAULT_PATH = process.env.NEXT_PUBLIC_DEFAULT_FILES_PATH || "/";

// History of visited paths stored in localStorage
const HISTORY_KEY = "fm_path_history";
const MAX_HISTORY = 10;

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(path: string) {
  try {
    const prev = loadHistory().filter((p) => p !== path);
    const next = [path, ...prev].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {}
}

export default function FilesPage() {
  const [rootPath, setRootPath] = useState<string>("");
  const [inputValue, setInputValue] = useState<string>("");
  const [committed, setCommitted] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const hist = loadHistory();
    setHistory(hist);
    // Restore last used path
    const last = hist[0] || DEFAULT_PATH;
    setInputValue(last);
    setRootPath(last);
    setCommitted(true);
  }, []);

  const navigate = (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    setRootPath(trimmed);
    setInputValue(trimmed);
    setCommitted(true);
    setShowHistory(false);
    saveHistory(trimmed);
    setHistory(loadHistory());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      setShowHistory(false);
      navigate(inputValue);
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setShowHistory(false);
      setInputValue(rootPath);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#000000] text-[#e0e0e0]">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-[#1f1f1f] bg-[#050505]">
        <Link
          href="/"
          className="flex items-center gap-1 p-0.5 text-[#555] hover:text-[#10b981] transition-colors shrink-0"
          title="Back to dashboard"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </Link>
        <FolderOpen className="h-4 w-4 text-[#10b981] shrink-0" />
        <span className="text-[11px] font-semibold text-[#10b981] uppercase tracking-wider shrink-0">
          File Manager
        </span>

        {/* Path input */}
        <div className="flex-1 relative max-w-2xl">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
              setShowHistory(true);
            }}
            onBlur={() => {
              blurTimerRef.current = setTimeout(() => setShowHistory(false), 150);
            }}
            placeholder="/path/to/directory"
            className="w-full bg-[#111] border border-[#1f1f1f] focus:border-[#10b981]/40 text-[12px] text-[#e0e0e0] font-mono px-2 py-1 rounded outline-none transition-colors"
          />
          {/* History dropdown */}
          {showHistory && history.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-[#0a0a0a] border border-[#1f1f1f] rounded shadow-xl overflow-hidden">
              {history.map((p) => (
                <button
                  key={p}
                  onMouseDown={() => navigate(p)}
                  className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-[#888888] hover:bg-[#111] hover:text-[#e0e0e0] transition-colors flex items-center gap-2"
                >
                  <Home className="h-3 w-3 text-[#555] shrink-0" />
                  <span className="truncate">{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => navigate(inputValue)}
          className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30 transition-colors font-mono"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Go
        </button>

        {/* Quick nav to common paths */}
        <div className="hidden md:flex items-center gap-1 ml-2">
          {["/", process.env.NEXT_PUBLIC_WORKSPACE_PATH || "/Users", "/tmp"].map((p) => (
            <button
              key={p}
              onClick={() => navigate(p)}
              className="px-2 py-0.5 text-[10px] rounded border border-[#1f1f1f] text-[#555] hover:text-[#10b981] hover:border-[#10b981]/30 transition-colors font-mono"
            >
              {p === "/" ? "Root" : p.split("/").pop()}
            </button>
          ))}
        </div>
      </div>

      {/* File manager */}
      <div className="flex-1 min-h-0">
        {committed && rootPath ? (
          <FileManager rootPath={rootPath} />
        ) : (
          <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
              <FolderOpen className="h-12 w-12 text-[#1f1f1f] mx-auto mb-3" />
              <p className="text-[12px] text-[#333]">Enter a path above to browse files</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
