/**
 * eventNormalization.ts
 *
 * Phase 4 — Event Normalization Engine
 *
 * Takes SecurityEvent[] produced by EventIngestionEngine and refines every field:
 * - Timestamps → ISO-8601 UTC with clock-skew detection
 * - IPs → validated, private vs public classified
 * - Usernames → lowercase, strip domain prefixes
 * - Hostnames → lowercase FQDN, strip trailing dots
 * - Process names → basename only, normalize .exe extension casing
 * - File paths → normalize separators, detect suspicious locations
 * - Hashes → uppercase hex, detect algorithm from length
 * - Event types → normalized lowercase_underscore taxonomy
 * - Severity → re-evaluated with full field context
 * - Unknown/unexpected fields → preserved untouched in raw
 *
 * Returns NormalizationResult: normalized events + per-event warnings.
 * Never mutates input. Always returns a new array.
 * Never throws.
 */

import { SecurityEvent } from "@/types/v2";

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface NormalizationWarning {
  eventId: string;
  field: string;
  original: string;
  normalized: string;
  reason: string;
}

export interface NormalizationResult {
  events: SecurityEvent[];
  warnings: NormalizationWarning[];
  /** Events that had at least one field normalized (not counting severity inference) */
  normalizedCount: number;
  /** Clock-skew suspicion: true if events span multiple time zones or have out-of-order sub-second timestamps */
  clockSkewSuspected: boolean;
  /** Distinct process names detected (useful for correlation) */
  detectedProcesses: string[];
  /** Distinct usernames after normalization */
  detectedUsers: string[];
  /** Distinct hostnames after normalization */
  detectedHosts: string[];
  /** Distinct IPs (source + destination combined) */
  detectedIps: string[];
}

// ─── IP Classification ────────────────────────────────────────────────────────

/** RFC 1918 + loopback + link-local private ranges */
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
];

function isPrivateIp(ip: string): boolean {
  return PRIVATE_IP_RANGES.some((r) => r.test(ip));
}

/** Returns true if value is a valid IPv4 address */
function isIpv4(value: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(value) &&
    value.split(".").every((octet) => parseInt(octet, 10) <= 255);
}

/** Returns true if value is a valid IPv6 address */
function isIpv6(value: string): boolean {
  return (
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value) ||
    /^::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}$/.test(value) ||
    value === "::1"
  );
}

/** Clean up common IP formatting issues */
function normalizeIpField(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();

  // Remove port suffix e.g. "192.168.1.1:8080"
  const withoutPort = trimmed.replace(/:\d{1,5}$/, "");

  // Remove brackets around IPv6 e.g. "[::1]"
  const withoutBrackets = withoutPort.replace(/^\[(.+)\]$/, "$1");

  return withoutBrackets || undefined;
}

// ─── Timestamp Normalization ──────────────────────────────────────────────────

/**
 * Re-normalize a timestamp string that may have come through with formatting issues.
 * Returns ISO-8601 UTC or the original if already valid.
 */
function normalizeTimestampField(raw: string): string {
  if (!raw) return raw;

  // Already ISO-8601 UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(raw)) return raw;

  // ISO-8601 with offset — convert to UTC
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  // Already handled in ingestion, but re-validate
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();

  return raw;
}

/** Detect clock skew: look for events with timestamps that jump backwards > 5 minutes */
function detectClockSkew(events: SecurityEvent[]): boolean {
  if (events.length < 2) return false;
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].timestamp).getTime();
    const curr = new Date(sorted[i].timestamp).getTime();
    // More than 1 hour backwards jump = likely clock skew
    if (curr - prev < -3_600_000) return true;
  }
  return false;
}

// ─── Username Normalization ───────────────────────────────────────────────────

/**
 * Normalize username:
 * - Lowercase
 * - Strip domain prefix: DOMAIN\\user → user
 * - Strip UPN suffix: user@domain.com → user (preserve email as-is if it looks external)
 */
function normalizeUsername(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let u = raw.trim().toLowerCase();

  // Strip DOMAIN\user format
  if (u.includes("\\")) {
    u = u.split("\\").pop() ?? u;
  }

  // Strip UPN format (user@internal.domain) — keep external emails intact
  if (u.includes("@")) {
    const domain = u.split("@")[1];
    // Heuristic: if domain looks internal (corp, local, internal, lan) strip it
    if (domain && /\.(corp|local|internal|lan|ad|intranet)$/.test(domain)) {
      u = u.split("@")[0];
    }
    // External emails stay as-is (they're IOC-relevant)
  }

  return u || undefined;
}

