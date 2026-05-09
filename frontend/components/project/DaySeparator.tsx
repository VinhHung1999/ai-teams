"use client";
import type { FC } from "react";

export interface DaySeparatorProps { text: string }

export const DaySeparator: FC<DaySeparatorProps> = ({ text }) => (
  <div className="day-sep">{text}</div>
);
