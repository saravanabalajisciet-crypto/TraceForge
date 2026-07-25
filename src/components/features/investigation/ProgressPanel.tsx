"use client";

import { motion } from "framer-motion";
import { TrendingUp, Eye, Clock, FileText, Unlock } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { useInvestigation } from "@/contexts/InvestigationContext";

interface ProgressBarProps {
  value: number;
  color?: string;
}

function ProgressBar({ value, color = "from-purple-500 to-blue-500" }: ProgressBarProps) {
  return (
    <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

export function ProgressPanel() {
  const { progressStats, scenario, openReview, invState } = useInvestigation();
  const { reviewed, total, timelineCount, notesCount, overallPct } = progressStats;

  const reviewedPct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
  const timelinePct = total > 0 ? Math.round((Math.min(timelineCount, total) / total) * 100) : 0;

  // Reveal is enabled once the student has placed at least one event in the timeline
  const canReveal = invState.timeline.length > 0;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white/80">Investigation Progress</h3>
      </div>

      {/* Overall */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Overall</span>
          <span className="text-sm font-bold text-white">{overallPct}%</span>
        </div>
        <ProgressBar value={overallPct} color="from-purple-500 to-blue-500" />
      </div>

      <div className="space-y-3">
        {/* Evidence Reviewed */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
              <Eye className="w-3 h-3" />
              Evidence Reviewed
            </span>
            <span className="text-[10px] font-mono text-white/60">{reviewed} / {total}</span>
          </div>
          <ProgressBar value={reviewedPct} color="from-blue-500 to-cyan-500" />
        </div>

        {/* Timeline */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
              <Clock className="w-3 h-3" />
              Timeline Built
            </span>
            <span className="text-[10px] font-mono text-white/60">{timelineCount} events</span>
          </div>
          <ProgressBar value={timelinePct} color="from-purple-500 to-pink-500" />
        </div>

        {/* Notes */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
              <FileText className="w-3 h-3" />
              Notes Added
            </span>
            <span className="text-[10px] font-mono text-white/60">{notesCount} items</span>
          </div>
          <ProgressBar value={notesCount > 0 ? 100 : 0} color="from-emerald-500 to-teal-500" />
        </div>
      </div>

      {/* Risk Level */}
      {scenario && (
        <div className="mt-4 pt-4 border-t border-white/[0.05]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Scenario Risk</span>
            <span className={`text-sm font-bold font-mono ${scenario.riskLevel >= 80 ? "text-red-400" : scenario.riskLevel >= 60 ? "text-orange-400" : "text-yellow-400"}`}>
              {scenario.riskLevel}/100
            </span>
          </div>
          <ProgressBar
            value={scenario.riskLevel}
            color={scenario.riskLevel >= 80 ? "from-red-500 to-orange-500" : "from-orange-500 to-yellow-500"}
          />
        </div>
      )}

      {/* Reveal Investigation Button */}
      <div className="mt-4">
        {canReveal ? (
          <GradientButton
            size="sm"
            className="w-full justify-center"
            onClick={openReview}
          >
            <Unlock className="w-3.5 h-3.5" />
            Reveal Investigation
          </GradientButton>
        ) : (
          <div className="w-full flex flex-col gap-1.5">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-white/25 font-medium cursor-not-allowed"
            >
              <Unlock className="w-3.5 h-3.5" />
              Reveal Investigation
            </button>
            <p className="text-[9px] text-white/20 text-center font-mono">
              Add at least one event to the timeline
            </p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
