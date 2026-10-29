"use client";

// A lucide icon on a tile tinted with one colour: the app's icon
// style. globals.css (.icon-tile) holds the tones.

import type { LucideIcon } from "lucide-react";

export type Tone = "blue" | "green" | "yellow" | "red" | "magenta" | "cyan" | "grey";

export function IconTile({
  icon: Icon,
  tone,
  size = "m",
  className = "",
}: {
  icon: LucideIcon;
  tone: Tone;
  size?: "s" | "m" | "l";
  className?: string;
}) {
  const px = size === "s" ? 13 : size === "m" ? 16 : 20;
  return (
    <span className={`icon-tile ${tone} ${size} ${className}`} aria-hidden>
      <Icon size={px} strokeWidth={1.75} />
    </span>
  );
}
