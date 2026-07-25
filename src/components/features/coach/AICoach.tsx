"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, Sparkles, Lightbulb, Search, TrendingUp, Loader2, WifiOff,
} from "lucide-react";
import { GlassCard } from "@/components/GlassCard";
import { useInvestigation } from "@/contexts/InvestigationContext";
import { CoachActionType } from "@/lib/geminiCoach";

// ─── Types ────────────────────────────────────────────────────────────────────

type CoachState = "idle" | "loading" | "success";
type ResponseSource = "gemini" | "offline";

interface CoachApiResponse {
  guidance: string;
  source: ResponseSource;
}

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: ResponseSource }) {
  if (source === "gemini") {
    return (
      <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-purple-400/20 bg-purple-400/[0.06]">
        <Sparkles className="w-2.5 h-2.5 text-purple-400" />
        <span className="text-[9px] font-mono text-purple-400">Gemini Mentor</span>
      </div>
    );
  }
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-full border border-slate-400/20 bg-slate-400/[0.06] cursor-help"
      title="Using built-in educational guidance while AI service is unavailable."
    >
      <WifiOff className="w-2.5 h-2.5 text-slate-400" />
      <span className="text-[9px] font-mono text-slate-400">Offline Mentor</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AICoach() {
  const { scenario, invState, drawer } = useInvestigation();
  const [state, setState] = useState<CoachState>("idle");
  const [guidance, setGuidance] = useState<string>("");
  const [source, setSource] = useState<ResponseSource>("gemini");

  async function requestGuidance(action: CoachActionType) {
    if (!scenario) return;

    setState("loading");
    setGuidance("");

    try {
      // Build context
      const context: Record<string, unknown> = {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        attackType: scenario.attackType,
        difficulty: scenario.difficulty,
      };

      if (action === "hint" || action === "next-step") {
        context.currentTimeline = invState.timeline.map((slot) => {
          const ev = scenario.evidence.find((e) => e.id === slot.evidenceId);
          return {
            evidenceId: slot.evidenceId,
            title: ev?.title ?? "Unknown",
            timestamp: ev?.timestamp ?? "",
          };
        });
        context.reviewedEvidence = invState.reviewedEvidenceIds
          .map((id) => {
            const ev = scenario.evidence.find((e) => e.id === id);
            if (!ev) return null;
            return { id: ev.id, title: ev.title, mitreTactic: ev.mitreTactic };
          })
          .filter(Boolean);
      }

      if (action === "explain-evidence" && drawer.evidenceId) {
        const ev = scenario.evidence.find((e) => e.id === drawer.evidenceId);
        if (ev) {
          context.selectedEvidenceId = ev.id;
          context.selectedEvidenceTitle = ev.title;
          context.selectedEvidenceDetails = [
            ev.description,
            `Source: ${ev.source}`,
            `Event ID: ${ev.eventId}`,
            `MITRE: ${ev.mitreTechnique} (${ev.mitreTactic})`,
          ].join("\n");
        }
      }

      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, context }),
      });

      const data: CoachApiResponse | { error: string } = await response.json();

      if (!response.ok || "error" in data) {
        // Should not happen — route always falls back to offline — but handle gracefully
        throw new Error("error" in data ? data.error : "Request failed");
      }

      const { guidance: text, source: src } = data as CoachApiResponse;
      setGuidance(text);
      setSource(src);
      setState("success");
    } catch (err) {
      // Last-resort client-side offline fallback (e.g. network down entirely)
      console.warn("[AICoach] Fetch failed, using client-side fallback:", err);
      setGuidance(
        `As a senior DFIR analyst, here's what to consider:\n\nFor a ${scenario.attackType} investigation, think about the complete attack kill chain — from initial access through to the final impact stage.\n\nLook for evidence that bridges each phase. Correlation between authentication logs, endpoint telemetry, and network flow data will reveal the attacker's path more clearly than any single source alone.\n\nConsider: what had to happen before the most obvious attack activity? Attackers often leave their most significant traces in the preparation phase.`
      );
      setSource("offline");
      setState("success");
    }
  }

  const actions = [
    {
      id: "hint" as const,
      label: "Need a Hint",
      icon: <Lightbulb className="w-3.5 h-3.5" />,
      description: "Get guidance on your next investigation step",
      disabled: false,
    },
    {
      id: "explain-evidence" as const,
      label: "Explain this Evidence",
      icon: <Search className="w-3.5 h-3.5" />,
      description: "Understand the currently selected evidence",
      disabled: !drawer.open || !drawer.evidenceId,
    },
    {
      id: "next-step" as const,
      label: "What should I investigate next?",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      description: "Get recommendations based on your progress",
      disabled: false,
    },
  ];

  return (
    <GlassCard glow className="p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-purple-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white/80">AI Investigation Coach</p>
          <p className="text-[10px] font-mono text-white/30">Powered by Gemini</p>
        </div>
        <div className="ml-auto">
          {state === "success" ? (
            <SourceBadge source={source} />
          ) : (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full border border-purple-400/20 bg-purple-400/[0.06]">
              <Sparkles className="w-2.5 h-2.5 text-purple-400" />
              <span className="text-[9px] font-mono text-purple-400">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 mb-4">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => requestGuidance(action.id)}
            disabled={state === "loading" || action.disabled}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
              action.disabled
                ? "border-white/[0.03] bg-white/[0.01] opacity-40 cursor-not-allowed"
                : state === "loading"
                ? "border-white/[0.06] bg-white/[0.02] opacity-50 cursor-wait"
                : "border-white/[0.06] bg-white/[0.02] hover:border-purple-500/30 hover:bg-purple-500/[0.05]"
            }`}
          >
            <span className="w-6 h-6 rounded-md bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-purple-400">
              {action.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/70">{action.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{action.description}</p>
              {action.disabled && (
                <p className="text-[9px] text-yellow-400/60 font-mono mt-1">
                  Open an evidence card first
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Response Area */}
      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/[0.05]"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <p className="text-xs text-white/60 font-mono">Mentor is thinking…</p>
            </div>
          </motion.div>
        )}

        {state === "success" && guidance && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03]"
          >
            <div className="flex items-center gap-2 mb-2">
              <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <p className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">
                {source === "gemini" ? "AI Mentor" : "DFIR Mentor"}
              </p>
            </div>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{guidance}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle hint */}
      {state === "idle" && (
        <p className="text-[10px] text-white/20 text-center font-mono mt-3">
          Ask the mentor for guidance anytime during your investigation
        </p>
      )}
    </GlassCard>
  );
}
