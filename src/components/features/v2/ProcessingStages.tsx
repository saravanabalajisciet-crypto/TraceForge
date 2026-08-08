"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";
import { ProcessingStage, ProcessingStageStatus } from "@/types/v2";
import { cn } from "@/lib/utils";

interface ProcessingStagesProps {
  stages: ProcessingStage[];
}

const statusIcon: Record<ProcessingStageStatus, React.ReactNode> = {
  pending:  <Circle className="w-3.5 h-3.5 text-white/20" />,
  active:   <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />,
  complete: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  error:    <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const statusText: Record<ProcessingStageStatus, string> = {
  pending:  "text-white/25",
  active:   "text-white/80",
  complete: "text-white/50",
  error:    "text-red-400",
};

export function ProcessingStages({ stages }: ProcessingStagesProps) {
  const completedCount = stages.filter((s) => s.status === "complete").length;
  const totalCount = stages.length;
  const pct = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="w-full max-w-sm">
      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/[0.05] mb-5 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Stage list */}
      <div className="flex flex-col gap-2.5">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <span className="flex-shrink-0">{statusIcon[stage.status]}</span>
            <div className="flex-1 min-w-0">
              <p className={cn("text-xs font-mono", statusText[stage.status])}>
                {stage.label}
              </p>
              {stage.detail && stage.status === "active" && (
                <p className="text-[10px] text-white/30 mt-0.5 truncate">{stage.detail}</p>
              )}
            </div>
            {stage.status === "complete" && (
              <span className="text-[9px] font-mono text-emerald-400/50 flex-shrink-0">done</span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
