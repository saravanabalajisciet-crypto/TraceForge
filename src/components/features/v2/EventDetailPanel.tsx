"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Bot, Loader2, Sparkles, WifiOff } from "lucide-react";
import { SecurityEvent, EventRelationship, ReconstructionResult } from "@/types/v2";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { InferenceBadge } from "./InferenceBadge";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

interface EventDetailPanelProps {
  event: SecurityEvent;
  reconstruction: ReconstructionResult;
  onClose: () => void;
}

export function EventDetailPanel({ event, reconstruction, onClose }: EventDetailPanelProps) {
  const [mentorState, setMentorState] = useState<"idle" | "loading" | "done">("idle");
  const [mentorText, setMentorText] = useState("");
  const [mentorSource, setMentorSource] = useState<"gemini" | "offline">("offline");

  const rels = reconstruction.relationships.filter(
    (r) => r.fromEventId === event.id || r.toEventId === event.id
  );
  const stage = reconstruction.attackStory.stages.find(
    (s) => s.supportingEventIds.includes(event.id)
  );
  const mitre = reconstruction.mitreMappings.find(
    (m) => m.supportingEventIds.includes(event.id)
  );

  async function askMentor() {
    setMentorState("loading");
    try {
      const res = await fetch(`/api/v2/investigation/${reconstruction.datasetId}/explain`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "explain-event", eventId: event.id }),
      });
      const data = await res.json();
      setMentorText(data.guidance ?? "Unable to get guidance.");
      setMentorSource(data.source ?? "offline");
      setMentorState("done");
    } catch {
      setMentorText("Mentor is temporarily unavailable. Review the event fields and correlate with nearby events.");
      setMentorSource("offline");
      setMentorState("done");
    }
  }

  const metaRows = [
    { label: "Type", value: event.eventType },
    { label: "Timestamp", value: formatTimestamp(event.timestamp) },
    { label: "Source IP", value: event.sourceIp },
    { label: "Dest IP", value: event.destinationIp },
    { label: "User", value: event.user },
    { label: "Hostname", value: event.hostname },
    { label: "Process", value: event.process },
    { label: "Command", value: event.command, mono: true },
    { label: "File Path", value: event.filePath, mono: true },
    { label: "Hash", value: event.hash, mono: true },
    { label: "Domain", value: event.domain },
    { label: "Port", value: event.port?.toString() },
    { label: "Protocol", value: event.protocol },
  ].filter((r) => r.value);

  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      className="h-full flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-white/[0.05]">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80 truncate">
            {event.eventType.replace(/_/g, " ")}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {event.severity && (
              <span className={cn(
                "text-[9px] font-mono px-1.5 py-0.5 rounded border",
                event.severity === "critical" ? "border-red-500/30 bg-red-500/[0.08] text-red-400" :
                event.severity === "high" ? "border-orange-500/30 bg-orange-500/[0.08] text-orange-400" :
                event.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/[0.08] text-yellow-400" :
                "border-blue-500/30 bg-blue-500/[0.08] text-blue-400"
              )}>{event.severity}</span>
            )}
            {stage && <InferenceBadge type="ai-inferred" label={stage.name} />}
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-white/30 hover:text-white hover:bg-white/[0.05] transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Meta fields */}
        <div className="space-y-2">
          {metaRows.map(({ label, value, mono }) => (
            <div key={label} className="flex gap-3">
              <span className="text-[9px] font-mono text-white/25 uppercase w-20 flex-shrink-0 pt-0.5">{label}</span>
              <span className={cn("text-[11px] text-white/65 break-all", mono && "font-mono text-purple-300/70")}>{value}</span>
            </div>
          ))}
        </div>

        {/* MITRE */}
        {mitre && (
          <div className="p-3 rounded-lg border border-purple-500/15 bg-purple-500/[0.04]">
            <p className="text-[9px] font-mono text-purple-400/50 uppercase tracking-widest mb-1.5">MITRE ATT&CK</p>
            <div className="flex items-center gap-2 mb-1">
              <code className="text-[10px] font-mono text-purple-300">{mitre.techniqueId}</code>
              <span className="text-[10px] text-white/50">{mitre.techniqueName}</span>
            </div>
            <ConfidenceBadge confidence={mitre.confidence} size="sm" />
            <p className="text-[10px] text-white/40 mt-2 leading-relaxed">{mitre.explanation}</p>
          </div>
        )}

        {/* Relationships */}
        {rels.length > 0 && (
          <div>
            <p className="text-[9px] font-mono text-white/25 uppercase tracking-widest mb-2">
              {rels.length} Relationship{rels.length !== 1 ? "s" : ""}
            </p>
            <div className="space-y-1.5">
              {rels.slice(0, 5).map((rel, i) => {
                const isFrom = rel.fromEventId === event.id;
                const otherId = isFrom ? rel.toEventId : rel.fromEventId;
                const other = reconstruction.events.find((e) => e.id === otherId);
                return (
                  <div key={i} className="p-2 rounded border border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[8px] font-mono text-white/20">{isFrom ? "→" : "←"}</span>
                      <span className="text-[10px] text-white/50 truncate">
                        {other?.eventType.replace(/_/g, " ") ?? otherId.slice(0, 8)}
                      </span>
                      <ConfidenceBadge confidence={rel.confidence} showPercent={false} size="sm" />
                    </div>
                    <p className="text-[9px] text-white/30 leading-relaxed">{rel.explanation}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI Mentor */}
        <div className="border-t border-white/[0.04] pt-4">
          {mentorState === "idle" && (
            <button
              onClick={askMentor}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-purple-500/20 bg-purple-500/[0.05] text-xs text-purple-400 hover:bg-purple-500/[0.1] transition-all"
            >
              <Bot className="w-3.5 h-3.5" />
              Ask Mentor to Explain
            </button>
          )}
          {mentorState === "loading" && (
            <div className="flex items-center gap-2 py-2 justify-center">
              <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
              <span className="text-xs text-white/40 font-mono">Thinking…</span>
            </div>
          )}
          {mentorState === "done" && mentorText && (
            <div className="p-3 rounded-lg border border-emerald-500/15 bg-emerald-500/[0.03]">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[9px] font-mono text-emerald-400/60 uppercase">Mentor</span>
                <div className="ml-auto">
                  {mentorSource === "gemini"
                    ? <span className="flex items-center gap-1 text-[8px] font-mono text-purple-400/50"><Sparkles className="w-2 h-2" />Gemini</span>
                    : <span className="flex items-center gap-1 text-[8px] font-mono text-slate-400/50"><WifiOff className="w-2 h-2" />Offline</span>
                  }
                </div>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed whitespace-pre-wrap">{mentorText}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
