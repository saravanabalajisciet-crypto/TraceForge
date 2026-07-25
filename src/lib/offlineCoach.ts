/**
 * offlineCoach.ts
 *
 * Offline DFIR Mentor — fully rule-based, zero API calls.
 * Activates automatically when Gemini is unavailable.
 *
 * Uses: ScenarioFull, InvestigationState, scoring engine output.
 * Never reveals correct answers. Always guides through questions.
 */

import { ScenarioFull, InvestigationState, EvidenceItem } from "@/types";

// ─── Input Shapes (mirror geminiCoach context fields) ─────────────────────────

export interface OfflineCoachContext {
  scenarioId: string;
  scenarioTitle: string;
  attackType: string;
  difficulty: string;
  currentTimeline?: Array<{ evidenceId: string; title: string; timestamp: string }>;
  reviewedEvidence?: Array<{ id: string; title: string; mitreTactic: string }>;
  selectedEvidenceId?: string;
  selectedEvidenceTitle?: string;
  selectedEvidenceDetails?: string;
  investigationSummary?: string;
  timelineAccuracy?: number;
  mitreScore?: number;
  missedEvents?: string[];
  // Optional enrichment — provided when scenario data is available server-side
  scenario?: ScenarioFull;
  invState?: InvestigationState;
}

// ─── Attack-Type Guidance Maps ────────────────────────────────────────────────

const ATTACK_PHASES: Record<string, string[]> = {
  Ransomware: [
    "Initial Access (phishing, drive-by, exposed services)",
    "Execution (macro, script, exploit)",
    "Defense Evasion (AV/FW disabling, log clearing)",
    "Credential Access (LSASS dump, keylogging)",
    "Lateral Movement (pass-the-hash, SMB, RDP)",
    "Persistence (scheduled tasks, registry run keys)",
    "Collection (data staging, archiving)",
    "Exfiltration (C2 upload, DNS tunnel)",
    "Impact (encryption, shadow copy deletion)",
  ],
  "Insider Threat": [
    "Initial Privilege Abuse (anomalous access times, unusual systems)",
    "Collection (bulk download, mass file access)",
    "Exfiltration (USB, personal email, cloud upload)",
    "Defense Evasion (log deletion, policy bypass)",
    "Impact (data destruction, sabotage)",
  ],
  "Credential Theft": [
    "Initial Access (phishing, credential stuffing)",
    "Execution (PowerShell, WMI, script hosts)",
    "Credential Access (LSASS, SAM, NTDS, browser stores)",
    "Lateral Movement (pass-the-hash, pass-the-ticket, RDP)",
    "Persistence (new accounts, golden ticket)",
    "Exfiltration (credential export, C2 staging)",
  ],
  "Brute Force": [
    "Reconnaissance (username enumeration, port scanning)",
    "Credential Access (brute force, password spray)",
    "Initial Access (successful login post-compromise)",
    "Lateral Movement (internal auth attempts)",
    "Persistence (backdoor account, SSH key injection)",
  ],
  APT: [
    "Reconnaissance (OSINT, spear-phishing prep)",
    "Initial Access (targeted phishing, watering hole)",
    "Execution (living-off-the-land, LOLBins)",
    "Persistence (implant, scheduled task, WMI subscription)",
    "Defense Evasion (fileless, timestomping, log wiping)",
    "Credential Access (Kerberoasting, DCSync)",
    "Lateral Movement (PtH, PtT, remote services)",
    "Collection (keylogging, screenshot, file staging)",
    "Exfiltration (encrypted C2, steganography)",
  ],
  default: [
    "Initial Access", "Execution", "Persistence",
    "Credential Access", "Lateral Movement",
    "Collection", "Exfiltration", "Impact",
  ],
};

const TACTIC_QUESTIONS: Record<string, string> = {
  "Initial Access": "Think about how the attacker first got in. Look for authentication anomalies, email gateway alerts, or external-facing service logs around the earliest timestamp.",
  "Execution": "Consider which process spawned the suspicious activity. Parent-child process relationships and encoded command lines are strong indicators of execution techniques.",
  "Persistence": "Ask yourself: how would the attacker survive a reboot? Registry Run keys, scheduled tasks, and service installations are common persistence mechanisms.",
  "Credential Access": "Focus on memory access events targeting lsass.exe, SAM database access, or authentication logs with unusual source IPs and logon types.",
  "Lateral Movement": "Compare authentication logs across multiple hosts. Logon Type 3 (network) with NTLM from a single source to many targets is a red flag.",
  "Defense Evasion": "Look for evidence of security tools being disabled, log entries being cleared, or processes masquerading as legitimate system binaries.",
  "Collection": "Search for archive creation (7z, zip, rar), bulk file reads, or staging directories in temp folders before the exfiltration window.",
  "Exfiltration": "Correlate network logs — large outbound transfers, unusual destination IPs, or POST requests to domains with very short TTLs.",
  "Command and Control": "DNS queries with low TTL values and outbound HTTPS connections to newly-registered domains are typical C2 indicators.",
  "Impact": "The final stage often leaves the most obvious artifacts. Look for encryption processes, vssadmin commands, or ransom note creation.",
  "Discovery": "Attackers enumerate the environment before moving. Look for net commands, LDAP queries, or WMI enumeration shortly after initial access.",
};

