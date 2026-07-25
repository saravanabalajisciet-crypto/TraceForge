"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, ShieldAlert, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SectionHeader } from "@/components/SectionHeader";
import { ScenarioCard } from "@/components/ScenarioCard";
import { GlassCard } from "@/components/GlassCard";
import { scenarios } from "@/data/scenarios";
import { Difficulty, AttackType, ScenarioStatus } from "@/types";
import { cn } from "@/lib/utils";

const DIFFICULTIES: Array<Difficulty | "All"> = ["All", "Beginner", "Intermediate", "Advanced", "Expert"];
const ATTACK_TYPES: Array<AttackType | "All"> = ["All", "Ransomware", "Insider Threat", "Credential Theft", "APT", "Phishing"];
const STATUSES: Array<ScenarioStatus | "All"> = ["All", "Available", "In Progress", "Completed", "Locked"];

export default function ScenariosPage() {
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [attackType, setAttackType] = useState<AttackType | "All">("All");
  const [status, setStatus] = useState<ScenarioStatus | "All">("All");

  const filtered = useMemo(() => {
    return scenarios.filter((s) => {
      const q = search.toLowerCase();
      if (q && !s.title.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false;
      if (difficulty !== "All" && s.difficulty !== difficulty) return false;
      if (attackType !== "All" && s.attackType !== attackType) return false;
      if (status !== "All" && s.status !== status) return false;
      return true;
    });
  }, [search, difficulty, attackType, status]);

  const hasFilters = difficulty !== "All" || attackType !== "All" || status !== "All" || search !== "";

  function FilterGroup<T extends string>({ label, options, value, onChange }: {
    label: string; options: T[]; value: T; onChange: (v: T) => void;
  }) {
    return (
      <div className="mb-5">
        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2.5">{label}</p>
        <div className="flex flex-col gap-1">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => onChange(opt)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left",
                value === opt
                  ? "text-white bg-white/[0.06] border border-white/[0.08]"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              )}
            >
              {value === opt && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />}
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen px-6 py-12 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <SectionHeader
            label="Scenario Library"
            title="Select Your Investigation"
            description="Each case is based on a real-world attack pattern. Choose a scenario to begin your forensic analysis."
            align="left"
          />
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar filters */}
          <motion.aside
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full lg:w-64 flex-shrink-0"
          >
            <GlassCard className="p-5 sticky top-20">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white/80">Filters</h3>
                </div>
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(""); setDifficulty("All"); setAttackType("All"); setStatus("All"); }}
                    className="flex items-center gap-1 text-[10px] font-mono text-white/30 hover:text-white/60"
                  >
                    <X className="w-3 h-3" />
                    Clear
                  </button>
                )}
              </div>

              {/* Search */}
              <div className="relative mb-5">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scenarios..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-white/70 placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 focus:bg-white/[0.06] transition-all"
                />
              </div>

              <FilterGroup label="Difficulty" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
              <FilterGroup label="Attack Type" options={ATTACK_TYPES} value={attackType} onChange={setAttackType} />
              <FilterGroup label="Status" options={STATUSES} value={status} onChange={setStatus} />

              {/* Stats */}
              <div className="pt-4 border-t border-white/[0.05]">
                <div className="flex justify-between text-xs">
                  <span className="text-white/30 font-mono">Total</span>
                  <span className="text-white/60 font-mono">{scenarios.length} scenarios</span>
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-white/30 font-mono">Available</span>
                  <span className="text-emerald-400 font-mono">
                    {scenarios.filter((s) => s.status === "Available").length}
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1.5">
                  <span className="text-white/30 font-mono">Locked</span>
                  <span className="text-zinc-500 font-mono">
                    {scenarios.filter((s) => s.status === "Locked").length}
                  </span>
                </div>
              </div>
            </GlassCard>
          </motion.aside>

          {/* Scenario grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-5">
              <p className="text-sm text-white/40 font-mono">
                {filtered.length} scenario{filtered.length !== 1 ? "s" : ""} found
              </p>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-white/40">Sorted by difficulty</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <ShieldAlert className="w-8 h-8 text-white/10 mb-3" />
                <p className="text-sm text-white/25 font-mono">No scenarios match your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {filtered.map((scenario, i) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