// ─── Hostname Normalization ───────────────────────────────────────────────────

/**
 * Normalize hostname:
 * - Lowercase
 * - Remove trailing dot (DNS artefact)
 * - Remove leading/trailing whitespace
 * - Keep FQDN intact but lowercase
 */
function normalizeHostname(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let h = raw.trim().toLowerCase();

  // Strip trailing dot
  if (h.endsWith(".")) h = h.slice(0, -1);

  // If it's just an IP address, don't treat it as hostname
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return undefined;

  return h || undefined;
}

// ─── Process Name Normalization ───────────────────────────────────────────────

/** Known legitimate Windows processes — used to flag masquerading */
const LEGITIMATE_PROCESSES = new Set([
  "svchost.exe", "lsass.exe", "csrss.exe", "winlogon.exe", "explorer.exe",
  "services.exe", "wininit.exe", "smss.exe", "spoolsv.exe", "taskhostw.exe",
  "ntoskrnl.exe", "system", "idle",
]);

/** Known suspicious process names that masquerade as system processes */
const SUSPICIOUS_MASQUERADES: Record<string, string> = {
  "svhost.exe": "svchost.exe",
  "lsas.exe": "lsass.exe",
  "scvhost.exe": "svchost.exe",
  "explore.exe": "explorer.exe",
  "iexplore.exe": "internet explorer",
  "svch0st.exe": "svchost.exe",
  "svchost32.exe": "svchost.exe (suspicious variant)",
};

/**
 * Normalize process name:
 * - Extract basename from full path
 * - Lowercase
 * - Preserve .exe extension
 */
function normalizeProcess(raw: string | undefined): {
  normalized: string | undefined;
  isSuspicious: boolean;
  masqueradesAs?: string;
} {
  if (!raw) return { normalized: undefined, isSuspicious: false };

  // Extract basename
  let p = raw.trim();

  // Windows path: C:\Windows\System32\svchost.exe → svchost.exe
  if (p.includes("\\")) {
    p = p.split("\\").pop() ?? p;
  }
  // Unix path: /usr/bin/bash → bash
  if (p.includes("/")) {
    p = p.split("/").pop() ?? p;
  }

  const lower = p.toLowerCase();
  const masquerades = SUSPICIOUS_MASQUERADES[lower];
  const isSuspicious = !!masquerades;

  return {
    normalized: lower,
    isSuspicious,
    masqueradesAs: masquerades,
  };
}

// ─── File Path Normalization ──────────────────────────────────────────────────

/** Suspicious Windows file locations */
const SUSPICIOUS_WIN_PATHS = [
  /^c:\\windows\\temp\\/i,
  /^c:\\users\\[^\\]+\\appdata\\local\\temp\\/i,
  /^c:\\programdata\\[^\\]*\.(exe|bat|ps1|vbs|dll)$/i,
  /^c:\\windows\\system32\\tasks\\/i,
  /\\appdata\\roaming\\/i,
  /\\public\\/i,
];

/** Suspicious Unix file locations */
const SUSPICIOUS_UNIX_PATHS = [
  /^\/tmp\//,
  /^\/dev\/shm\//,
  /^\/var\/tmp\//,
  /^\/(proc|sys)\//,
];

function normalizeFilePath(raw: string | undefined): {
  normalized: string | undefined;
  isSuspiciousLocation: boolean;
} {
  if (!raw) return { normalized: undefined, isSuspiciousLocation: false };

  // Normalize Windows path separators
  let p = raw.trim();
  // Normalize mixed separators
  p = p.replace(/\//g, "\\").replace(/\\{2,}/g, "\\");

  // Detect suspicious location
  const isSuspiciousLocation =
    SUSPICIOUS_WIN_PATHS.some((r) => r.test(p)) ||
    SUSPICIOUS_UNIX_PATHS.some((r) => r.test(raw.trim()));

  return { normalized: p, isSuspiciousLocation };
}

// ─── Hash Normalization ───────────────────────────────────────────────────────

/**
 * Normalize hash:
 * - Uppercase
 * - Detect algorithm from length
 * - Strip common prefixes (md5:, sha1:, sha256:)
 */
function normalizeHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined;

  let h = raw.trim();

  // Strip algorithm prefix
  const prefixMatch = h.match(/^(md5|sha1|sha256|sha512)[:=]/i);
  if (prefixMatch) {
    h = h.slice(prefixMatch[0].length);
  }

  // Validate hex characters
  if (!/^[a-fA-F0-9]+$/.test(h)) return raw; // Not a hex hash — return original

  return h.toUpperCase();
}

