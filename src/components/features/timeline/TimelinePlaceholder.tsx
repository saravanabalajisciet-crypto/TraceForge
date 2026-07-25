import { Clock, AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/GlassCard";

const PLACEHOLDER_EVENTS = [
  { time: "02:17:44", title: "Initial Compromise", severity: "critical" },
  { time: "02:19:01", title: "C2 Beacon", severity: "high" },
  { time: "02:21:33", title: "Process Injection", severity: "high" },
  { time: "02:24:58", title: "Ransomware Deployed", severity: "critical" },
];

const severityColors: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
};

export function TimelinePlaceholder() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold text-white/80">Attack Timeline</h3>
      </div>

      <div className="relative flex flex-col gap-0">
        {/* Vertical line */}
        <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/[0.06]" />

        {PLACEHOLDER_EVENTS.map((event, i) => (
          <div key={i} className="relative flex items-start gap-3 pb-4">
            <div
              className={`relative z-10 w-2 h-2 rounded-full mt-2 flex-shrink-0 ml-2.5 ring-2 ring-black ${severityColors[event.severity]}`}
            />
            <GlassCard className="flex-1 p-3">
              <p className="text-[10px] font-mono text-white/30 mb-0.5">{event.time}</p>
              <p className="text-xs font-medium text-white/70">{event.title}</p>
            </GlassCard>
          </div>
        ))}
      </div>

      <div className="mt-1 p-3 rounded-xl border border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center gap-2 text-yellow-400/60">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <p className="text-[10px] font-mono">
            Timeline reconstruction logic — next phase
          </p>
        </div>
      </div>
    </div>
  );
}
