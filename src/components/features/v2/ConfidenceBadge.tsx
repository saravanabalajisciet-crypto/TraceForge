"use client";

import { confidenceLabel } from "@/types/v2";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number; // 0.0 – 1.0
  showPercent?: boolean;
  size?: "sm" | "md";
}

export function ConfidenceBadge({ confidence, showPercent = true, size = "sm" }: ConfidenceBadgeProps) {
  const level = confidenceLabel(confidence);
  const pct = Math.round(confidence * 100);

  const cfg = {
    high:   { label: "High",   classes: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400" },
    medium: { label: "Medium", classes: "border-yellow-500/30 bg-yellow-500/[0.08] text-yellow-400" },
    low:    { label: "Low",    classes: "border-red-500/30 bg-red-500/[0.08] text-red-400" },
  }[level];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border font-mono",
      size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
      cfg.classes
    )}>
      <span className={cn(
        "rounded-full",
        size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5",
        level === "high" ? "bg-emerald-400" : level === "medium" ? "bg-yellow-400" : "bg-red-400"
      )} />
      {cfg.label}{showPercent && ` ${pct}%`}
    </span>
  );
}