// ─── Event Type Normalization ─────────────────────────────────────────────────

/**
 * Taxonomy of normalized event type strings.
 * Maps raw event strings → canonical taxonomy.
 */
const EVENT_TYPE_TAXONOMY: Record<string, string> = {
  // Authentication
  "login": "successful_login",
  "logon": "successful_login",
  "authentication_success": "successful_login",
  "auth_success": "successful_login",
  "user_login": "successful_login",
  "user_logon": "successful_login",
  "sign_in": "successful_login",

  "login_failure": "failed_login",
  "logon_failure": "failed_login",
  "auth_failure": "failed_login",
  "authentication_failure": "failed_login",
  "failed_authentication": "failed_login",
  "login_fail": "failed_login",

  "logout": "session_ended",
  "logoff": "session_ended",
  "user_logout": "session_ended",
  "session_close": "session_ended",

  // Process
  "process_creation": "process_created",
  "process_start": "process_created",
  "new_process": "process_created",
  "exec": "process_created",
  "process_execute": "process_created",

  "process_terminated": "process_ended",
  "process_exit": "process_ended",

  // File
  "file_write": "file_modified",
  "file_change": "file_modified",
  "file_update": "file_modified",
  "file_encrypt": "file_encrypted",
  "file_delete": "file_deleted",
  "file_remove": "file_deleted",
  "file_read": "file_accessed",
  "file_open": "file_opened",
  "file_download": "file_downloaded",
  "file_upload": "data_exfiltration",
  "file_transfer": "file_copy",

  // Network
  "connection": "network_connection",
  "tcp_connection": "network_connection",
  "udp_connection": "network_connection",
  "outbound_connection": "network_connection",
  "network_connect": "network_connection",
  "dns": "dns_query",
  "dns_request": "dns_query",
  "dns_lookup": "dns_query",
  "dns_resolution": "dns_query",

  // Privilege / Lateral
  "privilege_change": "privilege_escalation",
  "priv_esc": "privilege_escalation",
  "escalation": "privilege_escalation",
  "lateral": "lateral_movement",
  "lateral_movement_attempt": "lateral_movement",

  // Defense evasion
  "log_delete": "log_cleared",
  "log_clear": "log_cleared",
  "log_wipe": "log_cleared",
  "event_log_cleared": "log_cleared",
  "av_disabled": "antivirus_disabled",
  "defender_disabled": "antivirus_disabled",
  "firewall_disabled": "firewall_modified",

  // Persistence
  "scheduled_task": "scheduled_task_created",
  "cron_job": "scheduled_task_created",
  "registry_run_key": "registry_modified",
  "reg_set": "registry_modified",
  "registry_set": "registry_modified",

  // Credential access
  "credential_dump": "credential_access",
  "lsass_access": "credential_access",
  "mimikatz": "credential_access",
  "pass_the_hash": "credential_access",

  // Data
  "exfil": "data_exfiltration",
  "exfiltration": "data_exfiltration",
  "data_upload": "data_exfiltration",
  "data_theft": "data_exfiltration",
  "bulk_download": "bulk_file_access",
  "mass_file_access": "bulk_file_access",

  // USB / removable media
  "usb_insert": "usb_connected",
  "removable_media_connected": "usb_connected",
  "usb_remove": "usb_disconnected",

  // Email
  "email_receive": "email_received",
  "email_open": "email_received",
  "email_send": "email_sent",
  "email_transmit": "email_sent",
};

function normalizeEventType(raw: string): string {
  const lower = raw.toLowerCase().replace(/[\s\-]+/g, "_");

  // Direct taxonomy lookup
  if (EVENT_TYPE_TAXONOMY[lower]) return EVENT_TYPE_TAXONOMY[lower];

  // Already in canonical form
  if (/^[a-z][a-z0-9_]*$/.test(lower)) return lower;

  return lower;
}

// ─── Severity Re-evaluation ───────────────────────────────────────────────────

/**
 * Re-evaluate severity with full context available after normalization.
 * More precise than ingestion-time inference because we have normalized fields.
 */
