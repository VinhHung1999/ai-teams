"use client";
import type { FC } from "react";

export interface SlashCommand { cmd: string; desc: string }

const DEFAULT_COMMANDS: SlashCommand[] = [
  { cmd: "/status", desc: "Show current status" },
  { cmd: "/assign", desc: "Assign task" },
  { cmd: "/move",   desc: "Move task to column" },
  { cmd: "/sprint", desc: "Sprint summary" },
];

export interface SlashHintsProps {
  /** Filter commands by current text (the prefix after `/`). */
  filterText?: string;
  /** Click handler — parent should set composer text to selected cmd + " " */
  onSelect: (cmd: string) => void;
  /** Optional override list. */
  commands?: SlashCommand[];
}

export const SlashHints: FC<SlashHintsProps> = ({ filterText = "", onSelect, commands = DEFAULT_COMMANDS }) => {
  const filtered = filterText
    ? commands.filter((c) => c.cmd.toLowerCase().startsWith(("/" + filterText).toLowerCase()))
    : commands;
  if (filtered.length === 0) return null;
  return (
    <div className="slash-hints">
      {filtered.map((c) => (
        <button
          key={c.cmd}
          className="slash-hint"
          onClick={() => onSelect(c.cmd)}
          type="button"
        >
          <span className="cmd">{c.cmd}</span>
          <span className="desc">{c.desc}</span>
        </button>
      ))}
    </div>
  );
};
