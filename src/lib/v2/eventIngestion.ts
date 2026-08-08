/**
 * eventIngestion.ts
 *
 * Phase 3 — Event Ingestion Engine
 *
 * Accepts raw string input in JSON, NDJSON, or CSV format.
 * Parses, validates, maps fields to the canonical SecurityEvent model,
 * assigns stable IDs, and returns an IngestionResult.
 *
 * Rules:
 * - Never throws. Always returns partial results with errors.
 * - Never destroys original fields — always preserved in `raw`.
 * - Duplicates (identical timestamp + eventType + sourceIp + user) are removed.
 */

import { randomUUID } from "crypto";
import {
  SecurityEvent,
  IngestionResult,
  IngestionError,
  IngestionFormat,
  DatasetOverview,
  isIpv4,
  isIpv6,
} from "@/types/v2";

// ─── Field detection maps ─────────────────────────────────────────────────────
// Priority order: first match wins.

const TIMESTAMP_FIELDS = [
  "timestamp", "time", "@timestamp", "datetime", "ts",
  "created_at", "event_time", "log_time", "occurred_at",
  "date", "start_time", "end_time",
];

const SOURCE_IP_FIELDS = [
  "source_ip", "src_ip", "sourceIp", "src", "remote_addr",
  "client_ip", "originating_ip", "attacker_ip", "source",
];

const DEST_IP_FIELDS = [
  "dest_ip", "destination_ip", "dst_ip", "destinationIp",
  "target_ip", "server_ip", "dst",
];

const USER_FIELDS = [
  "user", "username", "user_name", "account", "principal",
  "actor", "subject", "login", "logon_user", "uid",
];

const HOSTNAME_FIELDS = [
  "hostname", "host", "machine", "computer", "device",
  "workstation", "endpoint", "node", "asset",
];

const EVENT_TYPE_FIELDS = [
  "event", "event_type", "event_id", "action", "type",
  "category", "event_name", "operation", "activity",
];

const PROCESS_FIELDS = [
  "process", "process_name", "proc", "image", "executable",
  "application", "app",
];

const COMMAND_FIELDS = [
  "command", "command_line", "commandLine", "cmdline",
  "cmd", "args", "arguments",
];

const FILE_PATH_FIELDS = [
  "file_path", "filePath", "file", "path", "target_file",
  "object_name", "filename",
];

const HASH_FIELDS = [
  "hash", "file_hash", "md5", "sha1", "sha256", "sha512",
  "checksum", "digest",
];

const DOMAIN_FIELDS = [
  "domain", "fqdn", "dns_query", "query_name", "host_domain",
  "destination_domain", "dns",
];

const PORT_FIELDS = [
  "port", "dest_port", "dst_port", "destination_port",
  "src_port", "source_port",
];

const PROTOCOL_FIELDS = [
  "protocol", "proto", "transport", "layer4",
];

const SEVERITY_FIELDS = [
  "severity", "level", "priority", "risk", "criticality",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Look up the first matching field value from a record.
 * Returns undefined if none found or value is null/empty.
 */
function pickField(
  record: Record<string, unknown>,
  candidates: string[]
): string | undefined {
  for (const key of candidates) {
    // exact match
    if (key in record) {
      const v = record[key];
      if (v !== null && v !== undefined && String(v).trim() !== "") {
        return String(v).trim();
      }
    }
    // case-insensitive match
    const lower = key.toLowerCase();
    for (const rKey of Object.keys(record)) {
      if (rKey.toLowerCase() === lower) {
        const v = record[rKey];
        if (v !== null && v !== undefined && String(v).trim() !== "") {
          return String(v).trim();
        }
      }
    }
  }
  return undefined;
}

function pickNumber(
  record: Record<string, unknown>,
  candidates: string[]
): number | undefined {
  const raw = pickField(record, candidates);
  if (!raw) return undefined;
  const n = Number(raw);
  return isNaN(n) ? undefined : n;
}

/**
 * Normalize a timestamp string to ISO-8601 UTC.
 * Accepts: ISO-8601, Unix seconds, Unix milliseconds, common date strings.
 * Returns null if unparseable.
 */
function normalizeTimestamp(raw: string): string | null {
  if (!raw) return null;

  // Unix epoch (seconds — 10 digits)
  if (/^\d{10}$/.test(raw.trim())) {
    return new Date(parseInt(raw, 10) * 1000).toISOString();
  }
  // Unix epoch (milliseconds — 13 digits)
  if (/^\d{13}$/.test(raw.trim())) {
    return new Date(parseInt(raw, 10)).toISOString();
  }

  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
}

/**
 * Normalize an IP address string.
 * Returns the input if it's a valid IPv4 or IPv6, otherwise undefined.
 */
function normalizeIp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (isIpv4(trimmed) || isIpv6(trimmed)) return trimmed;
  return undefined;
}