const SOURCE_TYPE_CONTEXT: Record<string, string> = {
  "Windows Event Log": "Windows Event Logs record authentication, process creation, service changes, and policy modifications. Event IDs 4624 (logon), 4688 (process create), 7045 (service install), and 4698 (scheduled task) are particularly valuable for attack reconstruction.",
  "Endpoint Detection": "EDR alerts capture process trees, file operations, and memory access patterns in real time. They often catch techniques that evade signature-based AV by observing behaviour rather than file hashes.",
  "SIEM": "SIEM correlation rules aggregate events across multiple sources. A single SIEM alert may represent hundreds of raw events — look at the underlying raw data it references.",
  "Firewall": "Firewall logs reveal network-layer activity. Permitted outbound connections to unusual geographic locations or known threat-intel IPs during an incident window deserve close attention.",
  "Sysmon": "Sysmon provides deep endpoint telemetry including process creation (Event 1), network connections (Event 3), and registry changes (Event 13). It fills the gaps left by native Windows logging.",
  "Email Gateway": "Email gateway logs capture delivery metadata, attachment hashes, SPF/DKIM validation results, and sender reputation scores — critical for identifying phishing as an initial access vector.",
  default: "Examine the source type, timestamp, hostname, and username fields together. Correlation across multiple sources is more powerful than any single artefact in isolation.",
};

// ─── Helper: get tactic coverage ─────────────────────────────────────────────

function getCoveredTactics(ctx: OfflineCoachContext): string[] {
  const reviewed = ctx.reviewedEvidence ?? [];
  const timeline = ctx.currentTimeline ?? [];
  const allTactics = new Set<string>();
  reviewed.forEach((e) => { if (e.mitreTactic) allTactics.add(e.mitreTactic); });
  // timeline items don't carry tactic directly in context — that's fine
  return [...allTactics];
}

function getUncoveredPhases(ctx: OfflineCoachContext): string[] {
  const phases = ATTACK_PHASES[ctx.attackType] ?? ATTACK_PHASES.default;
  const covered = getCoveredTactics(ctx).map((t) => t.toLowerCase());
  return phases.filter((p) => !covered.some((c) => p.toLowerCase().includes(c)));
}

// ─── Generator: Hint ─────────────────────────────────────────────────────────

export function generateHint(ctx: OfflineCoachContext): string {
  const timelineCount = ctx.currentTimeline?.length ?? 0;
  const reviewedCount = ctx.reviewedEvidence?.length ?? 0;
  const uncovered = getUncoveredPhases(ctx);
  const phases = ATTACK_PHASES[ctx.attackType] ?? ATTACK_PHASES.default;

  // Early-stage — no timeline yet
  if (timelineCount === 0) {
    return `You haven't placed any events in your timeline yet. Start by looking for the attacker's earliest foothold.\n\nIn a ${ctx.attackType} attack, the chain typically begins with: ${phases[0]}.\n\nTry to identify the first suspicious authentication event or the initial delivery mechanism. Think about what evidence would exist in the minutes before the attack became visible.`;
  }

  // Some timeline built — suggest next uncovered tactic
  if (uncovered.length > 0) {
    const nextPhase = uncovered[0];
    const tacticKey = Object.keys(TACTIC_QUESTIONS).find((k) =>
      nextPhase.toLowerCase().includes(k.toLowerCase())
    );
    const guidance = tacticKey ? TACTIC_QUESTIONS[tacticKey] : `Look for evidence related to the ${nextPhase} phase of this attack.`;
    return `You've placed ${timelineCount} event${timelineCount !== 1 ? "s" : ""} and reviewed ${reviewedCount} evidence item${reviewedCount !== 1 ? "s" : ""}. Good progress.\n\nConsider this: ${guidance}\n\nLook across your available evidence cards for indicators matching this behaviour pattern. Not every source type will contain what you're looking for — think about which source would most likely record this activity.`;
  }

  // Good coverage — encourage correlation
  return `You've covered the main attack phases well. Now focus on correlation.\n\nCan you establish a clear causal chain? For each event in your timeline, ask yourself: what did the attacker do immediately before this, and what did it enable them to do next?\n\nIn ${ctx.attackType} investigations, the connection between ${phases[Math.floor(phases.length / 2)]} and ${phases[phases.length - 1]} is often where the most critical forensic evidence lies.`;
}

