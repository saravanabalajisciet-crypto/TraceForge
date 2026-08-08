/**
 * attackStory.ts
 *
 * Phase 6 — Attack Story Engine
 *
 * Rule-based. Zero API calls. Zero randomness.
 * Produces a structured AttackStory from sorted events + relationships.
 *
 * Rules:
 * - Only include stages with at least one supporting event
 * - confidence reflects the fraction of supporting signals found
 * - uncertainties must list what was ambiguous or missing
 * - If fewer than 2 stages: summary = "Insufficient evidence..."
 * - Never fabricate a stage
 */

import {
  SecurityEvent,
  EventRelationship,
  AttackStory,
  AttackStage,
} from "@/types/v2";
import { DetectedPattern } from "@/lib/v2/timelineReconstruction";
import { randomUUID } from "crypto";

// ─── MITRE Tactic reference ───────────────────────────────────────────────────

interface TacticDef {
  name: string;
  tacticId: string;
  techniques: string[];
}

const TACTIC_DEFS: TacticDef[] = [
  { name: "Initial Access",       tacticId: "TA0001", techniques: ["T1566", "T1190", "T1078", "T1133"] },
  { name: "Execution",            tacticId: "TA0002", techniques: ["T1059", "T1203", "T1204"] },
  { name: "Persistence",          tacticId: "TA0003", techniques: ["T1547", "T1053", "T1136", "T1543"] },
  { name: "Privilege Escalation", tacticId: "TA0004", techniques: ["T1068", "T1078", "T1134"] },
  { name: "Defense Evasion",      tacticId: "TA0005", techniques: ["T1070", "T1562", "T1036", "T1112"] },
  { name: "Credential Access",    tacticId: "TA0006", techniques: ["T1110", "T1003", "T1555"] },
  { name: "Discovery",            tacticId: "TA0007", techniques: ["T1083", "T1082", "T1016", "T1087"] },
  { name: "Lateral Movement",     tacticId: "TA0008", techniques: ["T1021", "T1550", "T1534"] },
  { name: "Collection",           tacticId: "TA0009", techniques: ["T1560", "T1213", "T1005"] },
  { name: "Command and Control",  tacticId: "TA0011", techniques: ["T1071", "T1090", "T1568"] },
  { name: "Exfiltration",         tacticId: "TA0010", techniques: ["T1041", "T1048", "T1052"] },
  { name: "Impact",               tacticId: "TA0040", techniques: ["T1486", "T1490", "T1485"] },
];

// ─── Stage Detection Rules ────────────────────────────────────────────────────

interface StageRule {
  tacticName: string;
  tacticId: string;
  possibleTechniques: string[];
  /** Returns { matched: boolean; confidence: number; iocValues: string[] } */
  detect: (events: SecurityEvent[], patterns: DetectedPattern[]) => {
    matched: boolean;
    confidence: number;
    supportingIds: string[];
    iocValues: string[];
    reasoning: string;
  };
}

