/**
 * iocExtraction.ts
 *
 * Phase 7b — IOC Extraction Engine
 *
 * Scans every field of every normalized SecurityEvent.
 * Groups by value — multiple events referencing the same IOC are counted.
 * Never fabricates. Only extracts what is actually present in the data.
 */

import { SecurityEvent, ExtractedIoc, IocKind, AttackStory } from "@/types/v2";
import { isMd5, isSha1, isSha256, isDomain, isEmail, isUrl, isFilePath, isIpv4, isIpv6 } from "@/types/v2";

// ─── Known-safe exclusions ────────────────────────────────────────────────────

const SAFE_DOMAINS = new Set([
  "localhost", "local", "internal", "corp.local", "ad.local",
  "microsoft.com", "windows.com", "windowsupdate.com",
  "google.com", "googleapis.com", "gstatic.com",
]);

const SAFE_IPS = new Set([
  "0.0.0.0", "255.255.255.255", "127.0.0.1", "::1",
]);

const SYSTEM_PROCESSES = new Set([
  "system", "idle", "registry", "smss.exe", "csrss.exe",
  "wininit.exe", "services.exe", "lsass.exe", "svchost.exe",
  "dwm.exe", "explorer.exe", "taskhost.exe",
]);

// ─── IOC builder ──────────────────────────────────────────────────────────────

function makeIocId(kind: IocKind, value: string): string {
  return `${kind}:${value.toLowerCase()}`;
}

function addIoc(
  map: Map<string, ExtractedIoc>,
  kind: IocKind,
  value: string,
  eventId: string,
  attackStage?: string
) {
  const id = makeIocId(kind, value);
  if (!map.has(id)) {
    map.set(id, { id, kind, value, sourceEventIds: [], count: 0, attackStage });
  }
  const ioc = map.get(id)!;
  if (!ioc.sourceEventIds.includes(eventId)) {
    ioc.sourceEventIds.push(eventId);
    ioc.count++;
  }
  if (!ioc.attackStage && attackStage) ioc.attackStage = attackStage;
}

// ─── Field scanners ───────────────────────────────────────────────────────────

function extractFromEvent(
  event: SecurityEvent,
  map: Map<string, ExtractedIoc>,
  stageMap: Map<string, string>
) {
  const stage = stageMap.get(event.id);

  // IPs
  if (event.sourceIp) {
    const ip = event.sourceIp;
    if (!SAFE_IPS.has(ip)) {
      addIoc(map, isIpv6(ip) ? "ipv6" : "ipv4", ip, event.id, stage);
    }
  }
  if (event.destinationIp) {
    const ip = event.destinationIp;
    if (!SAFE_IPS.has(ip)) {
      addIoc(map, isIpv6(ip) ? "ipv6" : "ipv4", ip, event.id, stage);
    }
  }

  // Domain
  if (event.domain && !SAFE_DOMAINS.has(event.domain.toLowerCase())) {
    if (isEmail(event.domain)) {
      addIoc(map, "email", event.domain, event.id, stage);
    } else if (isDomain(event.domain)) {
      addIoc(map, "domain", event.domain, event.id, stage);
    }
  }

  // Hash
  if (event.hash) {
    const h = event.hash.toUpperCase();
    if (isSha256(h)) addIoc(map, "hash_sha256", h, event.id, stage);
    else if (isSha1(h)) addIoc(map, "hash_sha1", h, event.id, stage);
    else if (isMd5(h)) addIoc(map, "hash_md5", h, event.id, stage);
  }

  // File path
  if (event.filePath && isFilePath(event.filePath)) {
    addIoc(map, "filepath", event.filePath, event.id, stage);
  }

  // Process (only flag non-system ones)
  if (event.process && !SYSTEM_PROCESSES.has(event.process.toLowerCase())) {
    addIoc(map, "process", event.process, event.id, stage);
  }

  // Username
  if (event.user) {
    addIoc(map, "username", event.user, event.id, stage);
  }

  // Hostname
  if (event.hostname) {
    addIoc(map, "hostname", event.hostname, event.id, stage);
  }

  // Scan raw fields for URLs, emails, and additional domains/IPs
  scanRawFields(event.raw, event.id, stage, map);
}