// ─── Generator: Explain Evidence ─────────────────────────────────────────────

export function explainEvidence(ctx: OfflineCoachContext): string {
  const title = ctx.selectedEvidenceTitle ?? "this evidence item";
  const details = ctx.selectedEvidenceDetails ?? "";

  // Extract fields from the formatted details string
  const sourceMatch = details.match(/Source:\s*(.+)/);
  const mitreMatch = details.match(/MITRE:\s*(T[\d.]+)\s*\(([^)]+)\)/);
  const source = sourceMatch?.[1]?.trim() ?? "Unknown Source";
  const techniqueId = mitreMatch?.[1] ?? "";
  const tactic = mitreMatch?.[2] ?? "";

  const sourceCtx = SOURCE_TYPE_CONTEXT[source] ?? SOURCE_TYPE_CONTEXT.default;
  const tacticQuestion = tactic ? (TACTIC_QUESTIONS[tactic] ?? "") : "";

  let response = `**Evidence: ${title}**\n\n`;
  response += `**Source Context**\n${sourceCtx}\n\n`;

  if (techniqueId && tactic) {
    response += `**MITRE Mapping — ${techniqueId} (${tactic})**\nThis evidence maps to the ${tactic} phase. `;
    if (tacticQuestion) {
      response += `${tacticQuestion}\n\n`;
    } else {
      response += `\n\n`;
    }
  }

  response += `**Investigator's Questions to Ask**\n`;
  response += `— What does the timing of this event tell you about the attacker's pace?\n`;
  response += `— Which other hosts or accounts appear in nearby log entries?\n`;
  response += `— Does this artefact indicate the attacker was establishing a foothold, moving laterally, or achieving their objective?\n\n`;
  response += `Compare this evidence against others in the same time window. Correlation between source types — endpoint, network, and authentication logs — builds a more complete picture than any single artefact alone.`;

  return response;
}

// ─── Generator: Next Step ─────────────────────────────────────────────────────

export function recommendNextStep(ctx: OfflineCoachContext): string {
  const timelineCount = ctx.currentTimeline?.length ?? 0;
  const reviewedCount = ctx.reviewedEvidence?.length ?? 0;
  const uncovered = getUncoveredPhases(ctx);
  const coveredTactics = getCoveredTactics(ctx);

  if (reviewedCount === 0 && timelineCount === 0) {
    return `You're at the start of the investigation. Here's a systematic approach:\n\n1. Begin by reading the Investigation Brief carefully — it tells you the incident window and affected systems.\n2. Sort through available evidence and look for the earliest timestamp.\n3. Open each evidence card and read the raw log data, not just the title.\n\nFor ${ctx.attackType} attacks, start by asking: "How did the attacker get in?" That first event anchors your entire timeline.`;
  }

  if (uncovered.length > 0) {
    const nextPhase = uncovered[0];
    const tacticKey = Object.keys(TACTIC_QUESTIONS).find((k) =>
      nextPhase.toLowerCase().includes(k.toLowerCase())
    );
    const guidance = tacticKey ? TACTIC_QUESTIONS[tacticKey] : "";

    return `You've covered: ${coveredTactics.length > 0 ? coveredTactics.join(", ") : "some initial phases"}.\n\nNext, investigate the **${nextPhase}** phase.\n\n${guidance ? guidance + "\n\n" : ""}Look for evidence types that would record this kind of attacker activity. Think about which source — endpoint, network, authentication, or email — is most likely to capture this behaviour.\n\nDo not just look at evidence you haven't reviewed yet. Sometimes the most important correlation comes from re-examining evidence you've already seen in the context of what you've discovered since.`;
  }

  return `You've investigated all major attack phases. Focus now on timeline ordering.\n\nAsk yourself:\n— Is the sequence of events you've placed causally consistent?\n— Does each event logically enable the next?\n— Are there any gaps in the timeline that an attacker would need to bridge?\n\nFor ${ctx.attackType} attacks, pay particular attention to the sequence between credential access and lateral movement — this is where investigators most often find ordering errors.`;
}

