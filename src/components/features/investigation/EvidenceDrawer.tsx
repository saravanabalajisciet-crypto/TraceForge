"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Server, User, Hash, Shield, Terminal, AlertTriangle, ChevronRight, Plus } from "lucide-react";
import { CyberBadge } from "@/components/CyberBadge";
import { NotesEditor } from "./NotesEditor";
import { useInvestigation } from "@/contexts/InvestigationContext";
import { cn } from "@/lib/utils";
import { getSeverityColor, getSeverityDot, getCategoryColor, formatTimestamp } from "@/utils/formatters";

export function EvidenceDrawer() {
  const { drawer, closeDrawer, getEvidence, addToTimeline, isInTimeline } = useInvestigation();
  const evidence = drawer.evidenceId ? getEvidence(drawer.evidenceId) : undefined;
  const inTimeline = drawer.evidenceId ? isInTimeline(drawer.evidenceId) : false;

  // Keyboard: Escape closes drawer
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") closeDrawer();
  }, [closeDrawer]);

  useEffect(() => {
    if (drawer.open) {
      document.addEventListener("keydown", handleKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [drawer.open, handleKey]);

  return (
    <AnimatePresence>
      {drawer.open && evidence && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl flex flex-col bg-[#0a0a0f] border-l border-white/[0.07] overflow-hidden"
            role="dialog"
            aria-label={`Evidence: ${evidence.title}`}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", getSeverityDot(evidence.severity))} />
                  <CyberBadge
                    label={evidence.category}
                    variant={getCategoryColor(evidence.category) as "blue" | "purple" | "red" | "yellow" | "green"}
                  />
                  <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-mono font-medium border", getSeverityColor(evidence.severity))}>
                    {evidence.severity.toUpperCase()}
                  </span>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/10 text-purple-400/70 border border-purple-500/15">
                    {evidence.mitreTechnique}
                  </span>
                </div>
                <h2 className="text-base font-semibold text-white leading-snug">{evidence.title}</h2>
              </div>
              <button
                onClick={closeDrawer}
                aria-label="Close drawer"
                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* Meta grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Clock className="w-3 h-3" />, label: "Timestamp", value: formatTimestamp(evidence.timestamp), mono: true },
                  { icon: <Hash className="w-3 h-3" />, label: "Event ID", value: evidence.eventId, mono: true },
                  { icon: <Server className="w-3 h-3" />, label: "Source", value: evidence.source, mono: false },
                  { icon: <Server className="w-3 h-3" />, label: "Hostname", value: evidence.hostname, mono: true },
                  { icon: <User className="w-3 h-3" />, label: "Username", value: evidence.username, mono: true },
                  { icon: <Shield className="w-3 h-3" />, label: "MITRE Tactic", value: evidence.mitreTactic, mono: false },
                ].map((item) => (
                  <div key={item.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <div className="flex items-center gap-1.5 text-white/30 mb-1">
                      {item.icon}
                      <span className="text-[9px] font-mono uppercase tracking-widest">{item.label}</span>
                    </div>
                    <p className={cn("text-xs text-white/70 break-all", item.mono && "font-mono")}>{item.value || "—"}</p>
                  </div>
                ))}
              </div>

              {/* IOC */}
              {evidence.iocType !== "none" && evidence.iocValue && (
                <div className="p-3 rounded-xl bg-red-500/[0.05] border border-red-500/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Indicator of Compromise</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-red-500/10 text-red-400 border border-red-500/20 uppercase">
                      {evidence.iocType}
                    </span>
                    <code className="text-xs text-red-300/80 font-mono break-all">{evidence.iocValue}</code>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Description</p>
                <p className="text-sm text-white/60 leading-relaxed">{evidence.description}</p>
              </div>

              {/* Raw Log */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Raw Log</p>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/[0.06] p-4 overflow-x-auto">
                  <pre className="text-[11px] font-mono text-white/50 leading-relaxed whitespace-pre-wrap break-all">
                    {evidence.rawLog}
                  </pre>
                </div>
              </div>

              {/* Analyst Notes */}
              <NotesEditor evidenceId={evidence.id} />

              {/* MITRE info */}
              <div className="p-3 rounded-xl bg-purple-500/[0.05] border border-purple-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <ChevronRight className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">MITRE ATT&CK</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
                    {evidence.mitreTechnique}
                  </span>
                  <span className="text-xs text-white/50">{evidence.mitreTactic}</span>
                </div>
              </div>
            </div>

            {/* Footer action */}
            <div className="p-4 border-t border-white/[0.06]">
              <button
                onClick={() => { addToTimeline(evidence.id); closeDrawer(); }}
                disabled={inTimeline}
                className={cn(
                  "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200",
                  inTimeline
                    ? "text-purple-400/50 border-purple-400/15 bg-purple-400/[0.04] cursor-default"
                    : "text-white border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-500/50"
                )}
              >
                <Plus className="w-4 h-4" />
                {inTimeline ? "Already in Timeline" : "Add to Investigation Timeline"}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
