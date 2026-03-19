"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BoardItem, BoardColumn } from "@/lib/types";
import { BOARD_COLUMNS, PRIORITIES, ROLES } from "@/lib/types";
import { api } from "@/lib/api";

interface TaskDetailProps {
  item: BoardItem | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function TaskDetail({ item, open, onClose, onUpdate }: TaskDetailProps) {
  const [moving, setMoving] = useState(false);

  if (!item) return null;

  const handleMove = async (status: BoardColumn) => {
    setMoving(true);
    try {
      await api.moveItem(item.id, { board_status: status });
      onUpdate();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setMoving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-6">
            {item.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Meta badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`font-mono text-[11px] ${
                item.priority === "P0" ? "border-red-500/40 text-red-400 bg-red-500/10" :
                item.priority === "P1" ? "border-amber-500/40 text-amber-400 bg-amber-500/10" :
                item.priority === "P2" ? "border-blue-500/40 text-blue-400 bg-blue-500/10" :
                "border-gray-500/40 text-gray-400 bg-gray-500/10"
              }`}
            >
              {item.priority}
            </Badge>
            {item.assignee_role && (
              <Badge
                variant="outline"
                className={`font-mono text-[11px] ${
                  item.assignee_role === "BE" ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" :
                  item.assignee_role === "FE" ? "border-purple-500/40 text-purple-300 bg-purple-500/10" :
                  item.assignee_role === "QA" ? "border-yellow-500/40 text-yellow-300 bg-yellow-500/10" :
                  item.assignee_role === "TL" ? "border-blue-500/40 text-blue-300 bg-blue-500/10" :
                  item.assignee_role === "PO" ? "border-pink-500/40 text-pink-300 bg-pink-500/10" :
                  "border-cyan-500/40 text-cyan-300 bg-cyan-500/10"
                }`}
              >
                {item.assignee_role}
              </Badge>
            )}
            {item.story_points !== null && (
              <span className="text-[11px] font-mono text-muted-foreground/70 bg-muted/50 rounded px-2 py-0.5">
                {item.story_points} story points
              </span>
            )}
          </div>

          {/* Description */}
          {item.description && (
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          )}

          {/* Current status */}
          <div>
            <p className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-2">
              Current Status
            </p>
            <Badge variant="secondary" className="font-mono text-xs">
              {item.board_status.replace("_", " ")}
            </Badge>
          </div>

          {/* Move to */}
          <div>
            <p className="text-[11px] font-mono text-muted-foreground/60 uppercase tracking-wider mb-2">
              Move To
            </p>
            <div className="flex flex-wrap gap-1.5">
              {BOARD_COLUMNS.map((col) => (
                <Button
                  key={col.key}
                  variant={col.key === item.board_status ? "secondary" : "outline"}
                  size="sm"
                  disabled={col.key === item.board_status || moving}
                  onClick={() => handleMove(col.key)}
                  className="text-[11px] h-7 font-mono"
                >
                  {col.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
