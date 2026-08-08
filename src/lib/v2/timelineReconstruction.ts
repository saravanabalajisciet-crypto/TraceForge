/**
 * timelineReconstruction.ts
 *
 * Phase 5 — Timeline Reconstruction Engine
 *
 * This is NOT a simple chronological sort.
 * The engine:
 *   1. Sorts events chronologically
 *   2. Groups events by shared entity (IP, user, hostname, process, hash, domain)
 *   3. Detects suspicious sequences (brute force, C2, lateral movement, etc.)
 *   4. Builds EventRelationship objects with confidence + explanation
 *   5. Returns a structured reconstruction ready for AttackStoryEngine
 *
 * Every inferred relationship has:
 *   - A relationshipType from the defined taxonomy
 *   - A confidence score (0.0 – 1.0)
 *   - A non-empty explanation sentence
 *
 * Never mutates input. Never throws.
 */

import {
  SecurityEvent,
  EventRelationship,
  EventRelationshipType,
  EventGroup,
} from "@/types/v2";
import { isPrivateIp } from "@/lib/v2/eventNormalization";

// ─── Result Type ──────────────────────────────────────────────────────────────

export interface TimelineReconstructionResult {
  /** Events sorted chronologically */
  sorted: SecurityEvent[];
  /** All detected relationships between events */
  relationships: EventRelationship[];
  /** Entity clusters */
  groups: EventGroup[];
  /** Detected suspicious sequence patterns */
  detectedPatterns: DetectedPattern[];
  /** Summary statistics */
  stats: {
    totalEvents: number;
    totalRelationships: number;
    totalGroups: number;
    suspiciousEventIds: Set<string>;
  };
}

