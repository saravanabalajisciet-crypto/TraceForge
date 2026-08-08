"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Clock, AlertTriangle, ChevronLeft, Bot,
  Loader2, Sparkles, WifiOff, Network, Target, Globe,
} from "lucide-react";
import Link from "next/link";

import { Navbar } from "@/components/Navbar";
import { GlassCard } from "@/components/GlassCard";
import { ReconstructedTimeline } from "@/components/features/v2/ReconstructedTimeline";
import { AttackChainView } from "@/components/features/v2/AttackChainView";
import { MitreNavigator } from "@/components/features/v2/MitreNavigator";
import { IocPanel } from "@/components/features/v2/IocPanel";
import { EventDetailPanel } from "@/components/features/v2/EventDetailPanel";
import { ConfidenceBadge } from "@/components/features/v2/ConfidenceBadge";
import { LanguageSwitcher, useLanguage } from "@/components/features/v2/LanguageSwitcher";
import { ReconstructionResult, SecurityEvent, AttackStage } from "@/types/v2";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

type Tab = "timeline" | "chain" | "mitre" | "ioc";

export default function V2InvestigationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  void router; // reserved for future navigation

  const [reconstruction, setReconstruction] = useState<ReconstructionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("chain");
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | undefined>();

  // Language
  const language = useLanguage();
  const [translatedSummary, setTranslatedSummary] = useState<string>("");
  const [translating, setTranslating] = useState(false);
  void translating; // shown via spinner in future enhancement

  // AI Mentor
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mentorState, setMentorState] = useState<"idle" | "loading" | "done">("idle");
  const [mentorText, setMentorText] = useState("");
  const [mentorSource, setMentorSource] = useState<"gemini" | "offline">("offline");

  // ── Fetch reconstruction ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    fetch(`/api/v2/investigation/${id}`)
      .then((r) => r.json())
      .then((data: { error?: string; reconstruction?: ReconstructionResult }) => {
        if (data.error) { setError(data.error); return; }
        if (data.reconstruction) setReconstruction(data.reconstruction);
      })
      .catch(() => setError("Failed to load investigation."))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Translate summary when language changes ───────────────────────────────
  useEffect(() => {
    if (!reconstruction || language === "en") {
      setTranslatedSummary("");
      return;
    }
    let cancelled = false;
    setTranslating(true);
    fetch(`/api/v2/investigation/${id}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: reconstruction.attackStory.summary,
        language,
        context: "summary",
      }),
    })
      .then((r) => r.json())
      .then((data: { translated?: string }) => { if (!cancelled) setTranslatedSummary(data.translated ?? ""); })
      .catch(() => { if (!cancelled) setTranslatedSummary(""); })
      .finally(() => { if (!cancelled) setTranslating(false); });
    return () => { cancelled = true; };
  }, [reconstruction, language, id]);

  // ── AI Mentor ─────────────────────────────────────────────────────────────
  async function askMentor(action: "hint" | "next-step" | "summarize-investigation") {
    if (!reconstruction) return;
    setMentorOpen(true);
    setMentorState("loading");
    setMentorText("");
    try {
      const res = await fetch(`/api/v2/investigation/${id}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json() as { guidance?: string; source?: "gemini" | "offline" };
      setMentorText(data.guidance ?? "Unable to get guidance.");
      setMentorSource(data.source ?? "offline");
      setMentorState("done");
    } catch {
      setMentorText("Mentor is temporarily unavailable.");
      setMentorSource("offline");
      setMentorState("done");
    }
  }

  // ── Loading / Error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          <p className="text-xs text-white/30 font-mono">Loading investigation…</p>
        </div>
      </div>
    );
  }

  if (error || !reconstruction) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
          <AlertTriangle className="w-8 h-8 text-orange-400" />
          <p className="text-sm text-white/60">{error || "Investigation not found."}</p>
          <Link href="/investigate/upload"
            className="text-xs font-mono text-purple-400 hover:text-purple-300 transition-colors">
            ← Upload a new dataset
          </Link>
        </div>
      </div>
    );
  }

  const r = reconstruction;
  const suspiciousIds = new Set(
    r.events
      .filter((e) => e.severity === "critical" || e.severity === "high")
      .map((e) => e.id)
  );

  const displayedSummary = (language !== "en" && translatedSummary) ? translatedSummary : r.attackStory.summary;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "chain",    label: "Attack Chain",  icon: <Shield className="w-3.5 h-3.5" />,  count: r.attackStory.stages.length },
    { id: "timeline", label: "Timeline",      icon: <Clock className="w-3.5 h-3.5" />,   count: r.events.length },
    { id: "mitre",    label: "MITRE ATT&CK",  icon: <Target className="w-3.5 h-3.5" />,  count: r.mitreMappings.length },
    { id: "ioc",      label: "IOCs",          icon: <Globe className="w-3.5 h-3.5" />,   count: r.iocs.length },
  ];

  return (
    <div className="min-h-screen bg-[#050507] text-white flex flex-col overflow-hidden">
      {/* Glows */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-purple-900/15 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-blue-900/8 rounded-full blur-[80px]" />
      </div>

      <Navbar />

      {/* Status bar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mt-16 border-b border-white/[0.06] bg-black/40 backdrop-blur-sm px-6 py-2.5 flex-shrink-0"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/investigate/upload"
              className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-3 h-3" />
              Upload
            </Link>
            <span className="text-white/10">/</span>
            <span className="text-[10px] font-mono text-purple-400 truncate max-w-[200px]">
              {r.attackStory.stages[0]?.name ?? "Investigation"}
              {r.attackStory.stages.length > 1 && ` → ${r.attackStory.stages[r.attackStory.stages.length - 1]?.name}`}
            </span>
            <ConfidenceBadge confidence={r.confidenceSummary.overall / 100} size="sm" />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded border border-white/[0.06] bg-white/[0.02]">
              <span className="text-[9px] font-mono text-white/30">{r.stats.totalEvents} events</span>
              <span className="text-white/10">·</span>
              <span className="text-[9px] font-mono text-orange-400">{r.stats.suspiciousEvents} suspicious</span>
            </div>
            <button
              onClick={() => askMentor("hint")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-purple-400 border border-purple-500/25 bg-purple-500/[0.06] hover:bg-purple-500/[0.12] transition-all"
            >
              <Bot className="w-3 h-3" />
              <span className="hidden sm:inline">Ask Mentor</span>
            </button>
            <LanguageSwitcher />
          </div>
        </div>
      </motion.div>

      {/* Main layout */}
      <div className="relative z-10 flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 104px)" }}>

        {/* Left: tabs + content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex-shrink-0 border-b border-white/[0.05] bg-black/20 px-4 flex items-center gap-1 h-10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/25"
                    : "text-white/40 hover:text-white/60"
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "text-[9px] font-mono rounded-full px-1",
                    activeTab === tab.id ? "bg-purple-500/20 text-purple-400" : "text-white/25"
                  )}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {/* ── Attack Chain ── */}
                {activeTab === "chain" && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-purple-400" />
                        Reconstructed Attack Chain
                      </h2>
                      <AttackChainView
                        attackStory={{ ...r.attackStory, summary: displayedSummary }}
                        onStageClick={(stage: AttackStage) => {
                          setSelectedStage(stage.name);
                          setActiveTab("timeline");
                        }}
                        selectedStage={selectedStage}
                      />
                    </div>

                    {/* Incident stats card */}
                    <GlassCard className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Network className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-xs font-semibold text-white/60">Incident Statistics</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: "Start",    value: r.timeRange.start ? formatTimestamp(r.timeRange.start).split(" ")[0] : "N/A" },
                          { label: "Duration", value: r.timeRange.durationMs > 0 ? `${Math.round(r.timeRange.durationMs / 60000)}m` : "<1m" },
                          { label: "Hosts",    value: String(r.stats.uniqueHosts) },
                          { label: "Users",    value: String(r.stats.uniqueUsers) },
                          { label: "IPs",      value: String(r.stats.uniqueIps) },
                          { label: "IOCs",     value: String(r.iocs.length) },
                        ].map((s) => (
                          <div key={s.label} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                            <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest">{s.label}</p>
                            <p className="text-sm font-bold text-white/70 font-mono mt-0.5">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    </GlassCard>
                  </div>
                )}

                {/* ── Timeline ── */}
                {activeTab === "timeline" && (
                  <div>
                    <h2 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      Reconstructed Timeline — {r.events.length} events
                    </h2>
                    <ReconstructedTimeline
                      events={r.events}
                      relationships={r.relationships}
                      suspiciousIds={suspiciousIds}
                      onEventClick={setSelectedEvent}
                      selectedEventId={selectedEvent?.id}
                    />
                  </div>
                )}

                {/* ── MITRE ── */}
                {activeTab === "mitre" && (
                  <div>
                    <h2 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-2">
                      <Target className="w-3.5 h-3.5 text-purple-400" />
                      MITRE ATT&CK — {r.mitreMappings.length} techniques inferred
                    </h2>
                    <MitreNavigator
                      mappings={r.mitreMappings}
                      onTechniqueClick={(m) => {
                        const evId = m.supportingEventIds[0];
                        const ev = evId ? r.events.find((e) => e.id === evId) : undefined;
                        if (ev) { setSelectedEvent(ev); setActiveTab("timeline"); }
                      }}
                    />
                  </div>
                )}

                {/* ── IOCs ── */}
                {activeTab === "ioc" && (
                  <div>
                    <h2 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5 text-purple-400" />
                      Extracted Indicators — {r.iocs.length} total
                    </h2>
                    <IocPanel
                      iocs={r.iocs}
                      onIocClick={(ioc) => {
                        const evId = ioc.sourceEventIds[0];
                        const ev = evId ? r.events.find((e) => e.id === evId) : undefined;
                        if (ev) { setSelectedEvent(ev); setActiveTab("timeline"); }
                      }}
                    />
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Right panel: Event detail or AI Mentor */}
        <AnimatePresence>
          {(selectedEvent || mentorOpen) && (
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="hidden lg:flex w-80 flex-shrink-0 border-l border-white/[0.05] bg-black/20 flex-col overflow-hidden"
            >
              {selectedEvent ? (
                <EventDetailPanel
                  event={selectedEvent}
                  reconstruction={r}
                  onClose={() => setSelectedEvent(null)}
                />
              ) : mentorOpen ? (
                <div className="h-full flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <Bot className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-semibold text-white/70">AI Mentor</span>
                    </div>
                    <button
                      onClick={() => setMentorOpen(false)}
                      className="text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors"
                    >
                      close
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {mentorState === "loading" && (
                      <div className="flex items-center gap-2 py-4 justify-center">
                        <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        <span className="text-xs text-white/40 font-mono">Thinking…</span>
                      </div>
                    )}
                    {mentorState === "done" && mentorText && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5">
                          {mentorSource === "gemini"
                            ? <span className="flex items-center gap-1 text-[9px] font-mono text-purple-400/60"><Sparkles className="w-2.5 h-2.5" />Gemini Mentor</span>
                            : <span className="flex items-center gap-1 text-[9px] font-mono text-slate-400/60"><WifiOff className="w-2.5 h-2.5" />Offline Mentor</span>
                          }
                        </div>
                        <p className="text-sm text-white/65 leading-relaxed whitespace-pre-wrap">{mentorText}</p>
                        <div className="flex flex-col gap-2 pt-3 border-t border-white/[0.04]">
                          {(["hint", "next-step", "summarize-investigation"] as const).map((a) => (
                            <button
                              key={a}
                              onClick={() => askMentor(a)}
                              className="px-3 py-1.5 text-[10px] font-mono text-white/40 border border-white/[0.06] rounded-lg hover:text-purple-400 hover:border-purple-500/25 transition-all text-left"
                            >
                              {a === "hint" ? "Give me a hint" : a === "next-step" ? "What next?" : "Summarize incident"}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