// ─── Generator: Explain Mistakes ─────────────────────────────────────────────

export function explainMistakes(ctx: OfflineCoachContext): string {
  const timelineAccuracy = ctx.timelineAccuracy ?? 0;
  const mitreScore = ctx.mitreScore ?? 0;
  const missed = ctx.missedEvents ?? [];
  const phases = ATTACK_PHASES[ctx.attackType] ?? ATTACK_PHASES.default;

  let response = "";

  // Timeline feedback
  if (timelineAccuracy >= 85) {
    response += `**Timeline Reconstruction — Strong (${timelineAccuracy}%)**\nYour chronological ordering was accurate. The key skill in timeline analysis is anchoring events to their causal relationships, not just timestamps — and you demonstrated that well.\n\n`;
  } else if (timelineAccuracy >= 60) {
    response += `**Timeline Reconstruction — Partial (${timelineAccuracy}%)**\nYour timeline captured the broad attack narrative but some events were out of sequence. A common mistake is ordering by timestamp alone when log sources have clock skew. Focus on causal logic: an event that creates a file must precede an event that executes that file, regardless of a few seconds of timestamp difference.\n\n`;
  } else {
    response += `**Timeline Reconstruction — Needs Work (${timelineAccuracy}%)**\nTimeline ordering is the core skill in DFIR. Think about the attack chain as a sequence of dependencies: the attacker cannot move laterally before they have credentials; they cannot encrypt files before they have access to the file server. Use this causal logic to anchor your ordering even when timestamps are unclear.\n\n`;
  }

  // MITRE feedback
  if (mitreScore >= 85) {
    response += `**MITRE ATT&CK Coverage — Excellent (${mitreScore}%)**\nYou identified nearly all the techniques used in this attack. Mastery of ATT&CK mapping allows you to rapidly communicate attacker behaviour to both technical and executive audiences — a critical skill in real-world incident response.\n\n`;
  } else if (mitreScore >= 60) {
    response += `**MITRE ATT&CK Coverage — Partial (${mitreScore}%)**\nYou captured the major tactics but missed some technique-level detail. The difference between a tactic (what the attacker is trying to achieve) and a technique (how they achieve it) is important. For example, "Credential Access" is a tactic; "LSASS Memory Dumping" (T1003.001) is the specific technique — and it points directly to the tooling used.\n\n`;
  } else {
    response += `**MITRE ATT&CK Coverage — Incomplete (${mitreScore}%)**\nSeveral attack tactics went unidentified. Review the MITRE ATT&CK framework for ${ctx.attackType} attack patterns. The typical kill chain for this attack type includes: ${phases.slice(0, 5).join(" → ")}. Study each tactic and ask which evidence types would indicate its presence.\n\n`;
  }

  // Missed events guidance
  if (missed.length > 0) {
    response += `**Missed Evidence Categories**\nSome evidence categories were not incorporated into your investigation. Rather than listing what you missed, consider these investigative questions:\n`;
    response += `— Did you review evidence from every available source type (endpoint, network, authentication, email)?\n`;
    response += `— Did you look at events before the most obvious attack activity? Attackers prepare before they strike.\n`;
    response += `— Did you examine events after the main attack? Persistence mechanisms and cleanup activity often occur post-impact.\n\n`;
  }

  // Learning recommendation
  response += `**Recommended Focus Areas**\n`;
  if (mitreScore < 70) {
    response += `Study the MITRE ATT&CK Enterprise matrix, specifically the ${ctx.attackType === "Ransomware" ? "Impact and Lateral Movement" : "Credential Access and Persistence"} tactics. Practice mapping raw log entries to technique IDs.\n`;
  }
  if (timelineAccuracy < 70) {
    response += `Practice timeline analysis using causal dependency mapping rather than timestamp-only ordering. Build the habit of asking "what had to happen first for this event to occur?"\n`;
  }
  response += `Every investigation you complete — even imperfect ones — builds the pattern recognition skills that make experienced analysts effective. Keep investigating.`;

  return response;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export type OfflineCoachAction = "hint" | "explain-evidence" | "next-step" | "explain-mistakes";

export function offlineCoachRequest(
  action: OfflineCoachAction,
  ctx: OfflineCoachContext
): string {
  switch (action) {
    case "hint":
      return generateHint(ctx);
    case "explain-evidence":
      return explainEvidence(ctx);
    case "next-step":
      return recommendNextStep(ctx);
    case "explain-mistakes":
      return explainMistakes(ctx);
    default:
      return generateHint(ctx);
  }
}