export interface DetectedPattern {
  patternType: string;
  eventIds: string[];
  confidence: number;
  description: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Time window (ms) within which two events from the same entity are "related" */
const ENTITY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Minimum failed logins before flagging a brute force sequence */
const BRUTE_FORCE_THRESHOLD = 3;

/** Minimum events in a group to form an EventGroup */
const MIN_GROUP_SIZE = 2;

// ─── Step 1: Chronological Sort ───────────────────────────────────────────────

function sortChronologically(events: SecurityEvent[]): SecurityEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// ─── Step 2: Entity Grouping ──────────────────────────────────────────────────

type EntityType = EventGroup["entityType"];

interface EntityKey {
  type: EntityType;
  value: string;
}

/**
 * Extract entity keys from an event that can be used for grouping.
 */
function getEntityKeys(event: SecurityEvent): EntityKey[] {
  const keys: EntityKey[] = [];
  if (event.sourceIp) keys.push({ type: "ip", value: event.sourceIp });
  if (event.destinationIp) keys.push({ type: "ip", value: event.destinationIp });
  if (event.user) keys.push({ type: "user", value: event.user });
  if (event.hostname) keys.push({ type: "hostname", value: event.hostname });
  if (event.process) keys.push({ type: "process", value: event.process });
  if (event.hash) keys.push({ type: "hash", value: event.hash });
  if (event.domain) keys.push({ type: "domain", value: event.domain });
  return keys;
}

function buildEntityGroups(events: SecurityEvent[]): EventGroup[] {
  // Map: "type:value" → event IDs
  const entityMap = new Map<string, string[]>();

  for (const ev of events) {
    for (const { type, value } of getEntityKeys(ev)) {
      const key = `${type}:${value}`;
      if (!entityMap.has(key)) entityMap.set(key, []);
      entityMap.get(key)!.push(ev.id);
    }
  }

  const evById = new Map(events.map((e) => [e.id, e]));
  const groups: EventGroup[] = [];
  let groupIdx = 0;

  for (const [key, ids] of entityMap) {
    if (ids.length < MIN_GROUP_SIZE) continue;
    const [type, ...rest] = key.split(":");
    const value = rest.join(":");
    const groupEvents = ids.map((id) => evById.get(id)!).filter(Boolean);
    const timestamps = groupEvents
      .map((e) => new Date(e.timestamp).getTime())
      .sort((a, b) => a - b);

    groups.push({
      id: `grp_${++groupIdx}`,
      entityType: type as EntityType,
      entityValue: value,
      eventIds: ids,
      firstSeen: new Date(timestamps[0]).toISOString(),
      lastSeen: new Date(timestamps[timestamps.length - 1]).toISOString(),
    });
  }

  return groups;
}

// ─── Step 3: Relationship Detection ──────────────────────────────────────────

/**
 * Build a relationship object with all required fields.
 */
function makeRel(
  from: SecurityEvent,
  to: SecurityEvent,
  type: EventRelationshipType,
  confidence: number,
  explanation: string
): EventRelationship {
  return { fromEventId: from.id, toEventId: to.id, relationshipType: type, confidence, explanation };
}

/**
 * Shared-entity relationships: two events that share an IP, user, hostname, etc.
 * Only pairs within the ENTITY_WINDOW_MS time window are linked.
 */
function buildSharedEntityRelationships(
  events: SecurityEvent[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const n = events.length;

  for (let i = 0; i < n - 1; i++) {
    const a = events[i];
    const tA = new Date(a.timestamp).getTime();

    for (let j = i + 1; j < n; j++) {
      const b = events[j];
      const tB = new Date(b.timestamp).getTime();
      if (tB - tA > ENTITY_WINDOW_MS) break; // sorted, so no later event qualifies

      // Shared source IP
      if (a.sourceIp && a.sourceIp === b.sourceIp) {
        const isExternal = !isPrivateIp(a.sourceIp);
        rels.push(makeRel(a, b, "shared_source_ip",
          isExternal ? 0.85 : 0.60,
          `Both events originated from the same source IP (${a.sourceIp})${isExternal ? " — an external address" : ""} within a short time window.`
        ));
      }

      // Shared user
      if (a.user && a.user === b.user) {
        rels.push(makeRel(a, b, "shared_user", 0.70,
          `Both events are associated with the same account (${a.user}), suggesting a continuous session or actor.`
        ));
      }

      // Shared hostname
      if (a.hostname && a.hostname === b.hostname && a.hostname !== b.sourceIp) {
        rels.push(makeRel(a, b, "shared_hostname", 0.65,
          `Both events occurred on the same host (${a.hostname}), indicating activity on a common endpoint.`
        ));
      }

      // Shared process
      if (a.process && a.process === b.process) {
        rels.push(makeRel(a, b, "shared_process", 0.75,
          `Both events involve the same process (${a.process}), suggesting a common execution context.`
        ));
      }

      // Shared hash
      if (a.hash && a.hash === b.hash) {
        rels.push(makeRel(a, b, "shared_hash", 0.90,
          `Both events reference the same file hash (${a.hash.slice(0, 16)}…), confirming the same binary artifact.`
        ));
      }

      // Shared domain
      if (a.domain && a.domain === b.domain) {
        rels.push(makeRel(a, b, "shared_domain", 0.80,
          `Both events involve the same domain (${a.domain}), suggesting communication with a common external endpoint.`
        ));
      }
    }
  }

  return rels;
}

// ─── Step 4: Suspicious Sequence Detection ───────────────────────────────────

/**
 * Authentication chain: consecutive failed logins followed by a success
 * from the same source IP or user.
 */
function detectAuthChains(
  events: SecurityEvent[],
  patterns: DetectedPattern[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const failTypes = new Set(["failed_login", "authentication_failure", "login_failure"]);
  const successTypes = new Set(["successful_login", "authentication_success", "login_success"]);

  // Group failed logins by source IP
  const failsByIp = new Map<string, SecurityEvent[]>();
  const failsByUser = new Map<string, SecurityEvent[]>();

  for (const ev of events) {
    if (failTypes.has(ev.eventType)) {
      if (ev.sourceIp) {
        if (!failsByIp.has(ev.sourceIp)) failsByIp.set(ev.sourceIp, []);
        failsByIp.get(ev.sourceIp)!.push(ev);
      }
      if (ev.user) {
        if (!failsByUser.has(ev.user)) failsByUser.set(ev.user, []);
        failsByUser.get(ev.user)!.push(ev);
      }
    }
  }

  // For each success event, find preceding failures from same IP or user
  for (const successEv of events) {
    if (!successTypes.has(successEv.eventType)) continue;
    const tSuccess = new Date(successEv.timestamp).getTime();

    // Check by IP
    const ipFails = successEv.sourceIp ? (failsByIp.get(successEv.sourceIp) ?? []) : [];
    const precedingIpFails = ipFails.filter(
      (f) => new Date(f.timestamp).getTime() < tSuccess &&
             tSuccess - new Date(f.timestamp).getTime() < ENTITY_WINDOW_MS
    );

    if (precedingIpFails.length >= BRUTE_FORCE_THRESHOLD) {
      // Link last failure → success
      const lastFail = precedingIpFails[precedingIpFails.length - 1];
      rels.push(makeRel(lastFail, successEv, "authentication_chain", 0.92,
        `${precedingIpFails.length} failed login attempt${precedingIpFails.length > 1 ? "s" : ""} from ${successEv.sourceIp} preceded this successful login — consistent with brute force.`
      ));
      patterns.push({
        patternType: "brute_force",
        eventIds: [...precedingIpFails.map((f) => f.id), successEv.id],
        confidence: 0.92,
        description: `Brute force detected: ${precedingIpFails.length} failures from ${successEv.sourceIp} followed by successful login${successEv.user ? ` as ${successEv.user}` : ""}.`,
      });
    }

    // Check by user (covers cases where IP changes between attempts)
    const userFails = successEv.user ? (failsByUser.get(successEv.user) ?? []) : [];
    const precedingUserFails = userFails.filter(
      (f) => new Date(f.timestamp).getTime() < tSuccess &&
             tSuccess - new Date(f.timestamp).getTime() < ENTITY_WINDOW_MS
    );

    if (precedingUserFails.length >= BRUTE_FORCE_THRESHOLD && precedingIpFails.length < BRUTE_FORCE_THRESHOLD) {
      const lastFail = precedingUserFails[precedingUserFails.length - 1];
      rels.push(makeRel(lastFail, successEv, "authentication_chain", 0.80,
        `${precedingUserFails.length} failed login attempt${precedingUserFails.length > 1 ? "s" : ""} for user ${successEv.user} preceded this successful login.`
      ));
    }
  }

  return rels;
}

/**
 * Process chain: parent process spawning suspicious children.
 * e.g. WINWORD.EXE → powershell.exe, or cmd.exe → wget
 */
function detectProcessChains(
  events: SecurityEvent[],
  patterns: DetectedPattern[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const suspiciousSpawners = new Set([
    "winword.exe", "excel.exe", "powerpnt.exe", "outlook.exe",
    "acrobat.exe", "acrord32.exe", "mshta.exe", "wscript.exe", "cscript.exe",
  ]);
  const suspiciousChildren = new Set([
    "powershell.exe", "cmd.exe", "wscript.exe", "cscript.exe",
    "mshta.exe", "regsvr32.exe", "rundll32.exe", "certutil.exe",
    "bitsadmin.exe", "wget", "curl", "nc", "bash", "sh",
  ]);

  const processEvents = events.filter((e) => e.eventType === "process_created" && e.process);

  for (let i = 0; i < processEvents.length - 1; i++) {
    const parent = processEvents[i];
    for (let j = i + 1; j < processEvents.length; j++) {
      const child = processEvents[j];
      const gap = new Date(child.timestamp).getTime() - new Date(parent.timestamp).getTime();
      if (gap > 5 * 60 * 1000) break; // 5 min window for process chains

      // Same host, suspicious spawner → suspicious child
      if (
        parent.hostname === child.hostname &&
        parent.user === child.user &&
        suspiciousSpawners.has(parent.process!.toLowerCase()) &&
        suspiciousChildren.has(child.process!.toLowerCase())
      ) {
        rels.push(makeRel(parent, child, "process_chain", 0.88,
          `${parent.process} spawned ${child.process} on ${parent.hostname || "the same host"} — Office/script applications launching shells is a common malware execution technique.`
        ));
        patterns.push({
          patternType: "suspicious_process_chain",
          eventIds: [parent.id, child.id],
          confidence: 0.88,
          description: `Suspicious process chain: ${parent.process} → ${child.process} on ${parent.hostname}.`,
        });
      }
    }
  }

  return rels;
}

/**
 * Network flow: connection event followed by large data transfer to the same IP.
 * Flags potential C2 beaconing and exfiltration.
 */
function detectNetworkFlows(
  events: SecurityEvent[],
  patterns: DetectedPattern[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const connTypes = new Set(["network_connection", "connection", "tcp_connection"]);
  const exfilTypes = new Set(["data_exfiltration", "network_connection"]);

  const connections = events.filter((e) => connTypes.has(e.eventType) && e.destinationIp);

  for (const conn of connections) {
    const tConn = new Date(conn.timestamp).getTime();
    // Look for a subsequent event to the same external IP
    const followUp = events.find((e) => {
      if (e.id === conn.id) return false;
      const tE = new Date(e.timestamp).getTime();
      if (tE <= tConn || tE - tConn > ENTITY_WINDOW_MS) return false;
      return (
        e.destinationIp === conn.destinationIp &&
        (exfilTypes.has(e.eventType) || e.eventType === conn.eventType)
      );
    });

    if (followUp) {
      const isExternal = conn.destinationIp ? !isPrivateIp(conn.destinationIp) : false;
      rels.push(makeRel(conn, followUp, "network_flow",
        isExternal ? 0.82 : 0.55,
        `A connection to ${conn.destinationIp} was followed by additional network activity to the same destination${isExternal ? " (external IP)" : ""}, suggesting a sustained session or data transfer.`
      ));
      if (isExternal) {
        patterns.push({
          patternType: "c2_or_exfiltration",
          eventIds: [conn.id, followUp.id],
          confidence: 0.82,
          description: `Sustained outbound connection to external IP ${conn.destinationIp} — possible C2 channel or data exfiltration.`,
        });
      }
    }
  }

  return rels;
}

/**
 * Lateral movement: authentication to multiple internal hosts from the same source
 * within a short window.
 */
function detectLateralMovement(
  events: SecurityEvent[],
  patterns: DetectedPattern[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const authTypes = new Set(["successful_login", "authentication_success", "session_opened"]);

  // Group successful logins by source IP
  const loginsBySource = new Map<string, SecurityEvent[]>();
  for (const ev of events) {
    if (!authTypes.has(ev.eventType)) continue;
    const key = ev.sourceIp ?? ev.user ?? "";
    if (!key) continue;
    if (!loginsBySource.has(key)) loginsBySource.set(key, []);
    loginsBySource.get(key)!.push(ev);
  }

  for (const [source, logins] of loginsBySource) {
    if (logins.length < 2) continue;
    // Check for logins to different internal hosts
    const internalTargets = logins.filter(
      (l) => l.hostname && l.destinationIp && isPrivateIp(l.destinationIp)
    );
    const uniqueHosts = new Set(internalTargets.map((l) => l.hostname ?? l.destinationIp));
    if (uniqueHosts.size >= 2) {
      // Link each consecutive pair
      for (let i = 0; i < internalTargets.length - 1; i++) {
        rels.push(makeRel(
          internalTargets[i], internalTargets[i + 1],
          "temporal_sequence", 0.85,
          `Authentication from the same source (${source}) to multiple internal hosts (${[...uniqueHosts].slice(0, 3).join(", ")}) suggests lateral movement.`
        ));
      }
      patterns.push({
        patternType: "lateral_movement",
        eventIds: internalTargets.map((l) => l.id),
        confidence: 0.85,
        description: `Lateral movement: ${source} authenticated to ${uniqueHosts.size} distinct internal hosts.`,
      });
    }
  }

  return rels;
}

/**
 * File operation chains: file created then executed on same host.
 */
function detectFileOperationChains(
  events: SecurityEvent[],
  patterns: DetectedPattern[]
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const createTypes = new Set(["file_created", "file_downloaded", "file_copy"]);
  const execTypes = new Set(["process_created"]);
  const FILE_EXEC_WINDOW = 10 * 60 * 1000; // 10 minutes

  const creates = events.filter((e) => createTypes.has(e.eventType) && e.filePath);

  for (const create of creates) {
    // Look for a process_created event on same host where the process matches the file
    const fileName = create.filePath!.split("\\").pop()?.split("/").pop()?.toLowerCase();
    if (!fileName) continue;

    const execution = events.find((e) => {
      if (!execTypes.has(e.eventType)) return false;
      if (e.hostname !== create.hostname && create.hostname) return false;
      const tGap = new Date(e.timestamp).getTime() - new Date(create.timestamp).getTime();
      if (tGap <= 0 || tGap > FILE_EXEC_WINDOW) return false;
      return (
        e.process?.toLowerCase() === fileName ||
        e.command?.toLowerCase().includes(fileName) ||
        e.filePath?.toLowerCase().includes(fileName)
      );
    });

    if (execution) {
      rels.push(makeRel(create, execution, "file_operation_chain", 0.87,
        `File "${fileName}" was created and then executed on ${create.hostname || "the same host"} within ${Math.round((new Date(execution.timestamp).getTime() - new Date(create.timestamp).getTime()) / 1000)}s — consistent with dropper behaviour.`
      ));
      patterns.push({
        patternType: "dropper_execution",
        eventIds: [create.id, execution.id],
        confidence: 0.87,
        description: `Dropper pattern: ${fileName} created then executed on ${create.hostname}.`,
      });
    }
  }

  return rels;
}

/**
 * Temporal sequence: consecutive events from the same user/host with no
 * shared entity already linking them — catch any remaining adjacent activity.
 */
function detectTemporalSequences(
  events: SecurityEvent[],
  existingRelIds: Set<string>
): EventRelationship[] {
  const rels: EventRelationship[] = [];
  const TEMPORAL_WINDOW = 5 * 60 * 1000; // 5 minutes

  for (let i = 0; i < events.length - 1; i++) {
    const a = events[i];
    const b = events[i + 1];
    const relId = `${a.id}-${b.id}`;
    if (existingRelIds.has(relId)) continue;

    const gap = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (gap > TEMPORAL_WINDOW) continue;

    // Only link if they share at least one entity
    const sharedUser = a.user && a.user === b.user;
    const sharedHost = a.hostname && a.hostname === b.hostname;
    const sharedIp = a.sourceIp && a.sourceIp === b.sourceIp;

    if (sharedUser || sharedHost || sharedIp) {
      const entity = sharedUser ? `user ${a.user}` : sharedHost ? `host ${a.hostname}` : `IP ${a.sourceIp}`;
      rels.push(makeRel(a, b, "temporal_sequence", 0.50,
        `These events occurred within ${Math.round(gap / 1000)}s on the same ${entity}, suggesting they are part of a continuous activity sequence.`
      ));
    }
  }

  return rels;
}

// ─── Step 5: Deduplication ────────────────────────────────────────────────────

/**
 * Remove duplicate relationships (same from+to+type).
 * Keep the one with the highest confidence.
 */
function deduplicateRelationships(rels: EventRelationship[]): EventRelationship[] {
  const seen = new Map<string, EventRelationship>();
  for (const rel of rels) {
    const key = `${rel.fromEventId}|${rel.toEventId}|${rel.relationshipType}`;
    const existing = seen.get(key);
    if (!existing || rel.confidence > existing.confidence) {
      seen.set(key, rel);
    }
  }
  return [...seen.values()];
}

// ─── Suspicious Event Tagging ─────────────────────────────────────────────────

const CRITICAL_EVENT_TYPES = new Set([
  "credential_access", "data_exfiltration", "antivirus_disabled",
  "log_cleared", "privilege_escalation", "file_encrypted",
  "lateral_movement", "failed_login", "registry_modified",
  "scheduled_task_created", "firewall_modified",
]);

function tagSuspiciousEvents(events: SecurityEvent[], patterns: DetectedPattern[]): Set<string> {
  const suspicious = new Set<string>();

  // Tag from patterns
  for (const p of patterns) {
    for (const id of p.eventIds) suspicious.add(id);
  }

  // Tag by event type
  for (const ev of events) {
    if (ev.severity === "critical" || ev.severity === "high") suspicious.add(ev.id);
    if (CRITICAL_EVENT_TYPES.has(ev.eventType)) suspicious.add(ev.id);
    // Flag connections to external IPs on unusual ports
    if (ev.destinationIp && !isPrivateIp(ev.destinationIp)) {
      if (ev.port && [4444, 4445, 1337, 31337, 8080, 9090].includes(ev.port)) {
        suspicious.add(ev.id);
      }
    }
  }

  return suspicious;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Reconstruct an attack timeline from normalized SecurityEvents.
 *
 * @param events  Normalized events from EventNormalizationEngine
 * @returns       TimelineReconstructionResult — sorted events, relationships, groups, patterns
 */
export function reconstructTimeline(events: SecurityEvent[]): TimelineReconstructionResult {
  if (events.length === 0) {
    return {
      sorted: [],
      relationships: [],
      groups: [],
      detectedPatterns: [],
      stats: {
        totalEvents: 0,
        totalRelationships: 0,
        totalGroups: 0,
        suspiciousEventIds: new Set(),
      },
    };
  }

  // 1. Sort chronologically
  const sorted = sortChronologically(events);

  // 2. Build entity groups
  const groups = buildEntityGroups(sorted);

  // 3. Collect all relationships
  const patterns: DetectedPattern[] = [];
  const allRels: EventRelationship[] = [
    ...buildSharedEntityRelationships(sorted),
    ...detectAuthChains(sorted, patterns),
    ...detectProcessChains(sorted, patterns),
    ...detectNetworkFlows(sorted, patterns),
    ...detectLateralMovement(sorted, patterns),
    ...detectFileOperationChains(sorted, patterns),
  ];

  // 4. Deduplicate before adding temporal sequences
  const deduped = deduplicateRelationships(allRels);

  // 5. Add temporal sequences only for pairs not already linked
  const existingPairs = new Set(deduped.map((r) => `${r.fromEventId}-${r.toEventId}`));
  const temporal = detectTemporalSequences(sorted, existingPairs);
  const finalRels = deduplicateRelationships([...deduped, ...temporal]);

  // 6. Tag suspicious events
  const suspiciousEventIds = tagSuspiciousEvents(sorted, patterns);

  return {
    sorted,
    relationships: finalRels,
    groups,
    detectedPatterns: patterns,
    stats: {
      totalEvents: sorted.length,
      totalRelationships: finalRels.length,
      totalGroups: groups.length,
      suspiciousEventIds,
    },
  };
}

// ─── Utility exports for downstream engines ───────────────────────────────────

/**
 * Get the event IDs that are directly connected to a given event (in either direction).
 */
export function getConnectedEventIds(
  eventId: string,
  relationships: EventRelationship[]
): string[] {
  const connected = new Set<string>();
  for (const rel of relationships) {
    if (rel.fromEventId === eventId) connected.add(rel.toEventId);
    if (rel.toEventId === eventId) connected.add(rel.fromEventId);
  }
  return [...connected];
}

/**
 * Get all relationships involving a specific event.
 */
export function getEventRelationships(
  eventId: string,
  relationships: EventRelationship[]
): EventRelationship[] {
  return relationships.filter(
    (r) => r.fromEventId === eventId || r.toEventId === eventId
  );
}

/**
 * Find the most connected event (hub) — useful for identifying pivot points in an attack.
 */
export function findHubEvent(
  events: SecurityEvent[],
  relationships: EventRelationship[]
): SecurityEvent | null {
  if (events.length === 0) return null;
  const counts = new Map<string, number>();
  for (const rel of relationships) {
    counts.set(rel.fromEventId, (counts.get(rel.fromEventId) ?? 0) + 1);
    counts.set(rel.toEventId, (counts.get(rel.toEventId) ?? 0) + 1);
  }
  let maxId = "";
  let maxCount = 0;
  for (const [id, count] of counts) {
    if (count > maxCount) { maxCount = count; maxId = id; }
  }
  return events.find((e) => e.id === maxId) ?? null;
}
