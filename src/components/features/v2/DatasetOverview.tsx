"use client";

import { motion } from "framer-motion";
import {
  Clock, Users, Server, Globe, AlertTriangle,
  CheckCircle2, FileText, Tag, Info,
} from "lucide-react";
import { DatasetOverview as DatasetOverviewType } from "@/types/v2";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

interface DatasetOverviewProps {
  overview: DatasetOverviewType;
  onReconstruct: () => void;
  isReconstructing: boolean;
}

export function DatasetOverview({ overview, onReconstruct, isReconstructing }: DatasetOverviewProps) {
  const hasWarnings = overview.warnings.length > 0;
  const invalidPct =
    overview.totalEvents > 0
      ? Math.round((overview.invalidRecords / overview.totalEvents) * 100)
      : 0;
  const schema = overview.detectedSchema;
  const skipped = overview.skippedRecords ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-2xl space-y-4"
    >
      {/* ── Header ── */}
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
            {Math.round(overview.fileSizeBytes / 1024)} KB · Dataset ID: {overview.datasetId}
          </p>
        </div>

        {/* Validity badge */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono flex-shrink-0",
            invalidPct === 0
              ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
              : invalidPct < 20
              ? "border-yellow-500/20 bg-yellow-500/[0.06] text-yellow-400"
              : "border-red-500/20 bg-red-500/[0.06] text-red-400"
          )}
        >
          {invalidPct === 0 ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <AlertTriangle className="w-3 h-3" />
          )}
          Valid: {overview.validEvents} / {overview.totalEvents}
          {overview.invalidRecords > 0 && (
            <span className="ml-1 opacity-60">({overview.invalidRecords} skipped)</span>
          )}
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            icon: <Clock className="w-3 h-3" />,
            label: "Time Range",
            value: overview.timeRange
              ? `${formatTimestamp(overview.timeRange.start).split(" ")[0]} – ${formatTimestamp(overview.timeRange.end).split(" ")[0]}`
              : "N/A",
          },
          {
            icon: <Server className="w-3 h-3" />,
            label: "Hosts",
            value:
              overview.uniqueHosts.length > 0
                ? overview.uniqueHosts.slice(0, 2).join(", ") +
                  (overview.uniqueHosts.length > 2 ? ` +${overview.uniqueHosts.length - 2}` : "")
                : "None",
          },
          {
            icon: <Users className="w-3 h-3" />,
            label: "Users",
            value:
              overview.uniqueUsers.length > 0
                ? overview.uniqueUsers.slice(0, 2).join(", ") +
                  (overview.uniqueUsers.length > 2 ? ` +${overview.uniqueUsers.length - 2}` : "")
                : "None",
          },
          {
            icon: <Globe className="w-3 h-3" />,
            label: "IPs",
            value:
              overview.uniqueIps.length > 0 ? `${overview.uniqueIps.length} unique` : "None",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]"
          >
            <div className="flex items-center gap-1.5 text-white/30 mb-1.5">
              {stat.icon}
              <span className="text-[9px] font-mono uppercase tracking-widest">{stat.label}</span>
            </div>
            <p className="text-[11px] text-white/70 font-mono truncate">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* ── Detected Schema ── */}
      {schema && Object.values(schema).some(Boolean) && (
        <div className="p-3 rounded-lg bg-blue-500/[0.04] border border-blue-500/15">
          <div className="flex items-center gap-2 mb-2.5">
            <Tag className="w-3 h-3 text-blue-400/70" />
            <p className="text-[9px] font-mono text-blue-400/60 uppercase tracking-widest">
              Detected Schema
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {[
              { label: "Timestamp field", value: schema.timestampField },
              { label: "Timestamp format", value: schema.timestampFormat },
              { label: "Source IP field", value: schema.sourceIpField },
              { label: "Dest IP field", value: schema.destinationIpField },
              { label: "User field", value: schema.userField },
              { label: "Event type field", value: schema.eventTypeField },
              { label: "Host field", value: schema.hostnameField },
            ]
              .filter((r) => r.value)
              .map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="text-[9px] text-white/25 font-mono w-32 flex-shrink-0">
                    {r.label}
                  </span>
                  <code className="text-[10px] text-blue-300/80 font-mono">{r.value}</code>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Skipped records detail ── */}
      {skipped.length > 0 && (
        <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.04]">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-3 h-3 text-orange-400/70" />
            <p className="text-[9px] font-mono text-orange-400/60 uppercase tracking-widest">
              Skipped Records — {skipped.length}
            </p>
          </div>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {skipped.slice(0, 8).map((s) => (
              <div key={s.recordIndex} className="flex items-start gap-2">
                <span className="text-[9px] font-mono text-white/25 flex-shrink-0 w-16">
                  Record {s.recordIndex + 1}
                </span>
                <p className="text-[10px] text-orange-400/70 leading-relaxed">{s.reason}</p>
              </div>
            ))}
            {skipped.length > 8 && (
              <p className="text-[9px] font-mono text-white/20">+{skipped.length - 8} more</p>
            )}
          </div>
        </div>
      )}

      {/* ── Event types ── */}
      {overview.detectedEventTypes.length > 0 && (
        <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
          <p className="text-[9px] font-mono text-white/30 uppercase tracking-widest mb-2">
            Detected Event Types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {overview.detectedEventTypes.slice(0, 14).map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-purple-500/[0.08] border border-purple-500/15 text-purple-400/70"
              >
                {t}
              </span>
            ))}
            {overview.detectedEventTypes.length > 14 && (
              <span className="text-[9px] font-mono text-white/25">
                +{overview.detectedEventTypes.length - 14} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Warnings ── */}
      {hasWarnings && (
        <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/[0.04] space-y-1.5">
          {overview.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-yellow-400/80">{w}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Reconstruct CTA ── */}
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
        {isReconstructing
          ? "Reconstructing…"
          : overview.validEvents === 0
          ? "No valid events to reconstruct"
          : `Reconstruct Investigation — ${overview.validEvents} event${overview.validEvents !== 1 ? "s" : ""}`}
      </button>
    </motion.div>
  );
}