/**
 * Normalize severity from raw string to our enum values.
 */
function normalizeSeverity(
  raw: string | undefined
): "low" | "medium" | "high" | "critical" | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (["critical", "crit", "fatal", "emergency"].includes(lower)) return "critical";
  if (["high", "error", "alert", "warning", "warn"].includes(lower)) return "high";
  if (["medium", "moderate", "notice"].includes(lower)) return "medium";
  if (["low", "info", "information", "debug", "verbose"].includes(lower)) return "low";
  // Numeric severity (syslog-style: 0=emergency … 7=debug)
  const n = parseInt(lower, 10);
  if (!isNaN(n)) {
    if (n <= 2) return "critical";
    if (n <= 4) return "high";
    if (n <= 5) return "medium";
    return "low";
  }
  return undefined;
}

/**
 * Infer severity from event type string when no explicit severity field exists.
 */
function inferSeverityFromEventType(
  eventType: string
): "low" | "medium" | "high" | "critical" | undefined {
  const lower = eventType.toLowerCase();
  if (
    lower.includes("ransomware") ||
    lower.includes("encrypt") ||
    lower.includes("exfil") ||
    lower.includes("lsass") ||
    lower.includes("mimikatz") ||
    lower.includes("rootkit")
  ) return "critical";

  if (
    lower.includes("brute") ||
    lower.includes("malware") ||
    lower.includes("exploit") ||
    lower.includes("lateral") ||
    lower.includes("privilege") ||
    lower.includes("credential") ||
    lower.includes("reverse_shell") ||
    lower.includes("c2") ||
    lower.includes("beacon")
  ) return "high";

  if (
    lower.includes("failed_login") ||
    lower.includes("login_fail") ||
    lower.includes("auth_fail") ||
    lower.includes("suspicious") ||
    lower.includes("anomal") ||
    lower.includes("unusual") ||
    lower.includes("scan") ||
    lower.includes("recon")
  ) return "medium";

  if (
    lower.includes("successful_login") ||
    lower.includes("login_success") ||
    lower.includes("access") ||
    lower.includes("read") ||
    lower.includes("write")
  ) return "low";

  return undefined;
}

/**
 * Build a deduplication key for an event.
 */
function dedupKey(event: SecurityEvent): string {
  return [
    event.timestamp.slice(0, 19), // second-level precision
    event.eventType,
    event.sourceIp ?? "",
    event.user ?? "",
    event.hostname ?? "",
  ].join("|");
}

// ─── JSON Parser ──────────────────────────────────────────────────────────────

function parseJson(
  input: string
): { records: Record<string, unknown>[]; parseError?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { records: [], parseError: "Input is empty." };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return { records: parsed as Record<string, unknown>[] };
    }
    if (typeof parsed === "object" && parsed !== null) {
      // Single object — wrap in array
      return { records: [parsed as Record<string, unknown>] };
    }
    return { records: [], parseError: "JSON must be an array of objects or a single object." };
  } catch (e) {
    return { records: [], parseError: `JSON parse error: ${(e as Error).message}` };
  }
}

// ─── NDJSON Parser ────────────────────────────────────────────────────────────

function parseNdjson(
  input: string
): { records: Record<string, unknown>[]; errors: IngestionError[] } {
  const lines = input.split("\n").filter((l) => l.trim().length > 0);
  const records: Record<string, unknown>[] = [];
  const errors: IngestionError[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (typeof parsed === "object" && parsed !== null) {
        records.push(parsed as Record<string, unknown>);
      } else {
        errors.push({ recordIndex: i, message: "Line is not a JSON object.", raw: lines[i] });
      }
    } catch (e) {
      errors.push({
        recordIndex: i,
        message: `JSON parse error on line ${i + 1}: ${(e as Error).message}`,
        raw: lines[i],
      });
    }
  }

  return { records, errors };
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(
  input: string
): { records: Record<string, unknown>[]; errors: IngestionError[] } {
  const lines = input.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { records: [], errors: [{ recordIndex: 0, message: "CSV must have a header row and at least one data row." }] };
  }

  // Parse header — handle quoted headers
  const headers = parseCsvLine(lines[0]);
  const records: Record<string, unknown>[] = [];
  const errors: IngestionError[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      if (values.length !== headers.length) {
        errors.push({
          recordIndex: i,
          message: `Row ${i + 1} has ${values.length} columns but header has ${headers.length}.`,
          raw: lines[i],
        });
        continue;
      }
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j];
      }
      records.push(record);
    } catch (e) {
      errors.push({ recordIndex: i, message: `CSV parse error on row ${i + 1}: ${(e as Error).message}`, raw: lines[i] });
    }
  }

  return { records, errors };
}

