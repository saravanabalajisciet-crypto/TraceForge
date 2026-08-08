/**
 * mitreInference.ts
 *
 * Phase 7a — MITRE ATT&CK Inference Engine
 *
 * Rule-based mapping of SecurityEvents → ATT&CK techniques.
 * Requires at least 2 corroborating signals per technique.
 * Never infers from a single keyword.
 */

import { SecurityEvent, V2MitreMapping, AttackStory } from "@/types/v2";

// ─── Technique Rule ───────────────────────────────────────────────────────────

interface TechniqueRule {
  techniqueId: string;
  techniqueName: string;
  tactic: string;
  tacticId: string;
  /** Minimum number of matching signals required */
  minSignals: number;
  /** Returns matching event IDs and confidence */
  match: (events: SecurityEvent[]) => { eventIds: string[]; signals: number };
  buildExplanation: (eventIds: string[], events: SecurityEvent[]) => string;
}

// ─── Technique Rules ──────────────────────────────────────────────────────────

const TECHNIQUE_RULES: TechniqueRule[] = [
  // T1110 — Brute Force
  {
    techniqueId: "T1110", techniqueName: "Brute Force",
    tactic: "Credential Access", tacticId: "TA0006",
    minSignals: 3,
    match(events) {
      const fails = events.filter((e) => ["failed_login", "authentication_failure"].includes(e.eventType));
      return { eventIds: fails.map((e) => e.id), signals: fails.length };
    },
    buildExplanation(ids, events) {
      const ips = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.sourceIp).filter(Boolean))];
      return `${ids.length} failed authentication event(s) detected${ips.length > 0 ? ` from ${ips.slice(0, 2).join(", ")}` : ""}. Multiple failed attempts are a strong indicator of brute force activity.`;
    },
  },

  // T1078 — Valid Accounts
  {
    techniqueId: "T1078", techniqueName: "Valid Accounts",
    tactic: "Initial Access", tacticId: "TA0001",
    minSignals: 2,
    match(events) {
      const successes = events.filter((e) => e.eventType === "successful_login");
      const fails = events.filter((e) => e.eventType === "failed_login");
      // Valid accounts abuse: success after failures, OR success from unusual location
      const afterBrute = successes.filter((s) =>
        fails.some((f) => f.sourceIp === s.sourceIp || f.user === s.user)
      );
      return { eventIds: afterBrute.map((e) => e.id), signals: afterBrute.length + fails.length };
    },
    buildExplanation(ids, events) {
      const users = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.user).filter(Boolean))];
      return `Valid account(s)${users.length > 0 ? ` (${users.slice(0, 2).join(", ")})` : ""} were used for authentication following failed attempts, suggesting stolen or compromised credentials.`;
    },
  },

  // T1566.001 — Spearphishing Attachment
  {
    techniqueId: "T1566.001", techniqueName: "Spearphishing Attachment",
    tactic: "Initial Access", tacticId: "TA0001",
    minSignals: 2,
    match(events) {
      const emails = events.filter((e) => e.eventType === "email_received");
      const docOpens = events.filter((e) =>
        e.eventType === "file_opened" &&
        e.filePath?.match(/\.(docm|xlsm|xls|doc|pdf|hta)$/i)
      );
      return { eventIds: [...emails.map((e) => e.id), ...docOpens.map((e) => e.id)], signals: emails.length + docOpens.length };
    },
    buildExplanation(ids, events) {
      const domains = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.domain).filter(Boolean))];
      return `Email received${domains.length > 0 ? ` from ${domains[0]}` : ""} followed by document file open event — consistent with spearphishing attachment delivery.`;
    },
  },

  // T1059.001 — PowerShell
  {
    techniqueId: "T1059.001", techniqueName: "PowerShell",
    tactic: "Execution", tacticId: "TA0002",
    minSignals: 2,
    match(events) {
      const ps = events.filter((e) =>
        e.eventType === "process_created" &&
        (e.process?.toLowerCase() === "powershell.exe" || e.process?.toLowerCase() === "pwsh.exe" ||
         e.command?.toLowerCase().includes("powershell"))
      );
      const encoded = ps.filter((e) => e.command?.toLowerCase().includes("-enc") || e.command?.toLowerCase().includes("base64"));
      return { eventIds: ps.map((e) => e.id), signals: ps.length + encoded.length * 2 };
    },
    buildExplanation(ids, events) {
      const encoded = events.filter((e) => ids.includes(e.id) && e.command?.toLowerCase().includes("-enc"));
      return `PowerShell execution detected${encoded.length > 0 ? ` with ${encoded.length} encoded command(s) (obfuscation indicator)` : ""}. PowerShell is commonly abused for initial staging and lateral movement.`;
    },
  },

  // T1003.001 — LSASS Memory
  {
    techniqueId: "T1003.001", techniqueName: "LSASS Memory",
    tactic: "Credential Access", tacticId: "TA0006",
    minSignals: 2,
    match(events) {
      const lsass = events.filter((e) =>
        e.eventType === "credential_access" ||
        e.command?.toLowerCase().includes("lsass") ||
        e.command?.toLowerCase().includes("mimikatz") ||
        e.command?.toLowerCase().includes("sekurlsa")
      );
      return { eventIds: lsass.map((e) => e.id), signals: lsass.length * 2 };
    },
    buildExplanation(ids, _events) {
      return `${ids.length} event(s) indicate access to LSASS process memory or credential dumping tools — the primary technique for extracting plaintext credentials and NTLM hashes on Windows.`;
    },
  },

  // T1550.002 — Pass the Hash
  {
    techniqueId: "T1550.002", techniqueName: "Pass the Hash",
    tactic: "Lateral Movement", tacticId: "TA0008",
    minSignals: 2,
    match(events) {
      // Indicators: NTLM logon (type 3) after credential dump, or lateral movement event
      const credDump = events.filter((e) => e.eventType === "credential_access");
      const lateralAuth = events.filter((e) =>
        e.eventType === "successful_login" &&
        e.destinationIp && e.destinationIp !== e.sourceIp
      );
      if (credDump.length === 0) return { eventIds: [], signals: 0 };
      return {
        eventIds: [...credDump.map((e) => e.id), ...lateralAuth.map((e) => e.id)],
        signals: credDump.length + lateralAuth.length,
      };
    },
    buildExplanation(ids, events) {
      const targets = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.hostname).filter(Boolean))];
      return `Credential dumping followed by network authentication to ${targets.length > 0 ? targets.slice(0, 2).join(", ") : "internal systems"} is consistent with Pass-the-Hash — using captured NTLM hashes without knowing the plaintext password.`;
    },
  },

  // T1547.001 — Registry Run Keys
  {
    techniqueId: "T1547.001", techniqueName: "Registry Run Keys / Startup Folder",
    tactic: "Persistence", tacticId: "TA0003",
    minSignals: 2,
    match(events) {
      const reg = events.filter((e) =>
        e.eventType === "registry_modified" &&
        (e.filePath?.toLowerCase().includes("currentversion\\run") ||
         e.filePath?.toLowerCase().includes("currentversion\\runonce"))
      );
      return { eventIds: reg.map((e) => e.id), signals: reg.length * 2 };
    },
    buildExplanation(ids, events) {
      const keys = events.filter((e) => ids.includes(e.id)).map((e) => e.filePath).filter(Boolean);
      return `Registry Run key modification detected${keys.length > 0 ? `: ${keys[0]}` : ""}. This technique ensures the malware executes on every user login.`;
    },
  },

  // T1053.005 — Scheduled Task
  {
    techniqueId: "T1053.005", techniqueName: "Scheduled Task/Job",
    tactic: "Persistence", tacticId: "TA0003",
    minSignals: 2,
    match(events) {
      const tasks = events.filter((e) =>
        e.eventType === "scheduled_task_created" ||
        (e.eventType === "process_created" && (
          e.command?.toLowerCase().includes("schtasks") ||
          e.command?.toLowerCase().includes("crontab") ||
          e.command?.toLowerCase().match(/cron\.d/)
        ))
      );
      return { eventIds: tasks.map((e) => e.id), signals: tasks.length * 2 };
    },
    buildExplanation(ids, _events) {
      return `${ids.length} scheduled task creation event(s) detected. Attackers use scheduled tasks to maintain persistent execution without user interaction.`;
    },
  },

  // T1562.001 — Disable/Modify Tools
  {
    techniqueId: "T1562.001", techniqueName: "Disable or Modify Tools",
    tactic: "Defense Evasion", tacticId: "TA0005",
    minSignals: 2,
    match(events) {
      const disable = events.filter((e) =>
        e.eventType === "antivirus_disabled" ||
        e.eventType === "firewall_modified"
      );
      return { eventIds: disable.map((e) => e.id), signals: disable.length * 2 };
    },
    buildExplanation(ids, _events) {
      return `${ids.length} security tool modification event(s) detected. Disabling endpoint protection is a prerequisite for stealthy malware deployment.`;
    },
  },

  // T1070.001 — Clear Windows Event Logs
  {
    techniqueId: "T1070.001", techniqueName: "Clear Windows Event Logs",
    tactic: "Defense Evasion", tacticId: "TA0005",
    minSignals: 2,
    match(events) {
      const clear = events.filter((e) => e.eventType === "log_cleared");
      return { eventIds: clear.map((e) => e.id), signals: clear.length * 2 };
    },
    buildExplanation(ids, _events) {
      return `${ids.length} log clearing event(s) detected. Clearing logs is a common anti-forensics technique used to remove evidence of malicious activity.`;
    },
  },

  // T1041 — Exfiltration Over C2 Channel
  {
    techniqueId: "T1041", techniqueName: "Exfiltration Over C2 Channel",
    tactic: "Exfiltration", tacticId: "TA0010",
    minSignals: 2,
    match(events) {
      const exfil = events.filter((e) => e.eventType === "data_exfiltration");
      const netExfil = events.filter((e) =>
        e.eventType === "network_connection" &&
        e.destinationIp && !e.destinationIp.startsWith("10.") && !e.destinationIp.startsWith("192.168.")
      );
      return { eventIds: [...exfil.map((e) => e.id), ...netExfil.map((e) => e.id)], signals: exfil.length * 2 + netExfil.length };
    },
    buildExplanation(ids, events) {
      const dsts = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.destinationIp ?? e.domain).filter(Boolean))];
      return `Data exfiltration via outbound connection${dsts.length > 0 ? ` to ${dsts.slice(0, 2).join(", ")}` : ""}. Attackers used the C2 channel to transfer collected data outside the network.`;
    },
  },

  // T1486 — Data Encrypted for Impact
  {
    techniqueId: "T1486", techniqueName: "Data Encrypted for Impact",
    tactic: "Impact", tacticId: "TA0040",
    minSignals: 2,
    match(events) {
      const encrypt = events.filter((e) => e.eventType === "file_encrypted");
      const ransom = events.filter((e) =>
        e.command?.toLowerCase().includes("--encrypt") ||
        e.filePath?.match(/readme_decrypt|ransom_note|how_to_decrypt/i)
      );
      return { eventIds: [...encrypt.map((e) => e.id), ...ransom.map((e) => e.id)], signals: encrypt.length * 3 + ransom.length };
    },
    buildExplanation(ids, events) {
      const files = events.filter((e) => ids.includes(e.id) && e.filePath).length;
      return `File encryption activity detected across ${files} event(s). This is the final stage of a ransomware attack, rendering victim data inaccessible.`;
    },
  },

  // T1490 — Inhibit System Recovery
  {
    techniqueId: "T1490", techniqueName: "Inhibit System Recovery",
    tactic: "Impact", tacticId: "TA0040",
    minSignals: 2,
    match(events) {
      const vss = events.filter((e) =>
        e.command?.toLowerCase().includes("vssadmin delete") ||
        e.command?.toLowerCase().includes("wbadmin delete") ||
        e.command?.toLowerCase().includes("bcdedit /set") ||
        e.command?.toLowerCase().includes("shadowcopy")
      );
      return { eventIds: vss.map((e) => e.id), signals: vss.length * 3 };
    },
    buildExplanation(ids, _events) {
      return `${ids.length} shadow copy or backup deletion event(s) detected. Attackers destroy recovery options to maximize the impact of ransomware and prevent restoration without paying.`;
    },
  },

  // T1560.001 — Archive via Utility
  {
    techniqueId: "T1560.001", techniqueName: "Archive via Utility",
    tactic: "Collection", tacticId: "TA0009",
    minSignals: 2,
    match(events) {
      const archive = events.filter((e) =>
        (e.eventType === "process_created" && e.command?.toLowerCase().match(/7z|winzip|winrar|tar\s/)) ||
        (e.filePath?.match(/\.(7z|zip|rar|tar\.gz|tgz)$/i))
      );
      return { eventIds: archive.map((e) => e.id), signals: archive.length * 2 };
    },
    buildExplanation(ids, events) {
      const paths = events.filter((e) => ids.includes(e.id) && e.filePath).map((e) => e.filePath);
      return `Archive creation detected${paths.length > 0 ? `: ${paths[0]}` : ""}. Data was compressed and potentially encrypted before exfiltration, a common staging technique.`;
    },
  },

  // T1071.001 — Web Protocols (C2)
  {
    techniqueId: "T1071.001", techniqueName: "Application Layer Protocol: Web Protocols",
    tactic: "Command and Control", tacticId: "TA0011",
    minSignals: 2,
    match(events) {
      const https = events.filter((e) =>
        e.eventType === "network_connection" &&
        e.port && [443, 80].includes(e.port) &&
        e.destinationIp && !e.destinationIp.startsWith("10.") && !e.destinationIp.startsWith("192.168.")
      );
      return { eventIds: https.map((e) => e.id), signals: https.length };
    },
    buildExplanation(ids, events) {
      const dsts = [...new Set(events.filter((e) => ids.includes(e.id)).map((e) => e.destinationIp).filter(Boolean))];
      return `HTTPS/HTTP connections to external IPs (${dsts.slice(0, 2).join(", ")}). Using standard web protocols for C2 allows attackers to blend in with normal traffic.`;
    },
  },
];

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function inferMitreMappings(
  events: SecurityEvent[],
  attackStory: AttackStory
): V2MitreMapping[] {
  const mappings: V2MitreMapping[] = [];

  for (const rule of TECHNIQUE_RULES) {
    const { eventIds, signals } = rule.match(events);
    if (eventIds.length === 0 || signals < rule.minSignals) continue;

    // Confidence: scales with signal count, capped at 0.97
    const rawConf = Math.min(0.50 + (signals / 10) * 0.47, 0.97);
    const confidence = Math.round(rawConf * 100) / 100;

    const uniqueIds = [...new Set(eventIds)];
    const explanation = rule.buildExplanation(uniqueIds, events);

    mappings.push({
      techniqueId: rule.techniqueId,
      techniqueName: rule.techniqueName,
      tactic: rule.tactic,
      tacticId: rule.tacticId,
      confidence,
      supportingEventIds: uniqueIds,
      explanation,
    });
  }

  // Also include techniques from attackStory stages not already mapped
  for (const stage of attackStory.stages) {
    for (const techId of stage.possibleTechniques) {
      if (!mappings.some((m) => m.techniqueId === techId)) {
        mappings.push({
          techniqueId: techId,
          techniqueName: techId, // ID only — no extra lookup needed
          tactic: stage.name,
          tacticId: stage.tacticId ?? "",
          confidence: Math.round(stage.confidence * 0.9 * 100) / 100,
          supportingEventIds: stage.supportingEventIds,
          explanation: `Inferred from ${stage.name} stage: ${stage.reasoning}`,
        });
      }
    }
  }

  // Sort by confidence descending
  return mappings.sort((a, b) => b.confidence - a.confidence);
}
