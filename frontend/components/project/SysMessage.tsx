"use client";
import type { FC } from "react";

export interface SysMessageProps { text: string }

export const SysMessage: FC<SysMessageProps> = ({ text }) => (
  <div className="sys-msg">{text}</div>
);
