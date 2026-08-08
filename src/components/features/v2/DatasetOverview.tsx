"use client";

import { motion } from "framer-motion";
import { Clock, Users, Server, Globe, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { DatasetOverview as DatasetOverviewType } from "@/types/v2";
import { GlassCard } from "@/components/GlassCard";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

interface DatasetOverviewProps {
  overview: DatasetOverviewType;
  onReconstruct: () => void;
  isReconstructing: boolean;
}

export function DatasetOverview({ overview, onReconstruct, isReconstructing }: DatasetOverviewProps) {
  const hasWarnings = overview.warnings.length > 0 || overview.errors.length > 0;
  const invalidPct = overview.totalEvents > 0
    ? Math.round((overview.invalidRecords / overview.totalEvents) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl space-y-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-purple-400" />
            <span className="text-sm font-semibold text-white/80 truncate max-w-[280px]">
              {overview.fileName}
            </span>
            <span className="text-[9px] font-mono text-white/30 uppercase border border-white/10 rounded px-1">
              {overview.format}
            </span>
          </div>
          <p className="text-[10px] font-mono text-white/30">
            {Math.round(overview.fileSizeBytes / 1024)}KB · Dataset ID: {overview.datasetId}
          </p>
        </div>

        {/* Validity indicator */}
        <div className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono flex-shrink-0",
          invalidPct === 0
            ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
            : invalidPct < 20
            ? "border-yellow-500/20 bg-yellow-500/[0.06] text-yellow-400"
            : "border-red-500/20 bg-red-500/[0.06] text-red-400"
        )}>
          {invalidPct === 0
            ? <CheckCircle2 className="w-3 h-3" />
            : <AlertTriangle className="w-3 h-3" />}
          {overview.validEvents} / {overview.totalEvents} valid
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: <Clock className="w-3 h-3" />, label: "Time Range",
            value: overview.timeRange
              ? `${formatTimestamp(overview.timeRange.start).split(" ")[0]} – ${formatTimestamp(overview.timeRange.end).split(" ")[0]}`
              : "N/A" },
          { icon: <Server className="w-3 h-3" />, label: "Hosts",
            value: overview.uniqueHosts.length > 0 ? overview.uniqueHosts.slice(0, 3).join(", ") + (overview.uniqueHosts.length > 3 ? `…+${overview.uniqueHosts.length - 3}` : "") : "None" },
          { icon: <Users className="w-3 h-3" />, label: "Users",
            value: overview.uniqueUsers.length > 0 ? overview.uniqueUsers.slice(0, 3).join(", ") + (overview.uniqueUsers.length > 3 ? `…+${overview.uniqueUsers.length - 3}` : "") : "None" },
          { icon: <Globe className="w-3 h-3" />, label: "IPs",
            value: overview.uniqueIps.length > 0 ? `${overview.uniqueIps.length} unique` : "None" },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
            <div className="flex items-center gap-1.5 text-white/30 mb-1.5">
              {stat.icon}
              <span className="text-[9px] font-mono uppercase tracking-widest">{stat.label}</span>
            </div>
            <p className="text-[11px] text-white/70 font-mono truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Event types */}
      {overview.detectedEventTypes.length > 0 && (
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">Detected Event Types</p>
          <div className="flex flex-wrap gap-1.5">
            {overview.detectedEventTypes.slice(0, 12).map((t) => (
              <span key={t} className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/[0.08] border border-purple-500/15 text-purple-400/70">
                {t}
              </span>
            ))}
            {overview.detectedEventTypes.length > 12 && (
              <span className="text-[9px] font-mono text-white/25">+{overview.detectedEventTypes.length - 12} more</span>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] space-y-1">
          {overview.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-400/80">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onReconstruct}
        disabled={isReconstructing || overview.validEvents === 0}
        className={cn(
          "w-full py-3 rounded-xl text-sm font-semibold transition-all",
          overview.validEvents === 0
            ? "bg-white/[0.03] border border-white/[0.06] text-white/20 cursor-not-allowed"
            : isReconstructing
            ? "bg-purple-500/20 border border-purple-500/30 text-purple-400/60 cursor-wait"
            : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500 shadow-[0_0_24px_rgba(139,92,246,0.3)]"
        )}
      >
        {isReconstructing ? "Reconstructing…" : overview.validEvents === 0 ? "No valid events" : `Reconstruct Investigation (${overview.validEvents} events)`}
      </button>
    </motion.div>
  );
}