function scanRawFields(
  raw: Record<string, unknown>,
  eventId: string,
  stage: string | undefined,
  map: Map<string, ExtractedIoc>
) {
  for (const value of Object.values(raw)) {
    if (typeof value !== "string") continue;
    const v = value.trim();
    if (!v || v.length < 4 || v.length > 2000) continue;

    // URL
    if (isUrl(v)) {
      addIoc(map, "url", v, eventId, stage);
      continue;
    }

    // Email
    if (isEmail(v) && !v.endsWith(".corp") && !v.endsWith(".local")) {
      addIoc(map, "email", v, eventId, stage);
      continue;
    }

    // Hash in raw field
    const upper = v.toUpperCase();
    if (isSha256(upper)) { addIoc(map, "hash_sha256", upper, eventId, stage); continue; }
    if (isSha1(upper)) { addIoc(map, "hash_sha1", upper, eventId, stage); continue; }
    if (isMd5(upper)) { addIoc(map, "hash_md5", upper, eventId, stage); continue; }

    // IP addresses embedded in raw strings (e.g. log messages)
    const ipMatches = v.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g) ?? [];
    for (const ip of ipMatches) {
      if (isIpv4(ip) && !SAFE_IPS.has(ip)) {
        addIoc(map, "ipv4", ip, eventId, stage);
      }
    }
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function extractIocs(
  events: SecurityEvent[],
  attackStory: AttackStory
): ExtractedIoc[] {
  const map = new Map<string, ExtractedIoc>();

  // Build event → attack stage mapping for context
  const stageMap = new Map<string, string>();
  for (const stage of attackStory.stages) {
    for (const id of stage.supportingEventIds) {
      stageMap.set(id, stage.name);
    }
  }

  for (const event of events) {
    extractFromEvent(event, map, stageMap);
  }

  // Sort: highest count first, then by kind priority
  const KIND_PRIORITY: IocKind[] = [
    "ipv4", "ipv6", "domain", "url", "email",
    "hash_sha256", "hash_sha1", "hash_md5",
    "filepath", "process", "username", "hostname",
  ];

  return [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return KIND_PRIORITY.indexOf(a.kind) - KIND_PRIORITY.indexOf(b.kind);
  });
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Group extracted IOCs by kind for display */
export function groupIocsByKind(iocs: ExtractedIoc[]): Record<IocKind, ExtractedIoc[]> {
  const groups = {} as Record<IocKind, ExtractedIoc[]>;
  for (const ioc of iocs) {
    if (!groups[ioc.kind]) groups[ioc.kind] = [];
    groups[ioc.kind].push(ioc);
  }
  return groups;
}

/** Get IOC display label */
export function getIocKindLabel(kind: IocKind): string {
  const labels: Record<IocKind, string> = {
    ipv4: "IPv4 Address", ipv6: "IPv6 Address",
    domain: "Domain", url: "URL", email: "Email Address",
    hash_md5: "MD5 Hash", hash_sha1: "SHA1 Hash", hash_sha256: "SHA256 Hash",
    filepath: "File Path", process: "Process", username: "Username", hostname: "Hostname",
  };
  return labels[kind] ?? kind;
}

/** Get IOC icon key (for UI) */
export function getIocIcon(kind: IocKind): string {
  const icons: Record<IocKind, string> = {
    ipv4: "ip", ipv6: "ip", domain: "domain", url: "url",
    email: "email", hash_md5: "hash", hash_sha1: "hash", hash_sha256: "hash",
    filepath: "file", process: "process", username: "user", hostname: "host",
  };
  return icons[kind] ?? "tag";
}