/**
 * Simple CSV line parser — handles quoted fields with commas inside.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

// ─── Record → SecurityEvent ───────────────────────────────────────────────────

interface MapResult {
  event?: SecurityEvent;
  error?: IngestionError;
  missingTimestamp: boolean;
}

function mapRecordToEvent(
  record: Record<string, unknown>,
  recordIndex: number
): MapResult {
  // Timestamp — required
  const rawTs = pickField(record, TIMESTAMP_FIELDS);
  if (!rawTs) {
    return {
      missingTimestamp: true,
      error: {
        recordIndex,
        field: "timestamp",
        message: "No timestamp field found. Tried: " + TIMESTAMP_FIELDS.slice(0, 5).join(", ") + "...",
        raw: record,
      },
    };
  }

  const timestamp = normalizeTimestamp(rawTs);
  if (!timestamp) {
    return {
      missingTimestamp: true,
      error: {
        recordIndex,
        field: "timestamp",
        message: `Could not parse timestamp value: "${rawTs}"`,
        raw: record,
      },
    };
  }

  // Event type — use "unknown_event" if not found
  const rawEventType = pickField(record, EVENT_TYPE_FIELDS) ?? "unknown_event";
  const eventType = rawEventType.toLowerCase().replace(/\s+/g, "_");

  // IP fields
  const rawSourceIp = pickField(record, SOURCE_IP_FIELDS);
  const rawDestIp = pickField(record, DEST_IP_FIELDS);

  // Severity
  const rawSeverity = pickField(record, SEVERITY_FIELDS);
  const severity =
    normalizeSeverity(rawSeverity) ??
    inferSeverityFromEventType(eventType);

  const event: SecurityEvent = {
    id: randomUUID(),
    timestamp,
    eventType,
    source: pickField(record, ["log_source", "source_type", "log_type", "data_source"]),
    sourceIp: normalizeIp(rawSourceIp),
    destinationIp: normalizeIp(rawDestIp),
    user: pickField(record, USER_FIELDS)?.toLowerCase(),
    hostname: pickField(record, HOSTNAME_FIELDS)?.toLowerCase(),
    process: pickField(record, PROCESS_FIELDS),
    command: pickField(record, COMMAND_FIELDS),
    filePath: pickField(record, FILE_PATH_FIELDS),
    hash: pickField(record, HASH_FIELDS),
    domain: pickField(record, DOMAIN_FIELDS),
    port: pickNumber(record, PORT_FIELDS),
    protocol: pickField(record, PROTOCOL_FIELDS)?.toLowerCase(),
    severity,
    raw: record,
  };

  return { event, missingTimestamp: false };
}

// ─── Detect all field names across records ────────────────────────────────────

function collectFieldNames(records: Record<string, unknown>[]): string[] {
  const fields = new Set<string>();
  for (const r of records) {
    for (const k of Object.keys(r)) fields.add(k);
  }
  return [...fields].sort();
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Parse, validate, and normalize a raw event dataset string.
 *
 * @param rawInput  Raw string content (JSON array, NDJSON, or CSV)
 * @param format    Explicit format hint. If omitted, auto-detected.
 * @returns         IngestionResult — always returned, never throws
 */
