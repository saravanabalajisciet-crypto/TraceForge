"use client";

import { motion } from "framer-motion";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Server, Hash, GripVertical, CheckCircle2, Plus } from "lucide-react";
import { EvidenceItem } from "@/types";
import { CyberBadge } from "@/components/CyberBadge";
import { cn } from "@/lib/utils";
import { getSeverityColor, getSeverityDot, getCategoryColor, formatShortTime } from "@/utils/formatters";
import { useInvestigation } from "@/contexts/InvestigationContext";

interface EvidenceCardProps {
  evidence: EvidenceItem;
  index?: number;
}

export function EvidenceCard({ evidence, index = 0 }: EvidenceCardProps) {
  const { openDrawer, addToTimeline, isReviewed, isInTimeline } = useInvestigation();
  const reviewed = isReviewed(evidence.id);
  const inTimeline = isInTimeline(evidence.id);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: evidence.id,
    data: { evidenceId: evidence.id },
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        "group relative rounded-xl border bg-white/[0.02] transition-all duration-200",
        isDragging
          ? "border-purple-500/50 shadow-[0_0_20px_rgba(139,92,246,0.3)] z-50"
          : reviewed
          ? "border-emerald-500/20 hover:border-emerald-500/30"
          : "border-white/[0.06] hover:border-purple-500/25 hover:bg-white/[0.04]"
      )}
    >
      {/* Reviewed indicator bar */}
      {reviewed && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-emerald-500/50" />
      )}

      <div className="p-3.5 pl-4">
        <div className="flex items-start gap-2">
          {/* Drag handle */}
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 flex-shrink-0 text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing transition-colors touch-none"
            aria-label="Drag to timeline"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", getSeverityDot(evidence.severity))} />
                <CyberBadge
                  label={evidence.category}
                  variant={getCategoryColor(evidence.category) as "blue" | "purple" | "red" | "yellow" | "green"}
                />
                <span className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border",
                  getSeverityColor(evidence.severity)
                )}>
                  {evidence.severity.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {reviewed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
              </div>
            </div>

            {/* Title */}
            <button
              onClick={() => openDrawer(evidence.id)}
              className="text-left w-full"
            >
              <p className="text-sm font-medium text-white/85 group-hover:text-white transition-colors leading-snug mb-1">
                {evidence.title}
              </p>
              <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2 mb-2">
                {evidence.description}
              </p>
            </button>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
                <Clock className="w-3 h-3" />
                {formatShortTime(evidence.timestamp)}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
                <Server className="w-3 h-3" />
                {evidence.hostname}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/30 font-mono">
                <Hash className="w-3 h-3" />
                {evidence.eventId}
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400/70 border border-purple-500/15">
                {evidence.mitreTechnique}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Add to timeline button */}
      <div className="px-3.5 pb-3 flex justify-end">
        <button
          onClick={(e) => { e.stopPropagation(); addToTimeline(evidence.id); }}
          disabled={inTimeline}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono border transition-all duration-150",
            inTimeline
              ? "text-purple-400/50 border-purple-400/15 bg-purple-400/[0.05] cursor-default"
              : "text-white/40 border-white/[0.06] hover:text-purple-400 hover:border-purple-400/30 hover:bg-purple-400/[0.05]"
          )}
        >
          <Plus className="w-3 h-3" />
          {inTimeline ? "In Timeline" : "Add to Timeline"}
        </button>
      </div>
    </motion.div>
  );
}
