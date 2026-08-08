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
  DetectedSchema,
  SkippedRecord,
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
 * Also searches one level of nesting (e.g. "host.name" → record.host.name).
 */
function pickField(
  record: Record<string, unknown>,
  candidates: string[]
): string | undefined {
  return pickFieldWithKey(record, candidates)?.value;
}

/**
 * Find the first matching field key from a record (case-insensitive).
 * Also tries dot-notation access for nested fields (one level deep).
 * Returns the matched key name and its string value, or undefined.
 */
function pickFieldWithKey(
  record: Record<string, unknown>,
  candidates: string[]
): { key: string; value: string } | undefined {
  for (const key of candidates) {
    // exact match (handles @timestamp with special char)
    if (key in record) {
      const v = record[key];
      if (v !== null && v !== undefined) {
        // If nested object, look for common sub-fields
        if (typeof v === "object" && !Array.isArray(v)) {
          const nested = v as Record<string, unknown>;
          // Try common nested keys: name, value, text, id
          for (const sub of ["name", "value", "text", "id", "address"]) {
            if (sub in nested && nested[sub] !== null && nested[sub] !== undefined && String(nested[sub]).trim() !== "") {
              return { key: `${key}.${sub}`, value: String(nested[sub]).trim() };
            }
          }
        }
        const strV = String(v).trim();
        if (strV !== "" && strV !== "[object Object]") {
          return { key, value: strV };
        }
      }
    }

    // case-insensitive match
    const lower = key.toLowerCase();
    for (const rKey of Object.keys(record)) {
      if (rKey.toLowerCase() === lower) {
        const v = record[rKey];
        if (v !== null && v !== undefined) {
          if (typeof v === "object" && !Array.isArray(v)) {
            const nested = v as Record<string, unknown>;
            for (const sub of ["name", "value", "text", "id", "address"]) {
              if (sub in nested && nested[sub] !== null && nested[sub] !== undefined && String(nested[sub]).trim() !== "") {
                return { key: `${rKey}.${sub}`, value: String(nested[sub]).trim() };
              }
            }
          }
          const strV = String(v).trim();
          if (strV !== "" && strV !== "[object Object]") {
            return { key: rKey, value: strV };
          }
        }
      }
    }
  }
  return undefined;
}

/**
 * Normalize a timestamp string to ISO-8601 UTC.
 * Accepts: ISO-8601, YYYY-MM-DD HH:mm:ss, Unix seconds, Unix milliseconds, common date strings.
 * Returns null if unparseable.
 */
function normalizeTimestamp(raw: string): { iso: string; format: string } | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{10}$/.test(trimmed)) {
    return { iso: new Date(parseInt(trimmed, 10) * 1000).toISOString(), format: "Unix seconds" };
  }
  if (/^\d{13}$/.test(trimmed)) {
    return { iso: new Date(parseInt(trimmed, 10)).toISOString(), format: "Unix milliseconds" };
  }
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    const d = new Date(trimmed.replace(" ", "T") + (trimmed.includes("+") || trimmed.endsWith("Z") ? "" : "Z"));
    if (!isNaN(d.getTime())) return { iso: d.toISOString(), format: "YYYY-MM-DD HH:mm:ss" };
  }
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const fmt = /^\d{4}-\d{2}-\d{2}T/.test(trimmed) ? "ISO 8601" : "Date string";
    return { iso: d.toISOString(), format: fmt };
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, candidates: string[]): number | undefined {
  const raw = pickField(record, candidates);
  if (!raw) return undefined;
  const n = Number(raw);
  return isNaN(n) ? undefined : n;
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

/**
 * Unwrap common wrapper structures:
 * - { "events": [...] }
 * - { "data": [...] }
 * - { "records": [...] }
 * - { "logs": [...] }
 * - { "items": [...] }
 * - { "results": [...] }
 * If the top-level object has exactly one key whose value is an array of objects,
 * use that array. Otherwise treat the object as a single record.
 */
function unwrapRecord(parsed: unknown): Record<string, unknown>[] {
  if (Array.isArray(parsed)) {
    return parsed as Record<string, unknown>[];
  }
  if (typeof parsed !== "object" || parsed === null) return [];

  const obj = parsed as Record<string, unknown>;

  // Check known wrapper keys first
  const WRAPPER_KEYS = ["events", "data", "records", "logs", "items", "results", "hits", "entries"];
  for (const key of WRAPPER_KEYS) {
    if (Array.isArray(obj[key])) {
      return obj[key] as Record<string, unknown>[];
    }
  }

  // Check if there's exactly one key with an array value
  const keys = Object.keys(obj);
  const arrayKeys = keys.filter((k) => Array.isArray(obj[k]));
  if (arrayKeys.length === 1) {
    const arr = obj[arrayKeys[0]] as unknown[];
    // Only unwrap if elements look like objects
    if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
      return arr as Record<string, unknown>[];
    }
  }

  // Single object — treat as one record
  return [obj];
}

