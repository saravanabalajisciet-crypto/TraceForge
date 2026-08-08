"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, AlertTriangle, Info } from "lucide-react";
import { SecurityEvent, EventRelationship } from "@/types/v2";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { InferenceBadge } from "./InferenceBadge";
import { cn } from "@/lib/utils";
import { formatTimestamp } from "@/utils/formatters";

interface ReconstructedTimelineProps {
  events: SecurityEvent[];
  relationships: EventRelationship[];
  suspiciousIds: Set<string>;
  onEventClick: (event: SecurityEvent) => void;
  selectedEventId?: string;
}

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  failed_login: "Failed Login",
  successful_login: "Successful Login",
  process_created: "Process Created",
  network_connection: "Network Connection",
  file_created: "File Created",
  file_modified: "File Modified",
  credential_access: "Credential Access",
  lateral_movement: "Lateral Movement",
  data_exfiltration: "Data Exfiltration",
  antivirus_disabled: "AV Disabled",
  log_cleared: "Log Cleared",
  registry_modified: "Registry Modified",
  privilege_escalation: "Privilege Escalation",
  dns_query: "DNS Query",
  usb_connected: "USB Connected",
  bulk_file_access: "Bulk File Access",
};

export function ReconstructedTimeline({
  events, relationships, suspiciousIds, onEventClick, selectedEventId,
}: ReconstructedTimelineProps) {
  const [showAll, setShowAll] = useState(false);
  const VISIBLE = 15;
  const visible = showAll ? events : events.slice(0, VISIBLE);

  function getRelCount(id: string) {
    return relationships.filter((r) => r.fromEventId === id || r.toEventId === id).length;
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/[0.04]" />

      <div className="flex flex-col gap-0">
        {visible.map((event, i) => {
          const isSuspicious = suspiciousIds.has(event.id);
          const isSelected = selectedEventId === event.id;
          const relCount = getRelCount(event.id);
          const label = EVENT_TYPE_LABEL[event.eventType] ?? event.eventType.replace(/_/g, " ");

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              className="relative flex items-start gap-3 pb-2 cursor-pointer group"
              onClick={() => onEventClick(event)}
            >
              {/* Dot */}
              <div className={cn(
                "relative z-10 w-2 h-2 rounded-full mt-2 flex-shrink-0 ml-2.5 ring-2 ring-[#050507]",
                SEVERITY_DOT[event.severity ?? "low"] ?? "bg-white/20"
              )} />

              {/* Card */}
              <div className={cn(
                "flex-1 rounded-lg border px-3 py-2 transition-all min-w-0",
                isSelected
                  ? "border-purple-500/40 bg-purple-500/[0.07]"
                  : isSuspicious
                  ? "border-orange-500/15 bg-orange-500/[0.03] group-hover:border-orange-500/30"
                  : "border-white/[0.05] bg-white/[0.01] group-hover:border-white/10"
              )}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium text-white/75 truncate">{label}</span>
                      {isSuspicious && (
                        <InferenceBadge type="ai-inferred" label="Suspicious" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[9px] font-mono text-white/25">
                        {formatTimestamp(event.timestamp)}
                      </span>
                      {event.user && (
                        <span className="text-[9px] font-mono text-blue-400/60">{event.user}</span>
                      )}
                      {event.hostname && (
                        <span className="text-[9px] font-mono text-purple-400/50">{event.hostname}</span>
                      )}
                      {event.sourceIp && (
                        <span className="text-[9px] font-mono text-white/25">{event.sourceIp}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {relCount > 0 && (
                      <span className="text-[9px] font-mono text-purple-400/50 border border-purple-500/15 rounded px-1">
                        {relCount} link{relCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    <ChevronRight className="w-3 h-3 text-white/15 group-hover:text-white/40 transition-colors" />
                  </div>
                </div>
                {event.command && (
                  <p className="text-[9px] font-mono text-white/25 mt-1 truncate">{event.command}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {!showAll && events.length > VISIBLE && (
        <button
          onClick={() => setShowAll(true)}
          className="ml-8 mt-2 text-[11px] font-mono text-purple-400/60 hover:text-purple-400 transition-colors"
        >
          Show {events.length - VISIBLE} more events →
        </button>
      )}

      {events.length === 0 && (
        <div className="flex items-center gap-2 pl-8 py-4">
          <Info className="w-4 h-4 text-white/20" />
          <span className="text-xs text-white/30 font-mono">No events in timeline.</span>
        </div>
      )}
    </div>
  );
}
