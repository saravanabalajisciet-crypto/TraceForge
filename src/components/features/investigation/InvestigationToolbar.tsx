"use client";

import { useState } from "react";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { EvidenceSeverity, EvidenceType } from "@/types";
import { cn } from "@/lib/utils";

export type EvidenceFilters = {
  search: string;
  severity: EvidenceSeverity | "all";
  category: EvidenceType | "all";
  mitreTactic: string | "all";
};

interface InvestigationToolbarProps {
  filters: EvidenceFilters;
  onChange: (f: EvidenceFilters) => void;
  mitreTactics: string[];
  totalCount: number;
  filteredCount: number;
}

const SEVERITIES: Array<{ value: EvidenceSeverity | "all"; label: string; color: string }> = [
  { value: "all", label: "All Severity", color: "text-white/50" },
  { value: "critical", label: "Critical", color: "text-red-400" },
  { value: "high", label: "High", color: "text-orange-400" },
  { value: "medium", label: "Medium", color: "text-yellow-400" },
  { value: "low", label: "Low", color: "text-blue-400" },
];

const CATEGORIES: Array<{ value: EvidenceType | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "Log", label: "Log" },
  { value: "Network", label: "Network" },
  { value: "Memory", label: "Memory" },
  { value: "Registry", label: "Registry" },
  { value: "Artifact", label: "Artifact" },
];

export function InvestigationToolbar({ filters, onChange, mitreTactics, totalCount, filteredCount }: InvestigationToolbarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilters = filters.severity !== "all" || filters.category !== "all" || filters.mitreTactic !== "all" || filters.search !== "";

  return (
    <div className="flex flex-col gap-2">
      {/* Top row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search evidence…"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border transition-all",
            showFilters || hasActiveFilters
              ? "text-purple-400 border-purple-400/30 bg-purple-400/[0.07]"
              : "text-white/40 border-white/[0.06] hover:text-white/70 hover:border-white/10"
          )}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {hasActiveFilters && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          )}
          <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
        </button>

        {/* Count */}
        <span className="text-[10px] font-mono text-white/25 flex-shrink-0">
          {filteredCount}/{totalCount}
        </span>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
          {/* Severity */}
          <div className="flex items-center gap-1 flex-wrap">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                onClick={() => onChange({ ...filters, severity: s.value })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                  filters.severity === s.value
                    ? `${s.color} border-current bg-current/10`
                    : "text-white/35 border-white/[0.06] hover:text-white/60"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="w-px bg-white/[0.06] self-stretch" />

          {/* Category */}
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => onChange({ ...filters, category: c.value })}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                  filters.category === c.value
                    ? "text-blue-400 border-blue-400/30 bg-blue-400/10"
                    : "text-white/35 border-white/[0.06] hover:text-white/60"
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* MITRE tactic */}
          {mitreTactics.length > 0 && (
            <>
              <div className="w-px bg-white/[0.06] self-stretch" />
              <div className="flex items-center gap-1 flex-wrap">
                <button
                  onClick={() => onChange({ ...filters, mitreTactic: "all" })}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                    filters.mitreTactic === "all"
                      ? "text-purple-400 border-purple-400/30 bg-purple-400/10"
                      : "text-white/35 border-white/[0.06] hover:text-white/60"
                  )}
                >
                  All Tactics
                </button>
                {mitreTactics.map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ ...filters, mitreTactic: t })}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all",
                      filters.mitreTactic === t
                        ? "text-purple-400 border-purple-400/30 bg-purple-400/10"
                        : "text-white/35 border-white/[0.06] hover:text-white/60"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={() => onChange({ search: "", severity: "all", category: "all", mitreTactic: "all" })}
              className="ml-auto flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 font-mono"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