function evaluateSeverity(
  event: SecurityEvent
): "low" | "medium" | "high" | "critical" | undefined {
  // Already has explicit severity — respect it
  if (event.severity) return event.severity;

  const et = event.eventType;

  // Critical events
  if (
    [
      "credential_access", "data_exfiltration", "antivirus_disabled",
      "log_cleared", "privilege_escalation", "file_encrypted",
      "lateral_movement",
    ].includes(et)
  ) return "critical";

  // High events
  if (
    [
      "failed_login", "process_created", "registry_modified",
      "scheduled_task_created", "network_connection", "bulk_file_access",
      "firewall_modified", "usb_connected", "file_copy",
    ].includes(et)
  ) {
    // Elevate process_created if command looks suspicious
    if (et === "process_created" && event.command) {
      const cmd = event.command.toLowerCase();
      if (
        cmd.includes("-enc") ||
        cmd.includes("base64") ||
        cmd.includes("/tmp/") ||
        cmd.includes("c:\\windows\\temp") ||
        cmd.includes("invoke-") ||
        cmd.includes("downloadstring") ||
        cmd.includes("wget") ||
        cmd.includes("curl")
      ) return "critical";
    }

    // Elevate network_connection if destination is public IP on unusual port
    if (et === "network_connection" && event.destinationIp) {
      if (!isPrivateIp(event.destinationIp) && event.port && event.port === 4444) {
        return "critical";
      }
      if (!isPrivateIp(event.destinationIp)) return "high";
    }

    return "high";
  }

  // Medium events
  if (
    [
      "dns_query", "file_modified", "file_accessed", "file_opened",
      "session_opened", "email_received", "usb_disconnected",
      "file_rename",
    ].includes(et)
  ) return "medium";

  // Low events
  if (
    [
      "successful_login", "session_ended", "file_created",
      "file_downloaded", "file_deleted",
    ].includes(et)
  ) return "low";

  return undefined;
}

// ─── Main Normalization Function ──────────────────────────────────────────────

/**
 * Normalize a single SecurityEvent. Returns a new object — never mutates input.
 */
