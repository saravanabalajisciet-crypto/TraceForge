"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import { AttackStory, AttackStage } from "@/types/v2";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { InferenceBadge } from "./InferenceBadge";
import { cn } from "@/lib/utils";

interface AttackChainViewProps {
  attackStory: AttackStory;
  onStageClick: (stage: AttackStage) => void;
  selectedStage?: string;
}

const TACTIC_COLORS: Record<string, string> = {
  "Initial Access":       "border-red-500/30 bg-red-500/[0.06] text-red-400",
  "Execution":            "border-orange-500/30 bg-orange-500/[0.06] text-orange-400",
  "Persistence":          "border-yellow-500/30 bg-yellow-500/[0.06] text-yellow-400",
  "Privilege Escalation": "border-amber-500/30 bg-amber-500/[0.06] text-amber-400",
  "Defense Evasion":      "border-slate-400/30 bg-slate-400/[0.06] text-slate-400",
  "Credential Access":    "border-purple-500/30 bg-purple-500/[0.06] text-purple-400",
  "Discovery":            "border-blue-400/30 bg-blue-400/[0.06] text-blue-400",
  "Lateral Movement":     "border-cyan-500/30 bg-cyan-500/[0.06] text-cyan-400",
  "Collection":           "border-teal-500/30 bg-teal-500/[0.06] text-teal-400",
  "Command and Control":  "border-violet-500/30 bg-violet-500/[0.06] text-violet-400",
  "Exfiltration":         "border-pink-500/30 bg-pink-500/[0.06] text-pink-400",
  "Impact":               "border-red-600/40 bg-red-600/[0.08] text-red-300",
};

function defaultColor() { return "border-white/[0.08] bg-white/[0.02] text-white/50"; }

export function AttackChainView({ attackStory, onStageClick, selectedStage }: AttackChainViewProps) {
  if (attackStory.stages.length === 0) {
    return (
      <div className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.01]">
        <p className="text-xs text-white/30 font-mono text-center">
          {attackStory.uncertainties[0] ?? "No attack stages detected."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="p-3 rounded-lg border border-white/[0.05] bg-white/[0.01]">
        <p className="text-xs text-white/60 leading-relaxed">{attackStory.summary}</p>
      </div>

      {/* Chain */}
      <div className="flex flex-wrap items-center gap-2">
        {attackStory.stages.map((stage, i) => {
          const color = TACTIC_COLORS[stage.name] ?? defaultColor();
          const isSelected = selectedStage === stage.name;

          return (
            <div key={stage.name} className="flex items-center gap-2">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => onStageClick(stage)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-left transition-all",
                  color,
                  isSelected && "ring-2 ring-purple-500/40",
                  "hover:opacity-90"
                )}
              >
                <p className="text-[11px] font-semibold">{stage.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <ConfidenceBadge confidence={stage.confidence} showPercent size="sm" />
                  <span className="text-[9px] font-mono opacity-60">
                    {stage.supportingEventIds.length} event{stage.supportingEventIds.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </motion.button>
              {i < attackStory.stages.length - 1 && (
                <ArrowRight className="w-3 h-3 text-white/15 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Uncertainties */}
      {attackStory.uncertainties.length > 0 && (
        <div className="p-3 rounded-lg border border-yellow-500/15 bg-yellow-500/[0.03]">
          <p className="text-[9px] font-mono text-yellow-400/60 uppercase tracking-widest mb-1.5">Uncertainties</p>
          {attackStory.uncertainties.map((u, i) => (
            <p key={i} className="text-[11px] text-yellow-400/70 leading-relaxed">{u}</p>
          ))}
        </div>
      )}
    </div>
  );
}