export function ingestEvents(
  rawInput: string,
  format?: IngestionFormat
): IngestionResult {
  const datasetId = `ds_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const errors: IngestionError[] = [];
  const warnings: string[] = [];

  // ── 1. Auto-detect format if not provided ──────────────────────────────────
  const detectedFormat: IngestionFormat = format ?? detectFormat(rawInput);

  // ── 2. Parse into raw records ──────────────────────────────────────────────
  let rawRecords: Record<string, unknown>[] = [];

  if (detectedFormat === "json") {
    const { records, parseError } = parseJson(rawInput);
    if (parseError) {
      errors.push({ recordIndex: 0, message: parseError, raw: rawInput.slice(0, 200) });
    }
    rawRecords = records;
  } else if (detectedFormat === "ndjson") {
    const { records, errors: ndjsonErrors } = parseNdjson(rawInput);
    rawRecords = records;
    errors.push(...ndjsonErrors);
  } else {
    const { records, errors: csvErrors } = parseCsv(rawInput);
    rawRecords = records;
    errors.push(...csvErrors);
  }

  const totalInputRecords = rawRecords.length;
  const detectedFields = collectFieldNames(rawRecords);

  // ── 3. Map records to SecurityEvent ───────────────────────────────────────
  const events: SecurityEvent[] = [];
  let missingTimestamps = 0;
  let invalidRecords = 0;

  for (let i = 0; i < rawRecords.length; i++) {
    const record = rawRecords[i];
    if (typeof record !== "object" || record === null) {
      errors.push({ recordIndex: i, message: "Record is not an object.", raw: record });
      invalidRecords++;
      continue;
    }

    const { event, error, missingTimestamp } = mapRecordToEvent(
      record as Record<string, unknown>,
      i
    );

    if (missingTimestamp) {
      missingTimestamps++;
      invalidRecords++;
      if (error) errors.push(error);
      continue;
    }

    if (error) {
      invalidRecords++;
      errors.push(error);
      continue;
    }

    if (event) events.push(event);
  }

  // ── 4. Remove duplicates ───────────────────────────────────────────────────
  const seen = new Set<string>();
  const deduplicated: SecurityEvent[] = [];
  let duplicatesRemoved = 0;

  for (const ev of events) {
    const key = dedupKey(ev);
    if (seen.has(key)) {
      duplicatesRemoved++;
    } else {
      seen.add(key);
      deduplicated.push(ev);
    }
  }

  // ── 5. Detect event types ─────────────────────────────────────────────────
  const detectedEventTypes = [...new Set(deduplicated.map((e) => e.eventType))].sort();

  // ── 6. Warnings ───────────────────────────────────────────────────────────
  if (deduplicated.length === 0 && totalInputRecords > 0) {
    warnings.push("No valid events could be extracted from the input.");
  }
  if (missingTimestamps > 0) {
    warnings.push(
      `${missingTimestamps} record${missingTimestamps > 1 ? "s" : ""} skipped due to missing or unparseable timestamps.`
    );
  }
  if (duplicatesRemoved > 0) {
    warnings.push(
      `${duplicatesRemoved} duplicate event${duplicatesRemoved > 1 ? "s" : ""} removed (identical timestamp + event type + source IP + user).`
    );
  }
  if (deduplicated.length > 1000) {
    warnings.push(
      `Large dataset (${deduplicated.length} events). Reconstruction may take a moment.`
    );
  }

  // Warn if no IP fields detected (limits correlation ability)
  const hasAnyIp = deduplicated.some((e) => e.sourceIp || e.destinationIp);
  if (!hasAnyIp && deduplicated.length > 0) {
    warnings.push("No IP address fields were detected. Network-based correlation will not be available.");
  }

  return {
    datasetId,
    events: deduplicated,
    totalInputRecords,
    validEvents: deduplicated.length,
    invalidRecords,
    duplicatesRemoved,
    missingTimestamps,
    detectedEventTypes,
    detectedFields,
    warnings,
    errors,
  };
}

// ─── Format auto-detection ────────────────────────────────────────────────────

/**
 * Detect the format of an input string.
 * Uses simple heuristics — explicit format param is always preferred.
 */
export function detectFormat(input: string): IngestionFormat {
  const trimmed = input.trim();
  if (!trimmed) return "json";

  // JSON: starts with [ or {
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";

  // NDJSON: first line is a JSON object and there are multiple lines
  const firstLine = trimmed.split("\n")[0].trim();
  if (firstLine.startsWith("{")) return "ndjson";

  // CSV: first line has commas but no JSON braces
  if (firstLine.includes(",") && !firstLine.includes("{")) return "csv";

  return "json";
}

// ─── DatasetOverview builder ──────────────────────────────────────────────────

/**
 * Build a DatasetOverview from an IngestionResult for display in the upload UI.
 * Called after ingestion, before reconstruction.
 */
export function buildDatasetOverview(
  result: IngestionResult,
  fileName: string,
  fileSizeBytes: number,
  format: IngestionFormat
): DatasetOverview {
  const events = result.events;

  // Time range
  let timeRange: { start: string; end: string } | null = null;
  if (events.length > 0) {
    const timestamps = events.map((e) => new Date(e.timestamp).getTime()).sort((a, b) => a - b);
    timeRange = {
      start: new Date(timestamps[0]).toISOString(),
      end: new Date(timestamps[timestamps.length - 1]).toISOString(),
    };
  }

  const uniqueHosts = [...new Set(events.map((e) => e.hostname).filter(Boolean))] as string[];
  const uniqueUsers = [...new Set(events.map((e) => e.user).filter(Boolean))] as string[];
  const uniqueIps = [
    ...new Set([
      ...events.map((e) => e.sourceIp).filter(Boolean),
      ...events.map((e) => e.destinationIp).filter(Boolean),
    ]),
  ] as string[];

  return {
    datasetId: result.datasetId,
    fileName,
    fileSizeBytes,
    format,
    totalEvents: result.totalInputRecords,
    validEvents: result.validEvents,
    invalidRecords: result.invalidRecords,
    timeRange,
    detectedEventTypes: result.detectedEventTypes,
    uniqueHosts,
    uniqueUsers,
    uniqueIps,
    warnings: result.warnings,
    errors: result.errors,
  };
}