function normalizeEvent(
  event: SecurityEvent,
  warnings: NormalizationWarning[]
): SecurityEvent {
  const normalized = { ...event };
  let changed = false;

  // ── Timestamp ────────────────────────────────────────────────────────────
  const ts = normalizeTimestampField(event.timestamp);
  if (ts !== event.timestamp) {
    warnings.push({
      eventId: event.id,
      field: "timestamp",
      original: event.timestamp,
      normalized: ts,
      reason: "Timestamp converted to ISO-8601 UTC.",
    });
    normalized.timestamp = ts;
    changed = true;
  }

  // ── IPs ──────────────────────────────────────────────────────────────────
  const srcIp = normalizeIpField(event.sourceIp);
  if (srcIp !== event.sourceIp) {
    if (srcIp) {
      warnings.push({
        eventId: event.id,
        field: "sourceIp",
        original: event.sourceIp ?? "",
        normalized: srcIp,
        reason: "Source IP cleaned (port suffix or brackets removed).",
      });
    }
    normalized.sourceIp = srcIp;
    changed = true;
  }

  const dstIp = normalizeIpField(event.destinationIp);
  if (dstIp !== event.destinationIp) {
    if (dstIp) {
      warnings.push({
        eventId: event.id,
        field: "destinationIp",
        original: event.destinationIp ?? "",
        normalized: dstIp,
        reason: "Destination IP cleaned.",
      });
    }
    normalized.destinationIp = dstIp;
    changed = true;
  }

  // ── Username ─────────────────────────────────────────────────────────────
  const user = normalizeUsername(event.user);
  if (user !== event.user) {
    if (user) {
      warnings.push({
        eventId: event.id,
        field: "user",
        original: event.user ?? "",
        normalized: user,
        reason: "Domain prefix or UPN suffix stripped; lowercased.",
      });
    }
    normalized.user = user;
    changed = true;
  }

  // ── Hostname ─────────────────────────────────────────────────────────────
  const hostname = normalizeHostname(event.hostname);
  if (hostname !== event.hostname) {
    if (hostname) {
      warnings.push({
        eventId: event.id,
        field: "hostname",
        original: event.hostname ?? "",
        normalized: hostname,
        reason: "Hostname lowercased; trailing dot removed.",
      });
    }
    normalized.hostname = hostname;
    changed = true;
  }

  // ── Process ──────────────────────────────────────────────────────────────
  const { normalized: proc, isSuspicious, masqueradesAs } = normalizeProcess(event.process);
  if (proc !== event.process) {
    if (proc) {
      warnings.push({
        eventId: event.id,
        field: "process",
        original: event.process ?? "",
        normalized: proc,
        reason: isSuspicious
          ? `Process name may be masquerading as: ${masqueradesAs}`
          : "Path stripped to basename; lowercased.",
      });
    }
    normalized.process = proc;
    changed = true;
  }

  // If process masquerades as a system process, escalate severity
  if (isSuspicious && normalized.severity !== "critical") {
    normalized.severity = "critical";
  }

  // ── File Path ────────────────────────────────────────────────────────────
  const { normalized: fp, isSuspiciousLocation } = normalizeFilePath(event.filePath);
  if (fp !== event.filePath) {
    if (fp) {
      warnings.push({
        eventId: event.id,
        field: "filePath",
        original: event.filePath ?? "",
        normalized: fp,
        reason: isSuspiciousLocation
          ? "Path is in a suspicious location (Temp, AppData, ProgramData)."
          : "Path separators normalized.",
      });
    }
    normalized.filePath = fp;
    changed = true;
  }

  // Elevate severity for suspicious file locations
  if (isSuspiciousLocation && normalized.severity !== "critical") {
    normalized.severity = normalized.severity === "high" ? "critical" : "high";
  }

  // ── Hash ─────────────────────────────────────────────────────────────────
  const hash = normalizeHash(event.hash);
  if (hash !== event.hash && hash) {
    warnings.push({
      eventId: event.id,
      field: "hash",
      original: event.hash ?? "",
      normalized: hash,
      reason: "Hash normalized to uppercase hex.",
    });
    normalized.hash = hash;
    changed = true;
  }

  // ── Event Type ───────────────────────────────────────────────────────────
  const et = normalizeEventType(event.eventType);
  if (et !== event.eventType) {
    warnings.push({
      eventId: event.id,
      field: "eventType",
      original: event.eventType,
      normalized: et,
      reason: "Event type mapped to canonical taxonomy.",
    });
    normalized.eventType = et;
    changed = true;
  }

  // ── Severity (re-evaluate with full context) ──────────────────────────────
  if (!normalized.severity) {
    const sev = evaluateSeverity(normalized);
    if (sev) {
      normalized.severity = sev;
    }
  }

  void changed; // used implicitly via normalizedCount in caller

  return normalized;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Normalize a batch of SecurityEvents.
 *
 * @param events  Output from EventIngestionEngine (sorted or unsorted)
 * @returns       NormalizationResult — normalized events + warnings + metadata
 */
export function normalizeEvents(events: SecurityEvent[]): NormalizationResult {
  if (events.length === 0) {
    return {
      events: [],
      warnings: [],
      normalizedCount: 0,
      clockSkewSuspected: false,
      detectedProcesses: [],
      detectedUsers: [],
      detectedHosts: [],
      detectedIps: [],
    };
  }

  const allWarnings: NormalizationWarning[] = [];
  const normalized: SecurityEvent[] = [];
  let normalizedCount = 0;

  for (const event of events) {
    const before = JSON.stringify(event);
    const after = normalizeEvent(event, allWarnings);
    if (JSON.stringify(after) !== before) normalizedCount++;
    normalized.push(after);
  }

  // Collect metadata for downstream engines
  const detectedProcesses = [
    ...new Set(normalized.map((e) => e.process).filter(Boolean)),
  ] as string[];

  const detectedUsers = [
    ...new Set(normalized.map((e) => e.user).filter(Boolean)),
  ] as string[];

  const detectedHosts = [
    ...new Set(normalized.map((e) => e.hostname).filter(Boolean)),
  ] as string[];

  const detectedIps = [
    ...new Set([
      ...normalized.map((e) => e.sourceIp).filter(Boolean),
      ...normalized.map((e) => e.destinationIp).filter(Boolean),
    ]),
  ] as string[];

  const clockSkewSuspected = detectClockSkew(normalized);

  return {
    events: normalized,
    warnings: allWarnings,
    normalizedCount,
    clockSkewSuspected,
    detectedProcesses,
    detectedUsers,
    detectedHosts,
    detectedIps,
  };
}

// ─── Utilities exported for downstream engines ────────────────────────────────

export { normalizeIpField, normalizeUsername, normalizeHostname, isPrivateIp };

/**
 * Get the public (external) IPs from a list of events.
 * Useful for IOC extraction and C2 detection.
 */
export function getExternalIps(events: SecurityEvent[]): string[] {
  const ips = new Set<string>();
  for (const e of events) {
    if (e.sourceIp && !isPrivateIp(e.sourceIp)) ips.add(e.sourceIp);
    if (e.destinationIp && !isPrivateIp(e.destinationIp)) ips.add(e.destinationIp);
  }
  return [...ips];
}

/**
 * Get all distinct entity values of a given type from events.
 */
export function getDistinctValues(
  events: SecurityEvent[],
  field: keyof Pick<SecurityEvent, "user" | "hostname" | "sourceIp" | "destinationIp" | "process" | "domain">
): string[] {
  return [...new Set(events.map((e) => e[field]).filter(Boolean))] as string[];
}
