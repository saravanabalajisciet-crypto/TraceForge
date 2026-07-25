// ─── Scenario Types ───────────────────────────────────────────────────────────

export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";
export type ScenarioStatus = "Available" | "In Progress" | "Completed" | "Locked";
export type AttackType =
  | "Ransomware"
  | "Insider Threat"
  | "Credential Theft"
  | "APT"
  | "Phishing"
  | "Supply Chain";

/** Lightweight scenario used in listings (Scenario Library, Landing Page) */
export interface Scenario {
  id: string;
  title: string;
  codename: string;
  description: string;
  difficulty: Difficulty;
  attackType: AttackType;
  estimatedTime: string;
  status: ScenarioStatus;
  tags: string[];
  mitreCategories: string[];
}

// ─── Evidence Types ────────────────────────────────────────────────────────────

export type EvidenceType = "Log" | "Memory" | "Network" | "Artifact" | "Registry";
export type EvidenceSeverity = "low" | "medium" | "high" | "critical";
export type EvidenceStatus = "unreviewed" | "reviewing" | "reviewed" | "flagged";
export type IocType =
  | "ip"
  | "domain"
  | "hash"
  | "filepath"
  | "registry"
  | "email"
  | "url"
  | "username"
  | "none";

/** Full evidence item — used in investigation workspace */
export interface EvidenceItem {
  id: string;
  title: string;
  timestamp: string;
  source: string;
  eventId: string;
  severity: EvidenceSeverity;
  hostname: string;
  username: string;
  iocType: IocType;
  iocValue: string;
  mitreTactic: string;
  mitreTechnique: string;
  rawLog: string;
  description: string;
  status: EvidenceStatus;
  category: EvidenceType;
  /** Analyst notes — persisted to localStorage */
  analystNotes?: string;
}

// ─── Scenario Full ─────────────────────────────────────────────────────────────

export interface LearningObjective {
  id: string;
  text: string;
}

export interface MitreMappingEntry {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  description: string;
}

export interface ScenarioRecommendation {
  severity: EvidenceSeverity;
  text: string;
}

/** Full scenario — loaded per investigation */
export interface ScenarioFull extends Scenario {
  investigationBrief: string;
  learningObjectives: LearningObjective[];
  evidence: EvidenceItem[];
  mitreMappings: MitreMappingEntry[];
  recommendations: ScenarioRecommendation[];
  riskLevel: number;
}

// ─── Timeline Types ────────────────────────────────────────────────────────────

/** A slot in the analyst-built timeline (dragged in from evidence) */
export interface TimelineSlot {
  /** Unique slot id (not evidence id — allows same evidence in multiple positions) */
  slotId: string;
  evidenceId: string;
}

// ─── Investigation State ───────────────────────────────────────────────────────

/** Persisted investigation state per scenario (stored in localStorage) */
export interface InvestigationState {
  scenarioId: string;
  /** ids of evidence the analyst has opened/reviewed */
  reviewedEvidenceIds: string[];
  /** Ordered timeline slots */
  timeline: TimelineSlot[];
  /** Per-evidence analyst notes keyed by evidence id */
  notes: Record<string, string>;
  /** ISO string of last save */
  lastSaved: string;
}

// ─── MITRE ATT&CK Types ────────────────────────────────────────────────────────

export interface MitreTechnique {
  id: string;
  name: string;
  tactic: string;
  description: string;
  url: string;
}

// ─── Report Types ─────────────────────────────────────────────────────────────

export interface IncidentReport {
  id: string;
  scenarioId: string;
  generatedAt: string;
  executiveSummary: string;
  riskScore: number;
  mitreMappings: MitreTechnique[];
  recommendations: string[];
  timeline: TimelineSlot[];
}

// ─── Navigation Types ─────────────────────────────────────────────────────────

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
}

// ─── Legacy Evidence (Sprint 1 compat) ────────────────────────────────────────

export interface Evidence {
  id: string;
  scenarioId: string;
  title: string;
  type: EvidenceType;
  timestamp: string;
  source: string;
  content: string;
  tags: string[];
}

export interface TimelineEvent {
  id: string;
  scenarioId: string;
  timestamp: string;
  title: string;
  description: string;
  evidenceIds: string[];
  mitreId?: string;
  severity: EvidenceSeverity;
}
