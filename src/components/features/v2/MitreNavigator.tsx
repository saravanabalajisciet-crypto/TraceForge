"use client";

import { motion } from "framer-motion";
import { CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { V2MitreMapping } from "@/types/v2";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { cn } from "@/lib/utils";

interface MitreNavigatorProps {
  mappings: V2MitreMapping[];
  onTechniqueClick?: (mapping: V2MitreMapping) => void;
}

// Group by tactic for display
function groupByTactic(mappings: V2MitreMapping[]): Map<string, V2MitreMapping[]> {
  const map = new Map<string, V2MitreMapping[]>();
  for (const m of mappings) {
    if (!map.has(m.tactic)) map.set(m.tactic, []);
    map.get(m.tactic)!.push(m);
  }
  return map;
}

const TACTIC_ORDER = [
  "Initial Access", "Execution", "Persistence", "Privilege Escalation",
  "Defense Evasion", "Credential Access", "Discovery", "Lateral Movement",
  "Collection", "Command and Control", "Exfiltration", "Impact",
];

export function MitreNavigator({ mappings, onTechniqueClick }: MitreNavigatorProps) {
  if (mappings.length === 0) {
    return (
      <p className="text-xs text-white/25 font-mono text-center py-4">
        No MITRE techniques inferred.
      </p>
    );
  }

  const grouped = groupByTactic(mappings);

  // Sort tactics by kill-chain order
  const sortedTactics = [...grouped.keys()].sort(
    (a, b) => {
      const ai = TACTIC_ORDER.indexOf(a);
      const bi = TACTIC_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
  );

  return (
    <div className="space-y-3">
      {sortedTactics.map((tactic, ti) => {
        const techs = grouped.get(tactic)!;
        const avgConf = techs.reduce((s, m) => s + m.confidence, 0) / techs.length;

        return (
          <motion.div
            key={tactic}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ti * 0.05 }}
            className="rounded-xl border border-white/[0.05] overflow-hidden"
          >
            {/* Tactic header */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border-b border-white/[0.04]">
              <span className="text-[11px] font-semibold text-white/70">{tactic}</span>
              <ConfidenceBadge confidence={avgConf} size="sm" />
            </div>

            {/* Techniques */}
            <div className="p-2 space-y-1.5">
              {techs.map((m) => (
                <button
                  key={m.techniqueId}
                  onClick={() => onTechniqueClick?.(m)}
                  className="w-full flex items-start gap-2 p-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                >
                  {m.confidence >= 0.8
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    : m.confidence >= 0.5
                    ? <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                    : <XCircle className="w-3 h-3 text-red-400/60 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono text-purple-300/80">{m.techniqueId}</code>
                      <span className="text-[10px] text-white/55 truncate">{m.techniqueName}</span>
                    </div>
                    <p className="text-[9px] text-white/30 mt-0.5 leading-relaxed line-clamp-2">
                      {m.explanation}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[8px] font-mono text-white/20">
                        {m.supportingEventIds.length} event{m.supportingEventIds.length !== 1 ? "s" : ""}
                      </span>
                      <ConfidenceBadge confidence={m.confidence} size="sm" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