function parseJson(
  input: string
): { records: Record<string, unknown>[]; parseError?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { records: [], parseError: "Input is empty." };

  try {
    const parsed = JSON.parse(trimmed);
    return { records: unwrapRecord(parsed) };
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
  schemaHints?: {
    timestampField?: string;
    timestampFormat?: string;
    sourceIpField?: string;
    destIpField?: string;
    userField?: string;
    eventTypeField?: string;
    hostnameField?: string;
  };
}

function mapRecordToEvent(
  record: Record<string, unknown>,
  recordIndex: number
): MapResult {
  // Timestamp — required
  const tsMatch = pickFieldWithKey(record, TIMESTAMP_FIELDS);
  if (!tsMatch) {
    const tried = TIMESTAMP_FIELDS.slice(0, 8).join(", ");
    return {
      missingTimestamp: true,
      error: {
        recordIndex,
        field: "timestamp",
        message: `No timestamp field found. Tried: ${tried}...`,
        raw: record,
      },
    };
  }

  const tsResult = normalizeTimestamp(tsMatch.value);
  if (!tsResult) {
    return {
      missingTimestamp: true,
      error: {
        recordIndex,
        field: tsMatch.key,
        message: `Could not parse timestamp value: "${tsMatch.value}" in field "${tsMatch.key}"`,
        raw: record,
      },
    };
  }

  // Event type — use "unknown_event" if not found
  const etMatch = pickFieldWithKey(record, EVENT_TYPE_FIELDS);
  const rawEventType = etMatch?.value ?? "unknown_event";
  const eventType = rawEventType.toLowerCase().replace(/[\s\-]+/g, "_");

  // IP fields
  const srcIpMatch = pickFieldWithKey(record, SOURCE_IP_FIELDS);
  const dstIpMatch = pickFieldWithKey(record, DEST_IP_FIELDS);
  const userMatch = pickFieldWithKey(record, USER_FIELDS);
  const hostnameMatch = pickFieldWithKey(record, HOSTNAME_FIELDS);

  // Severity
  const rawSeverity = pickField(record, SEVERITY_FIELDS);
  const severity =
    normalizeSeverity(rawSeverity) ??
    inferSeverityFromEventType(eventType);

  const event: SecurityEvent = {
    id: randomUUID(),
    timestamp: tsResult.iso,
    eventType,
    source: pickField(record, ["log_source", "source_type", "log_type", "data_source"]),
    sourceIp: normalizeIp(srcIpMatch?.value),
    destinationIp: normalizeIp(dstIpMatch?.value),
    user: userMatch?.value.toLowerCase(),
    hostname: hostnameMatch?.value.toLowerCase(),
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

  return {
    event,
    missingTimestamp: false,
    schemaHints: {
      timestampField: tsMatch.key,
      timestampFormat: tsResult.format,
      sourceIpField: srcIpMatch?.key,
      destIpField: dstIpMatch?.key,
      userField: userMatch?.key,
      eventTypeField: etMatch?.key,
      hostnameField: hostnameMatch?.key,
    },
  };
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
  const skippedRecords: SkippedRecord[] = [];

  // Schema detection — collect from first successfully mapped record
  const schemaAccumulator: Record<string, number> = {};
  let detectedTimestampField: string | undefined;
  let detectedTimestampFormat: string | undefined;
  let detectedSourceIpField: string | undefined;
  let detectedDestIpField: string | undefined;
  let detectedUserField: string | undefined;
  let detectedEventTypeField: string | undefined;
  let detectedHostnameField: string | undefined;

  for (let i = 0; i < rawRecords.length; i++) {
    const record = rawRecords[i];
    if (typeof record !== "object" || record === null) {
      errors.push({ recordIndex: i, message: "Record is not an object.", raw: record });
      invalidRecords++;
      skippedRecords.push({ recordIndex: i, reason: "Record is not an object" });
      continue;
    }

    const { event, error, missingTimestamp, schemaHints } = mapRecordToEvent(
      record as Record<string, unknown>,
      i
    );

    // Accumulate schema hints from all records (most common field wins)
    if (schemaHints) {
      if (schemaHints.timestampField) { schemaAccumulator[`ts:${schemaHints.timestampField}`] = (schemaAccumulator[`ts:${schemaHints.timestampField}`] ?? 0) + 1; }
      if (schemaHints.sourceIpField) { schemaAccumulator[`sip:${schemaHints.sourceIpField}`] = (schemaAccumulator[`sip:${schemaHints.sourceIpField}`] ?? 0) + 1; }
      if (schemaHints.destIpField) { schemaAccumulator[`dip:${schemaHints.destIpField}`] = (schemaAccumulator[`dip:${schemaHints.destIpField}`] ?? 0) + 1; }
      if (schemaHints.userField) { schemaAccumulator[`user:${schemaHints.userField}`] = (schemaAccumulator[`user:${schemaHints.userField}`] ?? 0) + 1; }
      if (schemaHints.eventTypeField) { schemaAccumulator[`et:${schemaHints.eventTypeField}`] = (schemaAccumulator[`et:${schemaHints.eventTypeField}`] ?? 0) + 1; }
      if (schemaHints.hostnameField) { schemaAccumulator[`host:${schemaHints.hostnameField}`] = (schemaAccumulator[`host:${schemaHints.hostnameField}`] ?? 0) + 1; }
      // Track first format seen
      if (!detectedTimestampFormat && schemaHints.timestampFormat) detectedTimestampFormat = schemaHints.timestampFormat;
    }

    if (missingTimestamp) {
      missingTimestamps++;
      invalidRecords++;
      if (error) {
        errors.push(error);
        skippedRecords.push({ recordIndex: i, reason: error.message });
      }
      continue;
    }

    if (error) {
      invalidRecords++;
      errors.push(error);
      skippedRecords.push({ recordIndex: i, reason: error.message });
      continue;
    }

    if (event) events.push(event);
  }

  // Resolve most-common schema fields
  function mostCommon(prefix: string): string | undefined {
    let best: string | undefined;
    let bestCount = 0;
    for (const [key, count] of Object.entries(schemaAccumulator)) {
      if (key.startsWith(prefix + ":") && count > bestCount) {
        best = key.slice(prefix.length + 1);
        bestCount = count;
      }
    }
    return best;
  }

  detectedTimestampField = mostCommon("ts");
  detectedSourceIpField = mostCommon("sip");
  detectedDestIpField = mostCommon("dip");
  detectedUserField = mostCommon("user");
  detectedEventTypeField = mostCommon("et");
  detectedHostnameField = mostCommon("host");

  const detectedSchema: DetectedSchema = {
    timestampField: detectedTimestampField,
    timestampFormat: detectedTimestampFormat,
    sourceIpField: detectedSourceIpField,
    destinationIpField: detectedDestIpField,
    userField: detectedUserField,
    eventTypeField: detectedEventTypeField,
    hostnameField: detectedHostnameField,
  };

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
    const fieldNote = detectedTimestampField ? ` (detected field: "${detectedTimestampField}")` : "";
    warnings.push(
      `${missingTimestamps} record${missingTimestamps > 1 ? "s" : ""} skipped due to missing or unparseable timestamps${fieldNote}.`
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
    detectedSchema,
    skippedRecords,
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
    detectedSchema: result.detectedSchema,
    skippedRecords: result.skippedRecords,
  };
}
