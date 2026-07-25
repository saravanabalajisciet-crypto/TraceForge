"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, XCircle, Shield, Grid3X3,
  Globe, FileText, TrendingUp, Lightbulb, ChevronLeft,
  Award, Target, Eye, Clock, Network, Server, Hash,
  User, Folder, BookKey, Tag, RotateCcw, ArrowRight, Bot, Loader2, Sparkles, WifiOff,
} from "lucide-react";
import Link from "next/link";

import { GlassCard } from "@/components/GlassCard";
import { GradientButton } from "@/components/GradientButton";
import { CyberBadge } from "@/components/CyberBadge";
import { useInvestigation } from "@/contexts/InvestigationContext";
import { analyzeInvestigation, InvestigationAnalysisResult, TimelineEventStatus, MitreCoverageStatus } from "@/lib/investigationAnalysis";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke="url(#scoreGrad)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
      />
      <defs>
        <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function AnimatedBar({ value, color = "from-purple-500 to-blue-500", delay = 0 }: { value: number; color?: string; delay?: number }) {
  return (
    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
      <motion.div
        className={`h-full rounded-full bg-gradient-to-r ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, delay, ease: "easeOut" }}
      />
    </div>
  );
}

const timelineStatusConfig: Record<TimelineEventStatus, { icon: React.ReactNode; label: string; rowClass: string; dotClass: string }> = {
  correct: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
    label: "Correctly identified",
    rowClass: "border-emerald-500/15 bg-emerald-500/[0.03]",
    dotClass: "bg-emerald-500",
  },
  "out-of-order": {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
    label: "Wrong order",
    rowClass: "border-yellow-500/15 bg-yellow-500/[0.03]",
    dotClass: "bg-yellow-500",
  },
  missed: {
    icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />,
    label: "Not identified",
    rowClass: "border-red-500/15 bg-red-500/[0.03]",
    dotClass: "bg-red-500",
  },
};

const mitreCoverageConfig: Record<MitreCoverageStatus, { icon: React.ReactNode; color: string; label: string }> = {
  covered: {
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    color: "border-emerald-500/20 bg-emerald-500/[0.06]",
    label: "Covered",
  },
  partial: {
    icon: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
    color: "border-yellow-500/20 bg-yellow-500/[0.06]",
    label: "Partial",
  },
  missed: {
    icon: <XCircle className="w-4 h-4 text-red-400" />,
    color: "border-red-500/20 bg-red-500/[0.06]",
    label: "Missed",
  },
};

const iocIcons: Record<string, React.ReactNode> = {
  ip: <Globe className="w-3.5 h-3.5" />,
  domain: <Network className="w-3.5 h-3.5" />,
  url: <Globe className="w-3.5 h-3.5" />,
  hash: <Hash className="w-3.5 h-3.5" />,
  user: <User className="w-3.5 h-3.5" />,
  host: <Server className="w-3.5 h-3.5" />,
  file: <Folder className="w-3.5 h-3.5" />,
  registry: <BookKey className="w-3.5 h-3.5" />,
  event: <Tag className="w-3.5 h-3.5" />,
};

const ratingConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Excellent: { color: "text-emerald-400", bg: "bg-emerald-500/[0.08]", border: "border-emerald-500/20", icon: <Award className="w-5 h-5" /> },
  Good: { color: "text-blue-400", bg: "bg-blue-500/[0.08]", border: "border-blue-500/20", icon: <Target className="w-5 h-5" /> },
  "Needs Improvement": { color: "text-orange-400", bg: "bg-orange-500/[0.08]", border: "border-orange-500/20", icon: <TrendingUp className="w-5 h-5" /> },
};

const recSeverityConfig = {
  critical: { icon: <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />, label: "Critical" },
  high: { icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />, label: "High" },
  medium: { icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />, label: "Medium" },
  low: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />, label: "Low" },
};

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, icon, children, className }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <GlassCard className={cn("p-6", className)}>
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
          {icon}
        </span>
        <h2 className="text-sm font-semibold text-white/80">{title}</h2>
      </div>
      {children}
    </GlassCard>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InvestigationReview({ onClose }: { onClose: () => void }) {
  const { scenario, invState, resetInvestigation } = useInvestigation();
  const [coachState, setCoachState] = useState<"idle" | "loading" | "success">("idle");
  const [coachGuidance, setCoachGuidance] = useState<string>("");
  const [coachSource, setCoachSource] = useState<"gemini" | "offline">("gemini");


  const result: InvestigationAnalysisResult | null = useMemo(() => {
    if (!scenario) return null;
    return analyzeInvestigation(scenario, invState);
  }, [scenario, invState]);

  async function requestCoachFeedback() {
    if (!scenario || !result) return;

    setCoachState("loading");
    setCoachGuidance("");

    const missedEvents = result.timelineResults
      .filter((r) => r.status === "missed")
      .map((r) => r.title);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "explain-mistakes",
          context: {
            scenarioId: scenario.id,
            scenarioTitle: scenario.title,
            attackType: scenario.attackType,
            difficulty: scenario.difficulty,
            investigationSummary: result.investigationSummary,
            timelineAccuracy: result.timelineAccuracy,
            mitreScore: result.mitreScore,
            missedEvents,
          },
        }),
      });

      const data: { guidance: string; source: "gemini" | "offline" } | { error: string } =
        await response.json();

      if (!response.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Request failed");
      }

      setCoachGuidance(data.guidance);
      setCoachSource(data.source);
      setCoachState("success");
    } catch (err) {
      // Client-side last-resort fallback — network completely down
      // Run offline logic inline (no dynamic import — avoids chunk load errors)
      console.warn("[InvestigationReview] Fetch failed, using inline fallback:", err);

      const timelineAccuracy = result.timelineAccuracy ?? 0;
      const mitreScore = result.mitreScore ?? 0;

      let fallback = "";

      if (timelineAccuracy >= 85) {
        fallback += `Timeline Reconstruction — Strong (${timelineAccuracy}%)\nYour chronological ordering was accurate. Focus on causal logic: each event should enable the next.\n\n`;
      } else if (timelineAccuracy >= 60) {
        fallback += `Timeline Reconstruction — Partial (${timelineAccuracy}%)\nSome events were out of sequence. Use causal dependency mapping, not just timestamps. Ask: what had to happen first for this event to occur?\n\n`;
      } else {
        fallback += `Timeline Reconstruction — Needs Work (${timelineAccuracy}%)\nBuild the timeline by tracing attacker dependencies. An attacker cannot encrypt files before gaining access to the file server — use that logic to anchor your ordering.\n\n`;
      }

      if (mitreScore >= 85) {
        fallback += `MITRE ATT&CK Coverage — Excellent (${mitreScore}%)\nYou identified nearly all techniques. This skill lets you communicate attacker behaviour to both technical and executive audiences.\n\n`;
      } else if (mitreScore >= 60) {
        fallback += `MITRE ATT&CK Coverage — Partial (${mitreScore}%)\nYou captured the major tactics but missed some technique detail. Focus on the difference between a tactic (goal) and a technique (method) — e.g. Credential Access vs. T1003.001 LSASS Memory Dump.\n\n`;
      } else {
        fallback += `MITRE ATT&CK Coverage — Incomplete (${mitreScore}%)\nReview the MITRE ATT&CK Enterprise matrix for ${scenario.attackType} patterns. Study each tactic and identify which evidence source would record its presence.\n\n`;
      }

      fallback += `Every investigation you complete builds the pattern recognition that makes experienced analysts effective. Keep investigating.`;

      setCoachGuidance(fallback);
      setCoachSource("offline");
      setCoachState("success");
    }
  }

  if (!result || !scenario) return null;

  const rating = ratingConfig[result.rating];

  return (
    <AnimatePresence>
      <motion.div
        key="review-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-[#050507]/95 backdrop-blur-md overflow-y-auto"
      >
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-900/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-10">

          {/* ── Header ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-purple-400/60 uppercase tracking-widest">
                  Investigation Review
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white">{scenario.title}</h1>
              <p className="text-sm text-white/40 mt-1 font-mono">{scenario.codename} · {scenario.difficulty} · {scenario.attackType}</p>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/50 hover:text-white hover:border-white/15 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Investigation
            </button>
          </motion.div>

          {/* ── Score Hero ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6"
          >
            <GlassCard glow className="p-6">
              <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8">
                {/* Score ring */}
                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  <div className="relative">
                    <ScoreRing score={result.overallScore} size={112} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-white">{result.overallScore}</span>
                      <span className="text-[10px] font-mono text-white/30">/100</span>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl border", rating.bg, rating.border)}>
                    <span className={rating.color}>{rating.icon}</span>
                    <span className={cn("text-sm font-semibold", rating.color)}>{result.rating}</span>
                  </div>
                </div>

                {/* Score breakdown */}
                <div className="flex-1 w-full grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { label: "Timeline Accuracy", value: result.timelineAccuracy, color: "from-purple-500 to-blue-500", icon: <Clock className="w-3.5 h-3.5" /> },
                    { label: "Threat Coverage", value: result.threatCoverage, color: "from-blue-500 to-cyan-500", icon: <Shield className="w-3.5 h-3.5" /> },
                    { label: "IOC Recognition", value: result.iocRecognition, color: "from-emerald-500 to-teal-500", icon: <Eye className="w-3.5 h-3.5" /> },
                    { label: "Completeness", value: result.investigationCompleteness, color: "from-orange-500 to-yellow-500", icon: <Target className="w-3.5 h-3.5" /> },
                  ].map((metric, i) => (
                    <div key={metric.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-center gap-1.5 text-white/40 mb-3">
                        {metric.icon}
                        <span className="text-[10px] font-mono uppercase tracking-widest">{metric.label}</span>
                      </div>
                      <div className="flex items-end justify-between mb-2">
                        <span className="text-2xl font-bold text-white">{metric.value}</span>
                        <span className="text-xs text-white/30 font-mono mb-1">/100</span>
                      </div>
                      <AnimatedBar value={metric.value} color={metric.color} delay={0.3 + i * 0.1} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div className="mt-5 pt-5 border-t border-white/[0.05] flex flex-wrap gap-6">
                {[
                  { label: "Correct Events", value: String(result.correctCount), color: "text-emerald-400" },
                  { label: "Out of Order", value: String(result.outOfOrderCount), color: "text-yellow-400" },
                  { label: "Missed Events", value: String(result.missedCount), color: "text-red-400" },
                  { label: "MITRE Tactics", value: `${result.mitreCoverage.filter(m => m.status === "covered").length}/${result.mitreCoverage.length}`, color: "text-purple-400" },
                  { label: "IOC Categories", value: String(result.iocSummary.length), color: "text-blue-400" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className={cn("text-lg font-bold font-mono", stat.color)}>{stat.value}</p>
                    <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Main grid ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            {/* Left column — wide */}
            <div className="xl:col-span-2 flex flex-col gap-6">

              {/* ── Investigation Summary ── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Section title="Investigation Summary" icon={<FileText className="w-4 h-4" />}>
                  <p className="text-sm text-white/60 leading-relaxed">{result.investigationSummary}</p>
                </Section>
              </motion.div>

              {/* ── Timeline Review ── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Section title="Investigation Timeline Review" icon={<Clock className="w-4 h-4" />}>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-white/[0.05]">
                    {(["correct", "out-of-order", "missed"] as TimelineEventStatus[]).map((s) => (
                      <div key={s} className="flex items-center gap-1.5">
                        {timelineStatusConfig[s].icon}
                        <span className="text-[10px] text-white/40 font-mono">{timelineStatusConfig[s].label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Timeline items */}
                  <div className="relative flex flex-col gap-0">
                    <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/[0.05]" />
                    {result.timelineResults.map((item, i) => {
                      const cfg = timelineStatusConfig[item.status];
                      return (
                        <motion.div
                          key={item.evidenceId}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.04 }}
                          className="relative flex items-start gap-3 pb-3"
                        >
                          <div className={cn("relative z-10 w-2 h-2 rounded-full mt-2 flex-shrink-0 ml-2.5 ring-2 ring-[#050507]", cfg.dotClass)} />
                          <div className={cn("flex-1 rounded-xl border p-3 flex items-start justify-between gap-3", cfg.rowClass)}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {cfg.icon}
                                <p className="text-xs font-medium text-white/80 truncate">{item.title}</p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-mono text-white/30">{formatTimestamp(item.timestamp)}</span>
                                <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400/80 border border-purple-500/15">
                                  {item.mitreTechnique}
                                </span>
                                <span className="text-[10px] text-white/30 font-mono">{item.mitreTactic}</span>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {item.studentPosition !== null ? (
                                <span className="text-[10px] font-mono text-white/40">
                                  Step {item.studentPosition + 1}
                                  {item.status === "out-of-order" && (
                                    <span className="text-yellow-400/70 ml-1">(expected {item.correctPosition + 1})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono text-red-400/60">Not placed</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </Section>
              </motion.div>

              {/* ── IOC Summary ── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Section title="IOC Summary — Threat Intelligence" icon={<Globe className="w-4 h-4" />}>
                  {result.iocSummary.length === 0 ? (
                    <p className="text-sm text-white/30 font-mono">No IOCs detected in this scenario.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {result.iocSummary.map((cat) => (
                        <div key={cat.label} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-purple-400">{iocIcons[cat.icon] ?? <Globe className="w-3.5 h-3.5" />}</span>
                            <p className="text-[11px] font-semibold text-white/70">{cat.label}</p>
                            <span className="ml-auto px-1.5 py-0.5 text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/15 rounded">
                              {cat.items.length}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {cat.items.slice(0, 5).map((item, i) => (
                              <code key={i} className="text-[10px] font-mono text-white/50 bg-black/30 rounded px-2 py-1 break-all">
                                {item}
                              </code>
                            ))}
                            {cat.items.length > 5 && (
                              <span className="text-[10px] text-white/25 font-mono">+{cat.items.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </motion.div>
            </div>

            {/* Right column */}
            <div className="flex flex-col gap-6">

              {/* ── MITRE ATT&CK Coverage ── */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}>
                <Section title="MITRE ATT&CK Coverage" icon={<Grid3X3 className="w-4 h-4" />}>
                  <div className="flex flex-col gap-2.5">
                    {result.mitreCoverage.map((tactic, i) => {
                      const cfg = mitreCoverageConfig[tactic.status];
                      return (
                        <motion.div
                          key={tactic.tactic}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.06 }}
                          className={cn("rounded-xl border p-3", cfg.color)}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {cfg.icon}
                              <span className="text-xs font-medium text-white/80">{tactic.tactic}</span>
                            </div>
                            <span className="text-[9px] font-mono text-white/30">{cfg.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tactic.techniques.map((tech, ti) => (
                              <span
                                key={tech}
                                className={cn(
                                  "px-1.5 py-0.5 text-[9px] font-mono rounded border",
                                  tactic.coveredTechniques.includes(tech)
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-400/70 border-red-500/20"
                                )}
                                title={tactic.techniqueNames[ti]}
                              >
                                {tech}
                              </span>
                            ))}
                          </div>
                          {tactic.missedTechniques.length > 0 && (
                            <p className="text-[9px] text-red-400/50 font-mono mt-1.5">
                              Missed: {tactic.missedTechniques.join(", ")}
                            </p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Coverage Score</span>
                      <span className="text-sm font-bold text-purple-400">{result.mitreScore}%</span>
                    </div>
                    <AnimatedBar value={result.mitreScore} delay={0.5} />
                  </div>
                </Section>
              </motion.div>

              {/* ── Recommendations ── */}
              <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
                <Section title="Recommendations" icon={<Lightbulb className="w-4 h-4" />}>
                  <div className="flex flex-col gap-2.5">
                    {result.derivedRecommendations.map((rec, i) => {
                      // Map to severity based on position
                      const sev = i === 0 || i === 1 ? "critical" : i === 2 || i === 3 ? "high" : i === 4 ? "medium" : "low";
                      const cfg = recSeverityConfig[sev as keyof typeof recSeverityConfig];
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 + i * 0.05 }}
                          className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]"
                        >
                          {cfg.icon}
                          <p className="text-xs text-white/60 leading-relaxed">{rec}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                </Section>
              </motion.div>

              {/* ── Actions ── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                <GlassCard className="p-5 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-white/50 mb-1">AI Coach Feedback</p>

                  {coachState === "idle" && (
                    <GradientButton
                      onClick={requestCoachFeedback}
                      className="w-full justify-center"
                      size="sm"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      Explain My Mistakes
                    </GradientButton>
                  )}

                  {coachState === "loading" && (
                    <div className="p-4 rounded-lg border border-purple-500/20 bg-purple-500/[0.05]">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        <p className="text-xs text-white/60 font-mono">Mentor analyzing…</p>
                      </div>
                    </div>
                  )}

                  {coachState === "success" && coachGuidance && (
                    <div className="p-4 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] max-h-[300px] overflow-y-auto">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <p className="text-[10px] font-mono text-emerald-400/70 uppercase tracking-widest">
                          {coachSource === "gemini" ? "AI Mentor Feedback" : "DFIR Mentor Feedback"}
                        </p>
                        <div className="ml-auto flex-shrink-0">
                          {coachSource === "gemini" ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-purple-400/20 bg-purple-400/[0.06]">
                              <Sparkles className="w-2 h-2 text-purple-400" />
                              <span className="text-[8px] font-mono text-purple-400">Gemini</span>
                            </div>
                          ) : (
                            <div
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-slate-400/20 bg-slate-400/[0.06] cursor-help"
                              title="Using built-in educational guidance while AI service is unavailable."
                            >
                              <WifiOff className="w-2 h-2 text-slate-400" />
                              <span className="text-[8px] font-mono text-slate-400">Offline Mentor</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                        {coachGuidance}
                      </p>
                    </div>
                  )}
                </GlassCard>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                <GlassCard className="p-5 flex flex-col gap-3">
                  <p className="text-xs font-semibold text-white/50 mb-1">Next Steps</p>
                  <button
                    onClick={onClose}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-white/70 hover:text-white hover:border-white/15 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Continue Investigation
                  </button>
                  <button
                    onClick={resetInvestigation}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] text-sm text-orange-400/70 hover:text-orange-400 hover:border-orange-500/40 transition-all"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restart Investigation
                  </button>
                  <Link href="/scenarios" className="w-full">
                    <GradientButton size="sm" className="w-full justify-center">
                      <ArrowRight className="w-4 h-4" />
                      Next Scenario
                    </GradientButton>
                  </Link>
                </GlassCard>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
