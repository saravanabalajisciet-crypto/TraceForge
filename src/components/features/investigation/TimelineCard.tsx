"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Clock, ChevronRight } from "lucide-react";
import { EvidenceItem } from "@/types";
import { cn } from "@/lib/utils";
import { getSeverityDot, getSeverityColor, formatShortTime } from "@/utils/formatters";
import { useInvestigation } from "@/contexts/InvestigationContext";

interface TimelineCardProps {
  slotId: string;
  evidence: EvidenceItem;
  index: number;
}

export function TimelineCard({ slotId, evidence, index }: TimelineCardProps) {
  const { removeFromTimeline, openDrawer } = useInvestigation();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slotId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-2 pb-3",
        isDragging && "opacity-40"
      )}
    >
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0 pt-1">
        <span className={cn("w-2.5 h-2.5 rounded-full ring-2 ring-black flex-shrink-0 z-10", getSeverityDot(evidence.severity))} />
        <div className="w-px flex-1 bg-white/[0.06] mt-1 min-h-[16px]" />
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.1] transition-all duration-150 overflow-hidden">
        {/* Step number */}
        <div className="flex items-center justify-between px-3 pt-2.5 pb-0">
          <span className="text-[9px] font-mono text-white/20 uppercase tracking-widest">
            Step {index + 1}
          </span>
          <div className="flex items-center gap-1">
            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors touch-none p-0.5"
              aria-label="Reorder"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            {/* Remove */}
            <button
              onClick={() => removeFromTimeline(slotId)}
              aria-label="Remove from timeline"
              className="text-white/15 hover:text-red-400 transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-3 pt-1">
          <button
            onClick={() => openDrawer(evidence.id)}
            className="text-left w-full group/title"
          >
            <p className="text-xs font-medium text-white/80 group-hover/title:text-white transition-colors leading-snug mb-1">
              {evidence.title}
            </p>
          </button>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[9px] text-white/25 font-mono">
              <Clock className="w-2.5 h-2.5" />
              {formatShortTime(evidence.timestamp)}
            </span>
            <div className="flex items-center gap-1.5">
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[9px] font-mono font-medium border",
                getSeverityColor(evidence.severity)
              )}>
                {evidence.severity.toUpperCase()}
              </span>
              <span className="px-1 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400/70 border border-purple-500/15">
                {evidence.mitreTechnique}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 mt-1.5">
            <ChevronRight className="w-2.5 h-2.5 text-white/15" />
            <span className="text-[9px] text-white/25 font-mono">{evidence.mitreTactic}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
