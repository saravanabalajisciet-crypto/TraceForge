/**
 * types/v2.ts
 *
 * All TraceForge AI V2 type definitions.
 *
 * V1 types (src/types/index.ts) are UNCHANGED.
 * This file is additive only — zero imports from or changes to index.ts.
 */

// ─── Supported Languages ──────────────────────────────────────────────────────

export type SupportedLanguage = "en" | "ta" | "hi" | "ml";

export const SUPPORTED_LANGUAGES: Record<SupportedLanguage, string> = {
  en: "English",
  ta: "தமிழ்",
  hi: "हिन्दी",
  ml: "മലയാളം",
};

// ─── Canonical Security Event ─────────────────────────────────────────────────

/**
 * The canonical internal representation of a single security event.
 * Produced by EventIngestionEngine after parsing and field normalization.
 * The original raw fields are always preserved in `raw`.
 */
export interface SecurityEvent {
  /** Stable UUID assigned during ingestion — never changes */
  id: string;
  /** ISO-8601 UTC timestamp — normalized from whatever format the input used */
  timestamp: string;
  /** Normalized event type string (lowercase, underscore-separated) */
  eventType: string;
  /** Human-readable source label (e.g. "Windows Event Log", "Firewall") */
  source?: string;
  /** Normalized source IPv4 or IPv6 address */
  sourceIp?: string;
  /** Normalized destination IPv4 or IPv6 address */
  destinationIp?: string;
  /** Normalized username (lowercase) */
  user?: string;
  /** Normalized hostname (lowercase) */
  hostname?: string;
  /** Process name */
  process?: string;
  /** Full command line */
  command?: string;
  /** File path (normalized separators) */
  filePath?: string;
  /** File hash — any algorithm (MD5/SHA1/SHA256) */
  hash?: string;
  /** Domain or FQDN */
  domain?: string;
  /** Network port number */
  port?: number;
  /** Network protocol */
  protocol?: string;
  /** Inferred or explicit severity */
  severity?: "low" | "medium" | "high" | "critical";
  /**
   * Original raw fields from the input record.
   * NEVER destroyed or modified during normalization.
   */
  raw: Record<string, unknown>;
}

// ─── Event Relationship ───────────────────────────────────────────────────────

/**
 * A directed relationship between two SecurityEvents.
 * Every relationship MUST have an explanation — empty explanations are invalid.
 */
export type EventRelationshipType =
  | "shared_source_ip"
  | "shared_user"
  | "shared_hostname"
  | "shared_process"
  | "shared_hash"
  | "shared_domain"
  | "temporal_sequence"
  | "authentication_chain"    // failed logins → success
  | "process_chain"           // parent → child process
  | "network_flow"            // connection → data transfer
  | "file_operation_chain";   // file created → file executed

export type ConfidenceLevel = "high" | "medium" | "low";

export interface EventRelationship {
  fromEventId: string;
  toEventId: string;
  relationshipType: EventRelationshipType;
  /**
   * 0.0 – 1.0
   * ≥ 0.80 = high
   * 0.50 – 0.79 = medium
   * < 0.50 = low
   */
  confidence: number;
  /**
   * Human-readable explanation of WHY these events are related.
   * MUST be a non-empty, meaningful sentence.
   */
  explanation: string;
}

/** Derives a ConfidenceLevel label from a 0–1 numeric confidence */
export function confidenceLabel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.5) return "medium";
  return "low";
}

// ─── Event Group ──────────────────────────────────────────────────────────────

/**
 * A cluster of events that share a common entity (IP, user, hostname, etc.).
 * Used for correlation visualization and attack story building.
 */
export interface EventGroup {
  id: string;
  entityType: "ip" | "user" | "hostname" | "process" | "hash" | "domain";
  entityValue: string;
  eventIds: string[];
  /** Earliest timestamp in the group */
  firstSeen: string;
  /** Latest timestamp in the group */
  lastSeen: string;
}

// ─── Attack Story ─────────────────────────────────────────────────────────────

/**
 * A single inferred stage in the attack narrative.
 * Only populated with evidence that actually exists — never fabricated.
 */
export interface AttackStage {
  /** MITRE ATT&CK tactic name (e.g. "Initial Access", "Execution") */
  name: string;
  /** MITRE ATT&CK tactic ID (e.g. "TA0001") */
  tacticId?: string;
  /** IDs of SecurityEvents that support this stage */
  supportingEventIds: string[];
  /** Why this stage was inferred — shown to the user */
  reasoning: string;
  /** 0.0 – 1.0 based on supporting signal count and strength */
  confidence: number;
  /** ATT&CK technique IDs that may apply (e.g. ["T1110", "T1110.001"]) */
  possibleTechniques: string[];
  /** IOC values relevant to this stage */
  iocs: string[];
}

/**
 * The complete reconstructed attack narrative for an uploaded dataset.
 * Produced by AttackStoryEngine from sorted events + relationships.
 */
