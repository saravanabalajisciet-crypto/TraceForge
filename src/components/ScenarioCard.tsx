"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Clock,
  ChevronRight,
  Lock,
  Zap,
  ShieldAlert,
  Target,
} from "lucide-react";
import { Scenario } from "@/types";
import { getDifficultyColor, getStatusColor } from "@/utils/formatters";
import { CyberBadge } from "./CyberBadge";
import { cn } from "@/lib/utils";

interface ScenarioCardProps {
  scenario: Scenario;
  index?: number;
}

const attackIcons: Record<string, React.ReactNode> = {
  Ransomware: <ShieldAlert className="w-5 h-5" />,
  "Insider Threat": <Target className="w-5 h-5" />,
  "Credential Theft": <Zap className="w-5 h-5" />,
};

export function ScenarioCard({ scenario, index = 0 }: ScenarioCardProps) {
  const isLocked = scenario.status === "Locked";
  const icon = attackIcons[scenario.attackType] ?? <ShieldAlert className="w-5 h-5" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={isLocked ? "#" : `/investigation?id=${scenario.id}`}
        className={cn("block group", isLocked && "cursor-not-allowed")}
        aria-disabled={isLocked}
      >
        <div
          className={cn(
            "relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6",
            "transition-all duration-300",
            !isLocked &&
              "hover:border-purple-500/30 hover:bg-white/[0.04] hover:shadow-[0_0_40px_rgba(139,92,246,0.08)]",
            isLocked && "opacity-60"
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-purple-600/20 to-blue-600/20 border border-purple-500/20 text-purple-400"
              )}
            >
              {isLocked ? <Lock className="w-5 h-5" /> : icon}
            </div>
            <div className="flex items-center gap-2">
              <CyberBadge
                label={scenario.status}
                className={getStatusColor(scenario.status)}
              />
            </div>
          </div>

          {/* Codename */}
          <p className="text-[10px] font-mono tracking-[0.2em] text-purple-400/60 uppercase mb-1">
            {scenario.codename}
          </p>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-100 transition-colors">
            {scenario.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-white/40 leading-relaxed line-clamp-3 mb-5">
            {scenario.description}
          </p>

          {/* Meta */}
          <div className="flex flex-wrap gap-2 mb-5">
            <CyberBadge
              label={scenario.difficulty}
              className={getDifficultyColor(scenario.difficulty)}
            />
            <CyberBadge label={scenario.attackType} variant="purple" />
            <span className="inline-flex items-center gap-1.5 text-xs text-white/40 font-mono">
              <Clock className="w-3 h-3" />
              {scenario.estimatedTime}
            </span>
          </div>

          {/* MITRE tags */}
          <div className="flex flex-wrap gap-1.5">
            {scenario.mitreCategories.map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 text-[10px] font-mono text-white/30 border border-white/[0.05] rounded bg-white/[0.02]"
              >
                {cat}
              </span>
            ))}
          </div>

          {/* CTA arrow */}
          {!isLocked && (
            <div className="absolute bottom-6 right-6 text-white/20 group-hover:text-purple-400 group-hover:translate-x-1 transition-all duration-200">
              <ChevronRight className="w-4 h-4" />
            </div>
          )}

          {/* Subtle gradient line at top on hover */}
          <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-purple-500/0 to-transparent group-hover:via-purple-500/40 transition-all duration-500 rounded-full" />
        </div>
      </Link>
    </motion.div>
  );
}
