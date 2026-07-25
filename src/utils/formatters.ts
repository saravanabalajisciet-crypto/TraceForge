import { Difficulty, ScenarioStatus, EvidenceSeverity, EvidenceStatus, EvidenceType } from "@/types";

export function getDifficultyColor(difficulty: Difficulty): string {
  const map: Record<Difficulty, string> = {
    Beginner: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    Intermediate: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    Advanced: "text-orange-400 border-orange-400/30 bg-orange-400/10",
    Expert: "text-red-400 border-red-400/30 bg-red-400/10",
  };
  return map[difficulty];
}

export function getStatusColor(status: ScenarioStatus): string {
  const map: Record<ScenarioStatus, string> = {
    Available: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    "In Progress": "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    Completed: "text-purple-400 border-purple-400/30 bg-purple-400/10",
    Locked: "text-zinc-500 border-zinc-500/30 bg-zinc-500/10",
  };
  return map[status];
}

export function getSeverityColor(severity: EvidenceSeverity): string {
  const map: Record<EvidenceSeverity, string> = {
    critical: "text-red-400 border-red-400/30 bg-red-400/10",
    high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
    medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    low: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  };
  return map[severity];
}

export function getSeverityDot(severity: EvidenceSeverity): string {
  const map: Record<EvidenceSeverity, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-blue-500",
  };
  return map[severity];
}

export function getEvidenceStatusColor(status: EvidenceStatus): string {
  const map: Record<EvidenceStatus, string> = {
    unreviewed: "text-white/30 border-white/10 bg-white/[0.03]",
    reviewing: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
    reviewed: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    flagged: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  };
  return map[status];
}

export function getCategoryColor(category: EvidenceType): string {
  const map: Record<EvidenceType, string> = {
    Log: "blue",
    Network: "purple",
    Memory: "red",
    Registry: "yellow",
    Artifact: "green",
  };
  return map[category];
}

export function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatShortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