export interface AttackStory {
  id: string;
  datasetId: string;
  /** One-paragraph plain-English summary of the incident */
  summary: string;
  /** Ordered attack stages — only includes stages with supporting evidence */
  stages: AttackStage[];
  /** Overall 0.0–1.0 confidence across the whole story */
  overallConfidence: number;
  /** Event IDs that collectively support the story */
  evidence: string[];
  /**
   * What could NOT be determined — shown honestly to the user.
   * If the dataset is insufficient: ["Insufficient evidence to confidently reconstruct an attack chain."]
   */
  uncertainties: string[];
  /** ISO timestamp of when this story was generated */
  generatedAt: string;
}

// ─── MITRE Inference (V2) ─────────────────────────────────────────────────────

/**
 * A dynamically inferred MITRE ATT&CK technique mapping.
 * Requires at least 2 corroborating signals — never inferred from a single keyword.
 */
export interface V2MitreMapping {
  techniqueId: string;            // e.g. "T1110"
  techniqueName: string;          // e.g. "Brute Force"
  tactic: string;                 // e.g. "Credential Access"
  tacticId: string;               // e.g. "TA0006"
  /** 0.0 – 1.0 */
  confidence: number;
  /** Event IDs that support this technique mapping */
  supportingEventIds: string[];
  /** Why this technique was inferred — shown to the user */
  explanation: string;
}

// ─── IOC Extraction ───────────────────────────────────────────────────────────

export type IocKind =
  | "ipv4"
  | "ipv6"
  | "domain"
  | "url"
  | "email"
  | "hash_md5"
  | "hash_sha1"
  | "hash_sha256"
  | "filepath"
  | "username"
  | "hostname"
  | "process";

/**
 * A single extracted Indicator of Compromise.
 * Cross-referenced back to the events that contain it.
 */
export interface ExtractedIoc {
  /** Unique key: `${kind}:${value}` */
  id: string;
  kind: IocKind;
  value: string;
  /** IDs of SecurityEvents that contain this IOC */
  sourceEventIds: string[];
  /** Which attack stage this IOC is associated with (if known) */
  attackStage?: string;
  /** How many events reference this IOC */
  count: number;
}

// ─── Ingestion ────────────────────────────────────────────────────────────────

export type IngestionFormat = "json" | "ndjson" | "csv";

/**
 * A per-record ingestion error.
 */
export interface IngestionError {
  /** 0-based index of the input record */
  recordIndex: number;
  /** Field name that caused the error (if applicable) */
  field?: string;
  /** Human-readable error description */
  message: string;
  /** The raw value that triggered the error */
  raw?: unknown;
}

/**
 * The complete output of EventIngestionEngine.
 * Always returned — even on partial failure.
 * Never throws.
 */
export interface IngestionResult {
  /** Stable ID for this dataset — used to reference results later */
  datasetId: string;
  /** Successfully parsed and normalized events */
  events: SecurityEvent[];
  // ── Validation Summary ──
  totalInputRecords: number;
  validEvents: number;
  invalidRecords: number;
  duplicatesRemoved: number;
  missingTimestamps: number;
  /** Distinct event type strings detected in the dataset */
  detectedEventTypes: string[];
  /** All field names present across all input records */
  detectedFields: string[];
  /** Non-fatal issues (e.g. missing optional fields, clock skew suspected) */
  warnings: string[];
  /** Fatal per-record errors */
  errors: IngestionError[];
  /** Detected schema information — which fields were found and used */
  detectedSchema?: DetectedSchema;
  /** Per-record skip details for UI display */
  skippedRecords?: SkippedRecord[];
}

/** Detected field mappings for display in the upload UI */
export interface DetectedSchema {
  timestampField?: string;
  timestampFormat?: string;
  sourceIpField?: string;
  destinationIpField?: string;
  userField?: string;
  eventTypeField?: string;
  hostnameField?: string;
}

/** Details about a record that was skipped */
export interface SkippedRecord {
  recordIndex: number;
  reason: string;
}

// ─── Reconstruction ───────────────────────────────────────────────────────────

export interface ConfidenceSummary {
  /** Weighted overall confidence 0–100 */
  overall: number;
  /** Timeline ordering confidence 0–100 */
  timeline: number;
  /** MITRE mapping confidence 0–100 */
  mitre: number;
  /** Attack story confidence 0–100 */
  story: number;
}

/**
 * The complete V2 investigation output produced by all engines combined.
 * This is the primary data structure passed to the V2 investigation UI.
 */
export interface ReconstructionResult {
  /** Matches IngestionResult.datasetId */
  datasetId: string;
  /** All normalized events (sorted chronologically) */
  events: SecurityEvent[];
  /** All detected relationships between events */
  relationships: EventRelationship[];
  /** Grouped entity clusters */
  groups: EventGroup[];
  /** The inferred attack narrative */
  attackStory: AttackStory;
  /** MITRE ATT&CK technique mappings */
  mitreMappings: V2MitreMapping[];
  /** Extracted indicators of compromise */
  iocs: ExtractedIoc[];
  /** Time range of events */
  timeRange: {
    start: string;   // ISO
    end: string;     // ISO
    durationMs: number;
  };
  /** Dataset statistics */
  stats: {
    totalEvents: number;
    suspiciousEvents: number;
    uniqueUsers: number;
    uniqueHosts: number;
    uniqueIps: number;
    uniqueEventTypes: number;
  };
  /** Confidence breakdown */
  confidenceSummary: ConfidenceSummary;
  /** ISO timestamp of when reconstruction ran */
  reconstructedAt: string;
  /** How long processing took in milliseconds */
  processingMs: number;
}

