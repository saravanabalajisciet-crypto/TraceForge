"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { FileSearch } from "lucide-react";
import { EvidenceCard } from "@/components/features/investigation/EvidenceCard";
import { InvestigationToolbar, EvidenceFilters } from "@/components/features/investigation/InvestigationToolbar";
import { CardSkeleton } from "@/components/LoadingSkeleton";
import { useInvestigation } from "@/contexts/InvestigationContext";

export function EvidenceWorkspace() {
  const { scenario } = useInvestigation();

  const { setNodeRef, isOver } = useDroppable({ id: "evidence-workspace" });

  const [filters, setFilters] = useState<EvidenceFilters>({
    search: "",
    severity: "all",
    category: "all",
    mitreTactic: "all",
  });

  // Keyboard arrow navigation
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);

  const mitreTactics = useMemo(() => {
    if (!scenario) return [];
    return Array.from(new Set(scenario.evidence.map((e) => e.mitreTactic))).sort();
  }, [scenario]);

  const filtered = useMemo(() => {
    if (!scenario) return [];
    return scenario.evidence.filter((e) => {
      const q = filters.search.toLowerCase();
      if (q && !e.title.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q) && !e.eventId.toLowerCase().includes(q)) return false;
      if (filters.severity !== "all" && e.severity !== filters.severity) return false;
      if (filters.category !== "all" && e.category !== filters.category) return false;
      if (filters.mitreTactic !== "all" && e.mitreTactic !== filters.mitreTactic) return false;
      return true;
    });
  }, [scenario, filters]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    }
  }, [filtered.length]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!scenario) {
    return (
      <div className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Toolbar */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <FileSearch className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white/80">Evidence Workspace</h3>
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded">
            {scenario.evidence.length} items
          </span>
        </div>
        <InvestigationToolbar
          filters={filters}
          onChange={setFilters}
          mitreTactics={mitreTactics}
          totalCount={scenario.evidence.length}
          filteredCount={filtered.length}
        />
      </div>

      {/* Evidence list — also a droppable zone */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 flex-1 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileSearch className="w-8 h-8 text-white/10 mb-3" />
            <p className="text-sm text-white/25 font-mono">No evidence matches your filters</p>
          </div>
        ) : (
          filtered.map((ev, i) => (
            <EvidenceCard key={ev.id} evidence={ev} index={i} />
          ))
        )}
      </div>

      {/* Drag hint at bottom */}
      <div className="flex-shrink-0 rounded-xl border border-dashed border-white/[0.04] p-3 text-center">
        <p className="text-[10px] text-white/20 font-mono">
          Drag evidence cards to the Timeline panel → or click "Add to Timeline"
        </p>
      </div>
    </div>
  );
}
