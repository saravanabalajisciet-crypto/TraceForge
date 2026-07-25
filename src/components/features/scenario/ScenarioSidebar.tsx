"use client";

import { Shield, Tag, Clock, BarChart2, BookOpen, Target } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { CyberBadge } from "@/components/CyberBadge";
import { ProgressPanel } from "@/components/features/investigation/ProgressPanel";
import { getDifficultyColor } from "@/utils/formatters";
import { useInvestigation } from "@/contexts/InvestigationContext";

export function ScenarioSidebar() {
  const { scenario } = useInvestigation();

  if (!scenario) {
    return (
      <aside className="flex flex-col gap-4 w-full">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 animate-pulse">
          <div className="h-3 w-1/2 bg-white/[0.06] rounded mb-4" />
          <div className="h-2 w-full bg-white/[0.04] rounded mb-2" />
          <div className="h-2 w-3/4 bg-white/[0.04] rounded" />
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 w-full">
      {/* Scenario Details */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white/80">Scenario Details</h3>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1">Operation</p>
            <p className="text-sm font-semibold text-white">{scenario.title.replace("Operation ", "")}</p>
            <p className="text-[10px] font-mono text-purple-400/60 uppercase tracking-[0.15em]">{scenario.codename}</p>
          </div>

          <div className="h-px bg-white/[0.05]" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> Difficulty
              </p>
              <CyberBadge
                label={scenario.difficulty}
                className={getDifficultyColor(scenario.difficulty)}
              />
            </div>
            <div>
              <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Est. Time
              </p>
              <span className="text-xs font-mono text-white/60">{scenario.estimatedTime}</span>
            </div>
          </div>

          <div>
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {scenario.tags.map((t) => (
                <CyberBadge key={t} label={t} variant="purple" />
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.05]" />

          {/* Investigation Brief */}
          <div>
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2 flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> Brief
            </p>
            <p className="text-[11px] text-white/45 leading-relaxed">
              {scenario.investigationBrief}
            </p>
          </div>

          <div className="h-px bg-white/[0.05]" />

          {/* Learning Objectives */}
          <div>
            <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> Objectives
            </p>
            <ul className="space-y-1.5">
              {scenario.learningObjectives.map((obj) => (
                <li key={obj.id} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="mt-1.5 w-1 h-1 rounded-full bg-purple-400/50 flex-shrink-0" />
                  {obj.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </GlassCard>

      {/* Progress Panel */}
      <ProgressPanel />
    </aside>
  );
}