// ─── AI Mentor V2 Context ─────────────────────────────────────────────────────

/**
 * Extended context passed to the AI Mentor when operating over a V2 dataset.
 * Extends the existing OfflineCoachContext shape conceptually (same field names
 * where overlapping) so the same coach route can handle both V1 and V2.
 */
export interface V2CoachContext {
  /** Identifies this as a V2 dynamic investigation */
  mode: "v2";
  datasetId: string;
  /** One-sentence dataset description */
  datasetSummary: string;
  /** Attack type inferred from story (e.g. "Brute Force") */
  attackType: string;
  /** Overall confidence 0–100 */
  overallConfidence: number;
  /** Number of events */
  eventCount: number;
  /** Number of suspicious events */
  suspiciousEventCount: number;
  /** Currently focused event (if user clicked one) */
  focusedEvent?: {
    id: string;
    eventType: string;
    timestamp: string;
    description: string;
  };
  /** The attack stages inferred */
  attackStages: Array<{
    name: string;
    confidence: number;
    eventCount: number;
  }>;
  /** MITRE techniques mapped */
  mitreTechniques: Array<{
    techniqueId: string;
    techniqueName: string;
    confidence: number;
  }>;
  /** What the user has done so far in this investigation session */
  userActions: Array<{
    action: "viewed_event" | "inspected_relationship" | "viewed_ioc" | "read_stage";
    target: string;
    timestamp: string;
  }>;
}

// ─── V2 Coach Action Types ────────────────────────────────────────────────────

export type V2CoachActionType =
  | "hint"
  | "explain-event"
  | "explain-relationship"
  | "explain-stage"
  | "next-step"
  | "explain-mistakes"
  | "summarize-investigation";

// ─── Processing Stage (for UI progress display) ───────────────────────────────

export type ProcessingStageStatus = "pending" | "active" | "complete" | "error";

export interface ProcessingStage {
  id: string;
  label: string;
  status: ProcessingStageStatus;
  /** Optional detail shown below the label */
  detail?: string;
}

export const DEFAULT_PROCESSING_STAGES: ProcessingStage[] = [
  { id: "upload",      label: "Uploading",            status: "pending" },
  { id: "parse",       label: "Parsing",              status: "pending" },
  { id: "normalize",   label: "Normalizing",          status: "pending" },
  { id: "correlate",   label: "Correlating Events",   status: "pending" },
  { id: "reconstruct", label: "Reconstructing",       status: "pending" },
  { id: "mitre",       label: "Mapping MITRE ATT&CK", status: "pending" },
  { id: "ioc",         label: "Extracting IOCs",      status: "pending" },
  { id: "ready",       label: "Ready",                status: "pending" },
];

// ─── Dataset Overview (shown after upload, before reconstruction) ─────────────

export interface DatasetOverview {
  datasetId: string;
  fileName: string;
  fileSizeBytes: number;
  format: IngestionFormat;
  totalEvents: number;
  validEvents: number;
  invalidRecords: number;
  timeRange: { start: string; end: string } | null;
  detectedEventTypes: string[];
  uniqueHosts: string[];
  uniqueUsers: string[];
  uniqueIps: string[];
  warnings: string[];
  errors: IngestionError[];
  detectedSchema?: DetectedSchema;
  skippedRecords?: SkippedRecord[];
}

// ─── Guard utilities ──────────────────────────────────────────────────────────

/** Returns true if a string looks like a valid IPv4 address */
export function isIpv4(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
    value.split(".").every((octet) => parseInt(octet, 10) <= 255);
}

/** Returns true if a string looks like a valid IPv6 address */
export function isIpv6(value: string): boolean {
  return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value) ||
    /^::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/.test(value) ||
    value === "::1";
}

/** Returns true if a string looks like an MD5 hash */
export function isMd5(value: string): boolean {
  return /^[a-fA-F0-9]{32}$/.test(value);
}

/** Returns true if a string looks like a SHA1 hash */
export function isSha1(value: string): boolean {
  return /^[a-fA-F0-9]{40}$/.test(value);
}

/** Returns true if a string looks like a SHA256 hash */
export function isSha256(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value);
}

/** Returns true if a string looks like a domain name */
export function isDomain(value: string): boolean {
  return /^(?!-)([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/.test(value);
}

/** Returns true if a string looks like an email address */
export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Returns true if a string looks like a URL */
export function isUrl(value: string): boolean {
  return /^https?:\/\/[^\s]+$/.test(value);
}

/** Returns true if a string looks like a Windows or Unix file path */
export function isFilePath(value: string): boolean {
  return /^[A-Za-z]:\\/.test(value) || /^\/[^\s]/.test(value);
}
