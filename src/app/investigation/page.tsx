"use client";

import { useEffect, useCallback, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

import { Navbar } from "@/components/Navbar";
import { ScenarioSidebar } from "@/components/features/scenario/ScenarioSidebar";
import { EvidenceWorkspace } from "@/components/features/evidence/EvidenceWorkspace";
import { TimelineColumn } from "@/components/features/investigation/TimelineColumn";
import { EvidenceDrawer } from "@/components/features/investigation/EvidenceDrawer";
import { EmptyState } from "@/components/features/investigation/EmptyState";
import { MitrePlaceholder } from "@/components/features/mitre/MitrePlaceholder";
import { AICoach } from "@/components/features/coach/AICoach";
import { GradientButton } from "@/components/GradientButton";
import { CyberBadge } from "@/components/CyberBadge";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { InvestigationProvider, useInvestigation } from "@/contexts/InvestigationContext";
import { InvestigationReview } from "@/components/features/review/InvestigationReview";
import {
  Save, FileText, ChevronRight, Terminal, Activity, Unlock, Bot,
} from "lucide-react";

// ─── Inner workspace ──────────────────────────────────────────────────────────

function InvestigationWorkspace() {
  const {
    scenario, loadScenario, addToTimeline, getEvidence,
    progressStats, showReview, closeReview, openReview, invState,
  } = useInvestigation();

  const searchParams = useSearchParams();
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) loadScenario(id);
  }, [searchParams, loadScenario]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.data.current?.evidenceId as string | undefined;
    setActiveDragId(id ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const evidenceId = event.active.data.current?.evidenceId as string | undefined;
    const overId = event.over?.id;
    // Drop onto the timeline drop zone (or any id that isn't the source workspace)
    if (evidenceId && overId && overId !== "evidence-workspace") {
      addToTimeline(evidenceId);
    }
  }, [addToTimeline]);

  // No scenario and no id param → show empty state
  if (!scenario && !searchParams.get("id")) {
    return <EmptyState variant="no-scenario" />;
  }

  const canReveal = invState.timeline.length > 0;

  return (
    <>
      {/* Investigation Review — full-screen overlay */}
      {showReview && <InvestigationReview onClose={closeReview} />}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* ── Status bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative z-10 mt-16 border-b border-white/[0.06] bg-black/40 backdrop-blur-sm px-6 py-2.5 flex-shrink-0"
        >
          <div className="flex items-center justify-between">
            {/* Left: breadcrumb + status */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-white/30 font-mono flex-shrink-0">Investigation</span>
              <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
              <span className="text-xs font-mono text-purple-400 truncate max-w-[180px]">
                {scenario?.title ?? "Loading\u2026"}
              </span>
              <div className="hidden sm:flex items-center gap-2 ml-2">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-400/[0.08] border border-yellow-400/20">
                  <Activity className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] font-mono text-yellow-400">In Progress</span>
                </div>
                {scenario && (
                  <CyberBadge
                    label={scenario.difficulty}
                    variant={
                      scenario.difficulty === "Beginner" ? "green"
                      : scenario.difficulty === "Intermediate" ? "blue"
                      : scenario.difficulty === "Advanced" ? "yellow"
                      : "red"
                    }
                  />
                )}
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <span className="text-[10px] font-mono text-white/30">Progress</span>
                <span className="text-[10px] font-mono text-purple-400 font-semibold">
                  {progressStats.overallPct}%
                </span>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 border border-white/[0.06] hover:text-white hover:border-white/10 transition-colors">
                <Save className="w-3 h-3" />
                <span className="hidden sm:inline">Saved</span>
              </button>
              {canReveal && (
                <button
                  onClick={openReview}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-purple-400 border border-purple-500/30 bg-purple-500/[0.07] hover:bg-purple-500/[0.14] hover:border-purple-500/50 transition-all"
                >
                  <Unlock className="w-3 h-3" />
                  Reveal Investigation
                </button>
              )}
              <GradientButton size="sm">
                <FileText className="w-3 h-3" />
                <span className="hidden sm:inline">Report</span>
              </GradientButton>
            </div>
          </div>
        </motion.div>

        {/* ── 3-panel layout ── */}
        <div
          className="relative z-10 flex flex-1 overflow-hidden"
          style={{ height: "calc(100vh - 160px)" }}
        >
          {/* Left sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="hidden lg:flex w-72 flex-shrink-0 border-r border-white/[0.05] overflow-y-auto p-4 bg-black/20"
          >
            <ScenarioSidebar />
          </motion.div>

          {/* Center: Evidence Workspace */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="flex-1 overflow-y-auto p-5 min-w-0"
          >
            {scenario ? (
              <EvidenceWorkspace />
            ) : (
              <div className="flex flex-col gap-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            )}
          </motion.div>

          {/* Right sidebar: Timeline */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="hidden xl:flex w-80 flex-shrink-0 border-l border-white/[0.05] overflow-y-auto p-4 bg-black/20"
            id="timeline-droppable"
          >
            <div className="w-full">
              <TimelineColumn />
            </div>
          </motion.div>
        </div>

        {/* ── Bottom panels grid ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative z-10 border-t border-white/[0.06] bg-black/40 backdrop-blur-sm flex-shrink-0"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.02]">
            {/* Left: AI Coach */}
            <div className="bg-[#050507]">
              <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/[0.04]">
                <Bot className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-semibold text-white/70">AI Investigation Coach</span>
                <span className="ml-auto text-[9px] font-mono text-purple-400/60">Powered by Gemini</span>
              </div>
              <div className="px-6 py-4">
                <AICoach />
              </div>
            </div>

            {/* Right: MITRE ATT&CK */}
            <div className="bg-[#050507]">
              <div className="flex items-center gap-2 px-6 py-2.5 border-b border-white/[0.04]">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs font-semibold text-white/70">MITRE ATT&CK</span>
                {scenario && (
                  <CyberBadge label={`${scenario.mitreMappings.length} techniques`} variant="purple" />
                )}
              </div>
              <div className="px-6 py-4">
                <MitrePlaceholder />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Evidence Drawer */}
        <EvidenceDrawer />

        {/* Drag ghost */}
        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div className="rounded-xl border border-purple-500/50 bg-[#0a0a0f] shadow-[0_0_30px_rgba(139,92,246,0.3)] p-3 w-72 opacity-90 pointer-events-none">
              <p className="text-xs font-medium text-white/80 truncate">
                {getEvidence(activeDragId)?.title}
              </p>
              <p className="text-[10px] font-mono text-purple-400/60 mt-0.5">
                {getEvidence(activeDragId)?.mitreTechnique}
              </p>
            </div>
          ) : null}
        </DragOverlay>

      </DndContext>
    </>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function InvestigationPageInner() {
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get("id") ?? undefined;

  return (
    <InvestigationProvider initialScenarioId={scenarioId}>
      <div className="min-h-screen bg-[#050507] text-white flex flex-col overflow-hidden">
        <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-0 left-1/3 w-[500px] h-[300px] bg-purple-900/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-blue-900/8 rounded-full blur-[80px]" />
        </div>
        <Navbar />
        <InvestigationWorkspace />
      </div>
    </InvestigationProvider>
  );
}

export default function InvestigationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050507] text-white flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 animate-pulse" />
            <p className="text-xs text-white/30 font-mono">Loading investigation&hellip;</p>
          </div>
        </div>
      }
    >
      <InvestigationPageInner />
    </Suspense>
  );
}