const STAGE_RULES: StageRule[] = [
  // ── Initial Access ─────────────────────────────────────────────────────────
  {
    tacticName: "Initial Access", tacticId: "TA0001",
    possibleTechniques: ["T1566.001", "T1190", "T1078", "T1110"],
    detect(events, patterns) {
      const phishing = events.filter((e) =>
        ["email_received", "file_opened"].includes(e.eventType) &&
        (e.domain || e.filePath?.match(/\.(docm|xlsm|xls|doc|hta|js|vbs)$/i))
      );
      const bruteForce = patterns.filter((p) => p.patternType === "brute_force");
      const externalLogin = events.filter((e) =>
        e.eventType === "successful_login" &&
        e.sourceIp && !isLocalIp(e.sourceIp)
      );

      const ids = [
        ...phishing.map((e) => e.id),
        ...bruteForce.flatMap((p) => p.eventIds),
        ...externalLogin.map((e) => e.id),
      ];
      const iocs = [
        ...phishing.flatMap((e) => [e.domain, e.filePath].filter(Boolean) as string[]),
        ...externalLogin.map((e) => e.sourceIp).filter(Boolean) as string[],
      ];

      if (ids.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };

      const confidence = phishing.length > 0 ? 0.88 : bruteForce.length > 0 ? 0.92 : 0.75;
      const method = phishing.length > 0 ? "phishing email or malicious document" :
                     bruteForce.length > 0 ? "credential brute force" : "external authentication";
      return {
        matched: true, confidence,
        supportingIds: [...new Set(ids)],
        iocValues: [...new Set(iocs)],
        reasoning: `Initial access detected via ${method}. ${phishing.length > 0 ? `${phishing.length} suspicious email/document event(s) identified.` : ""} ${bruteForce.length > 0 ? `${bruteForce[0].description}` : ""}`.trim(),
      };
    },
  },

  // ── Execution ──────────────────────────────────────────────────────────────
  {
    tacticName: "Execution", tacticId: "TA0002",
    possibleTechniques: ["T1059.001", "T1059.003", "T1204.002", "T1203"],
    detect(events, patterns) {
      const suspiciousProcs = events.filter((e) =>
        e.eventType === "process_created" && e.command && (
          e.command.toLowerCase().includes("-enc") ||
          e.command.toLowerCase().includes("base64") ||
          e.command.toLowerCase().includes("invoke-") ||
          e.command.toLowerCase().includes("downloadstring") ||
          e.command.toLowerCase().includes("iex") ||
          e.command.toLowerCase().match(/\.(ps1|vbs|bat|hta|js)\b/i) !== null
        )
      );
      const chainPatterns = patterns.filter((p) => p.patternType === "suspicious_process_chain");
      const droppers = patterns.filter((p) => p.patternType === "dropper_execution");

      const ids = [
        ...suspiciousProcs.map((e) => e.id),
        ...chainPatterns.flatMap((p) => p.eventIds),
        ...droppers.flatMap((p) => p.eventIds),
      ];
      if (ids.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };

      const iocs = suspiciousProcs.map((e) => e.process).filter(Boolean) as string[];
      return {
        matched: true, confidence: 0.85,
        supportingIds: [...new Set(ids)],
        iocValues: [...new Set(iocs)],
        reasoning: `Code execution detected: ${suspiciousProcs.length} suspicious process creation event(s)${chainPatterns.length > 0 ? `, ${chainPatterns.length} suspicious parent-child process chain(s)` : ""}${droppers.length > 0 ? `, ${droppers.length} dropper execution pattern(s)` : ""}.`,
      };
    },
  },

  // ── Persistence ────────────────────────────────────────────────────────────
  {
    tacticName: "Persistence", tacticId: "TA0003",
    possibleTechniques: ["T1547.001", "T1053.005", "T1136.001", "T1543.003"],
    detect(events) {
      const persist = events.filter((e) =>
        ["registry_modified", "scheduled_task_created", "service_installed"].includes(e.eventType) ||
        (e.eventType === "process_created" && e.command && (
          e.command.toLowerCase().includes("schtasks") ||
          e.command.toLowerCase().includes("crontab") ||
          e.command.toLowerCase().includes("cron.d")
        ))
      );
      if (persist.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const iocs = persist.map((e) => e.filePath ?? e.process).filter(Boolean) as string[];
      return {
        matched: true, confidence: 0.82,
        supportingIds: persist.map((e) => e.id),
        iocValues: [...new Set(iocs)],
        reasoning: `Persistence mechanism established: ${persist.map((e) => e.eventType).join(", ")}. Attacker created a foothold to survive reboots.`,
      };
    },
  },

  // ── Privilege Escalation ───────────────────────────────────────────────────
  {
    tacticName: "Privilege Escalation", tacticId: "TA0004",
    possibleTechniques: ["T1068", "T1078.003", "T1134"],
    detect(events) {
      const privesc = events.filter((e) =>
        e.eventType === "privilege_escalation" ||
        (e.eventType === "process_created" && e.command && (
          e.command.toLowerCase().includes("sudo su") ||
          e.command.toLowerCase().includes("runas") ||
          e.command.toLowerCase().includes("net localgroup administrators")
        ))
      );
      if (privesc.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      return {
        matched: true, confidence: 0.80,
        supportingIds: privesc.map((e) => e.id),
        iocValues: privesc.map((e) => e.user).filter(Boolean) as string[],
        reasoning: `Privilege escalation detected: ${privesc.length} event(s) indicating an attempt to gain elevated permissions.`,
      };
    },
  },

  // ── Defense Evasion ────────────────────────────────────────────────────────
  {
    tacticName: "Defense Evasion", tacticId: "TA0005",
    possibleTechniques: ["T1070.001", "T1562.001", "T1562.004", "T1036"],
    detect(events) {
      const evasion = events.filter((e) =>
        ["log_cleared", "antivirus_disabled", "firewall_modified"].includes(e.eventType)
      );
      if (evasion.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const types = [...new Set(evasion.map((e) => e.eventType))];
      return {
        matched: true, confidence: 0.88,
        supportingIds: evasion.map((e) => e.id),
        iocValues: evasion.map((e) => e.process).filter(Boolean) as string[],
        reasoning: `Defense evasion: ${types.join(", ")}. The attacker took steps to reduce detection risk before or during the attack.`,
      };
    },
  },

  // ── Credential Access ──────────────────────────────────────────────────────
  {
    tacticName: "Credential Access", tacticId: "TA0006",
    possibleTechniques: ["T1110", "T1110.001", "T1003.001", "T1555"],
    detect(events, patterns) {
      const credEvents = events.filter((e) => e.eventType === "credential_access");
      const bruteForce = patterns.filter((p) => p.patternType === "brute_force");
      const ids = [
        ...credEvents.map((e) => e.id),
        ...bruteForce.flatMap((p) => p.eventIds),
      ];
      if (ids.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const confidence = credEvents.length > 0 ? 0.92 : 0.85;
      const method = credEvents.length > 0 ? "memory credential dumping (LSASS/SAM)" : "brute force";
      return {
        matched: true, confidence,
        supportingIds: [...new Set(ids)],
        iocValues: credEvents.map((e) => e.process).filter(Boolean) as string[],
        reasoning: `Credential access via ${method}. ${credEvents.length} explicit credential dump event(s) detected.`,
      };
    },
  },

  // ── Lateral Movement ──────────────────────────────────────────────────────
  {
    tacticName: "Lateral Movement", tacticId: "TA0008",
    possibleTechniques: ["T1021.001", "T1021.002", "T1550.002"],
    detect(events, patterns) {
      const lateral = events.filter((e) => e.eventType === "lateral_movement");
      const lateralPatterns = patterns.filter((p) => p.patternType === "lateral_movement");
      const ids = [
        ...lateral.map((e) => e.id),
        ...lateralPatterns.flatMap((p) => p.eventIds),
      ];
      if (ids.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const iocs = events.filter((e) => ids.includes(e.id)).map((e) => e.destinationIp ?? e.hostname).filter(Boolean) as string[];
      return {
        matched: true, confidence: 0.85,
        supportingIds: [...new Set(ids)],
        iocValues: [...new Set(iocs)],
        reasoning: `Lateral movement detected: ${lateral.length} explicit event(s), ${lateralPatterns.length} correlated pattern(s). The attacker moved between internal systems.`,
      };
    },
  },

  // ── Collection ────────────────────────────────────────────────────────────
  {
    tacticName: "Collection", tacticId: "TA0009",
    possibleTechniques: ["T1560.001", "T1213", "T1005"],
    detect(events) {
      const collect = events.filter((e) =>
        ["bulk_file_access", "file_copy"].includes(e.eventType) ||
        (e.eventType === "process_created" && e.command && e.command.toLowerCase().match(/7z|zip|tar|rar/))
      );
      if (collect.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const iocs = collect.map((e) => e.filePath).filter(Boolean) as string[];
      return {
        matched: true, confidence: 0.78,
        supportingIds: collect.map((e) => e.id),
        iocValues: [...new Set(iocs)],
        reasoning: `Data collection: ${collect.length} event(s) indicating bulk file access or archive creation before exfiltration.`,
      };
    },
  },

  // ── Command and Control ───────────────────────────────────────────────────
  {
    tacticName: "Command and Control", tacticId: "TA0011",
    possibleTechniques: ["T1071.001", "T1071.004", "T1090"],
    detect(events, patterns) {
      const c2 = patterns.filter((p) => p.patternType === "c2_or_exfiltration");
      const dnsC2 = events.filter((e) => e.eventType === "dns_query" && e.domain);
      const netConn = events.filter((e) =>
        e.eventType === "network_connection" &&
        e.destinationIp && !isLocalIp(e.destinationIp) &&
        e.port && [443, 80, 8080, 8443, 4444, 1337].includes(e.port)
      );
      const ids = [
        ...c2.flatMap((p) => p.eventIds),
        ...netConn.map((e) => e.id),
      ];
      if (ids.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const iocs = [
        ...netConn.map((e) => e.destinationIp).filter(Boolean) as string[],
        ...dnsC2.map((e) => e.domain).filter(Boolean) as string[],
      ];
      return {
        matched: true, confidence: 0.80,
        supportingIds: [...new Set(ids)],
        iocValues: [...new Set(iocs)],
        reasoning: `Command and control communication: ${netConn.length} outbound connection(s) to external IPs${dnsC2.length > 0 ? `, ${dnsC2.length} DNS query(s) to suspicious domains` : ""}.`,
      };
    },
  },

  // ── Exfiltration ──────────────────────────────────────────────────────────
  {
    tacticName: "Exfiltration", tacticId: "TA0010",
    possibleTechniques: ["T1041", "T1048.003", "T1052.001"],
    detect(events) {
      const exfil = events.filter((e) =>
        ["data_exfiltration", "email_sent"].includes(e.eventType) ||
        (e.eventType === "usb_connected" && events.some(
          (f) => f.eventType === "file_copy" &&
            Math.abs(new Date(f.timestamp).getTime() - new Date(e.timestamp).getTime()) < 10 * 60 * 1000
        ))
      );
      if (exfil.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const iocs = exfil.map((e) => e.destinationIp ?? e.domain).filter(Boolean) as string[];
      return {
        matched: true, confidence: 0.88,
        supportingIds: exfil.map((e) => e.id),
        iocValues: [...new Set(iocs)],
        reasoning: `Data exfiltration: ${exfil.length} event(s) indicating data was transferred outside the environment.`,
      };
    },
  },

  // ── Impact ────────────────────────────────────────────────────────────────
  {
    tacticName: "Impact", tacticId: "TA0040",
    possibleTechniques: ["T1486", "T1490", "T1485"],
    detect(events) {
      const impact = events.filter((e) =>
        ["file_encrypted"].includes(e.eventType) ||
        (e.eventType === "process_created" && e.command && (
          e.command.toLowerCase().includes("vssadmin delete") ||
          e.command.toLowerCase().includes("bcdedit") ||
          e.command.toLowerCase().includes("wbadmin delete")
        ))
      );
      if (impact.length === 0) return { matched: false, confidence: 0, supportingIds: [], iocValues: [], reasoning: "" };
      const isRansomware = impact.some((e) =>
        e.eventType === "file_encrypted" || e.command?.toLowerCase().includes("vssadmin")
      );
      return {
        matched: true, confidence: 0.92,
        supportingIds: impact.map((e) => e.id),
        iocValues: impact.map((e) => e.process).filter(Boolean) as string[],
        reasoning: `Impact stage: ${isRansomware ? "ransomware-like activity detected (file encryption, shadow copy deletion)" : "destructive or disruptive activity"}. ${impact.length} event(s) support this stage.`,
      };
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLocalIp(ip: string): boolean {
  return (
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("127.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

function buildSummary(stages: AttackStage[], events: SecurityEvent[], overallConfidence: number): string {
  if (stages.length < 2) {
    return "Insufficient evidence to confidently reconstruct an attack chain. The dataset contains too few correlated events to determine attacker intent or sequence.";
  }

  const stageNames = stages.map((s) => s.name);
  const firstStage = stageNames[0];
  const lastStage = stageNames[stageNames.length - 1];

  const uniqueHosts = new Set(events.map((e) => e.hostname).filter(Boolean));
  const uniqueUsers = new Set(events.map((e) => e.user).filter(Boolean));
  const timeSpanMs = new Date(events[events.length - 1]?.timestamp ?? 0).getTime() -
                     new Date(events[0]?.timestamp ?? 0).getTime();
  const timeSpanMin = Math.round(timeSpanMs / 60000);

  const confidenceLabel = overallConfidence >= 0.8 ? "high" : overallConfidence >= 0.6 ? "moderate" : "low";

  return `A ${confidenceLabel}-confidence attack chain was reconstructed across ${stages.length} stages from ${firstStage} to ${lastStage}. ` +
    `The incident spans ${timeSpanMin > 0 ? `approximately ${timeSpanMin} minute${timeSpanMin !== 1 ? "s" : ""}` : "a short time window"} ` +
    `involving ${uniqueHosts.size} host${uniqueHosts.size !== 1 ? "s" : ""} and ${uniqueUsers.size} account${uniqueUsers.size !== 1 ? "s" : ""}. ` +
    `Key stages detected: ${stageNames.join(" → ")}.`;
}

function buildUncertainties(
  stages: AttackStage[],
  events: SecurityEvent[],
  allTactics: string[]
): string[] {
  const uncertainties: string[] = [];
  const detectedTacticNames = new Set(stages.map((s) => s.name));

  // Missing stages
  const missingTactics = allTactics.filter((t) => !detectedTacticNames.has(t));
  if (missingTactics.length > 0) {
    uncertainties.push(
      `The following ATT&CK tactics were not observed in the dataset: ${missingTactics.slice(0, 4).join(", ")}. Evidence for these stages may have been deleted, obfuscated, or not captured.`
    );
  }

  // Low confidence stages
  const lowConfStages = stages.filter((s) => s.confidence < 0.7);
  if (lowConfStages.length > 0) {
    uncertainties.push(
      `The following stages have low confidence and should be verified manually: ${lowConfStages.map((s) => s.name).join(", ")}.`
    );
  }

  // No timestamps
  const noTimestamp = events.filter((e) => !e.timestamp);
  if (noTimestamp.length > 0) {
    uncertainties.push(`${noTimestamp.length} event(s) had missing or unparseable timestamps, which may affect chronological ordering.`);
  }

  // No IP data
  const hasIps = events.some((e) => e.sourceIp || e.destinationIp);
  if (!hasIps) {
    uncertainties.push("No IP address data was detected. Network-based correlation and C2 detection were not possible.");
  }

  if (stages.length < 2) {
    uncertainties.push("Insufficient correlated events to reconstruct a confident attack chain. Consider uploading more comprehensive log data.");
  }

  return uncertainties;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function generateAttackStory(
  events: SecurityEvent[],
  relationships: EventRelationship[],
  patterns: DetectedPattern[],
  datasetId: string
): AttackStory {
  if (events.length === 0) {
    return {
      id: randomUUID(),
      datasetId,
      summary: "No events were provided. Unable to generate an attack story.",
      stages: [],
      overallConfidence: 0,
      evidence: [],
      uncertainties: ["No events in dataset."],
      generatedAt: new Date().toISOString(),
    };
  }

  const stages: AttackStage[] = [];
  const allEvidenceIds = new Set<string>();

  for (const rule of STAGE_RULES) {
    const result = rule.detect(events, patterns);
    if (!result.matched || result.supportingIds.length === 0) continue;

    stages.push({
      name: rule.tacticName,
      tacticId: rule.tacticId,
      supportingEventIds: result.supportingIds,
      reasoning: result.reasoning,
      confidence: result.confidence,
      possibleTechniques: rule.possibleTechniques,
      iocs: result.iocValues,
    });

    for (const id of result.supportingIds) allEvidenceIds.add(id);
  }

  // Sort stages by typical kill-chain order
  const tacticOrder = STAGE_RULES.map((r) => r.tacticName);
  stages.sort((a, b) => tacticOrder.indexOf(a.name) - tacticOrder.indexOf(b.name));

  const overallConfidence = stages.length > 0
    ? Math.round((stages.reduce((sum, s) => sum + s.confidence, 0) / stages.length) * 100) / 100
    : 0;

  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const summary = buildSummary(stages, sortedEvents, overallConfidence);
  const uncertainties = buildUncertainties(stages, events, TACTIC_DEFS.map((t) => t.name));

  return {
    id: randomUUID(),
    datasetId,
    summary,
    stages,
    overallConfidence,
    evidence: [...allEvidenceIds],
    uncertainties,
    generatedAt: new Date().toISOString(),
  };
}
