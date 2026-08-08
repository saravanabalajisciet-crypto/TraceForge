"use client";

import { Cpu, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InferenceBadgeProps {
  type: "ai-inferred" | "confirmed" | "uncertain";
  label?: string;
  className?: string;
}

export function InferenceBadge({ type, label, className }: InferenceBadgeProps) {
  const cfg = {
    "ai-inferred": {
      icon: <Cpu className="w-2.5 h-2.5" />,
      text: label ?? "AI Inferred",
      classes: "border-blue-500/30 bg-blue-500/[0.08] text-blue-400",
    },
    "confirmed": {
      icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      text: label ?? "Confirmed",
      classes: "border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400",
    },
    "uncertain": {
      icon: <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />,
      text: label ?? "Uncertain",
      classes: "border-yellow-500/30 bg-yellow-500/[0.08] text-yellow-400",
    },
  }[type];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-mono",
      cfg.classes, className
    )}>
      {cfg.icon}
      {cfg.text}
    </span>
  );
}
