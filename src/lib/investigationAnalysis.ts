/**
 * investigationAnalysis.ts
 *
 * Pure rule-based investigation analysis engine.
 * No AI. No backend. No randomness.
 * All results derived deterministically from the student's investigation state
 * compared against the ground-truth scenario data.
 */

import { ScenarioFull, InvestigationState, EvidenceItem, MitreMappingEntry } from "@/types";

// ─── Result Types ─────────────────────────────────────────────────────────────

export type TimelineEventStatus = "correct" | "out-of-order" | "missed";
export type MitreCoverageStatus = "covered" | "partial" | "missed";
export type InvestigationRating = "Excellent" | "Good" | "Needs Improvement";

export interface TimelineEventResult {
  evidenceId: string;
  title: string;
  timestamp: string;
  severity: string;
  mitreTactic: string;
  mitreTechnique: string;
  status: TimelineEventStatus;
  studentPosition: number | null;   // position in student's timeline (0-based)
  correctPosition: number;          // position in canonical timeline (0-based)
}

export interface MitreCoverageResult {
  tactic: string;
  techniques: string[];
  techniqueNames: string[];
  status: MitreCoverageStatus;
  coveredTechniques: string[];
  missedTechniques: string[];
}

export interface IocCategory {
  label: string;
  icon: string;
  items: string[];
}

export interface InvestigationAnalysisResult {
  // Timeline
  timelineResults: TimelineEventResult[];
  correctCount: number;
  outOfOrderCount: number;
  missedCount: number;

  // MITRE
  mitreCoverage: MitreCoverageResult[];
  mitreScore: number; // 0–100

  // IOCs
  iocSummary: IocCategory[];

  // Scores (0–100 each)
  timelineAccuracy: number;
  threatCoverage: number;
  iocRecognition: number;
  investigationCompleteness: number;
  overallScore: number;
  rating: InvestigationRating;

  // Narrative
  investigationSummary: string;

  // Recommendations
  derivedRecommendations: string[];
}

// ─── Canonical Timeline ───────────────────────────────────────────────────────

/**
 * Returns evidence sorted chronologically — this is the "correct" order.
 */
function getCanonicalTimeline(scenario: ScenarioFull): EvidenceItem[] {
  return [...scenario.evidence].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

// ─── Timeline Analysis ────────────────────────────────────────────────────────

function analyzeTimeline(
  scenario: ScenarioFull,
  invState: InvestigationState
): Pick<InvestigationAnalysisResult, "timelineResults" | "correctCount" | "outOfOrderCount" | "missedCount"> {
  const canonical = getCanonicalTimeline(scenario);
  const studentEvidenceIds = invState.timeline.map((s) => s.evidenceId);

  const results: TimelineEventResult[] = canonical.map((ev, correctIdx) => {
    const studentIdx = studentEvidenceIds.indexOf(ev.id);
    const inTimeline = studentIdx !== -1;

    let status: TimelineEventStatus;
    if (!inTimeline) {
      status = "missed";
    } else if (studentIdx === correctIdx) {
      status = "correct";
    } else {
      // Allow ±1 positional tolerance for near-correct ordering
      status = Math.abs(studentIdx - correctIdx) <= 1 ? "correct" : "out-of-order";
    }

    return {
      evidenceId: ev.id,
      title: ev.title,
      timestamp: ev.timestamp,
      severity: ev.severity,
      mitreTactic: ev.mitreTactic,
      mitreTechnique: ev.mitreTechnique,
      status,
      studentPosition: inTimeline ? studentIdx : null,
      correctPosition: correctIdx,
    };
  });

  const correctCount = results.filter((r) => r.status === "correct").length;
  const outOfOrderCount = results.filter((r) => r.status === "out-of-order").length;
  const missedCount = results.filter((r) => r.status === "missed").length;

  return { timelineResults: results, correctCount, outOfOrderCount, missedCount };
}

// ─── MITRE Coverage Analysis ──────────────────────────────────────────────────

function analyzeMitre(
  scenario: ScenarioFull,
  invState: InvestigationState
): Pick<InvestigationAnalysisResult, "mitreCoverage" | "mitreScore"> {
  // Group scenario mappings by tactic
  const tacticMap = new Map<string, MitreMappingEntry[]>();
  for (const m of scenario.mitreMappings) {
    if (!tacticMap.has(m.tactic)) tacticMap.set(m.tactic, []);
    tacticMap.get(m.tactic)!.push(m);
  }

  // Which techniques did the student encounter via timeline?
  const studentEvidenceIds = new Set(invState.timeline.map((s) => s.evidenceId));
  const reviewedIds = new Set(invState.reviewedEvidenceIds);

  // Get techniques the student "found" — either in timeline or reviewed
  const studentTechniques = new Set<string>();
  for (const ev of scenario.evidence) {
    if (studentEvidenceIds.has(ev.id) || reviewedIds.has(ev.id)) {
      studentTechniques.add(ev.mitreTechnique);
    }
  }

  const coverage: MitreCoverageResult[] = [];
  let totalTechniques = 0;
  let coveredTechniques = 0;

  for (const [tactic, mappings] of tacticMap) {
    const techniques = mappings.map((m) => m.techniqueId);
    const techniqueNames = mappings.map((m) => m.techniqueName);
    const covered = techniques.filter((t) => studentTechniques.has(t));
    const missed = techniques.filter((t) => !studentTechniques.has(t));

    totalTechniques += techniques.length;
    coveredTechniques += covered.length;

    let status: MitreCoverageStatus;
    if (covered.length === techniques.length) status = "covered";
    else if (covered.length > 0) status = "partial";
    else status = "missed";

    coverage.push({
      tactic,
      techniques,
      techniqueNames,
      status,
      coveredTechniques: covered,
      missedTechniques: missed,
    });
  }

  const mitreScore = totalTechniques > 0
    ? Math.round((coveredTechniques / totalTechniques) * 100)
    : 0;

  return { mitreCoverage: coverage, mitreScore };
}

// ─── IOC Extraction ───────────────────────────────────────────────────────────

function extractIocs(scenario: ScenarioFull): IocCategory[] {
  const ips = new Set<string>();
  const domains = new Set<string>();
  const urls = new Set<string>();
  const usernames = new Set<string>();
  const hostnames = new Set<string>();
  const hashes = new Set<string>();
  const eventIds = new Set<string>();
  const filepaths = new Set<string>();
  const registryKeys = new Set<string>();

  for (const ev of scenario.evidence) {
    // Hostnames always
    if (ev.hostname && ev.hostname !== "—") hostnames.add(ev.hostname);
    // Usernames (skip generic ones)
    if (ev.username && !ev.username.includes("@corp.local") && ev.username !== "system" && ev.username !== "hr.admin") {
      usernames.add(ev.username);
    }
    // Event IDs
    if (ev.eventId) eventIds.add(ev.eventId);

    // IOC by type
    if (ev.iocValue) {
      switch (ev.iocType) {
        case "ip": ips.add(ev.iocValue); break;
        case "domain": domains.add(ev.iocValue); break;
        case "url": urls.add(ev.iocValue); break;
        case "hash": hashes.add(ev.iocValue); break;
        case "filepath": filepaths.add(ev.iocValue); break;
        case "registry": registryKeys.add(ev.iocValue); break;
        case "username": usernames.add(ev.iocValue); break;
        case "email": domains.add(ev.iocValue); break;
      }
    }
  }

  const categories: IocCategory[] = [];

  if (ips.size > 0) categories.push({ label: "Suspicious IP Addresses", icon: "ip", items: [...ips] });
  if (domains.size > 0) categories.push({ label: "Suspicious Domains / Emails", icon: "domain", items: [...domains] });
  if (urls.size > 0) categories.push({ label: "Malicious URLs", icon: "url", items: [...urls] });
  if (hashes.size > 0) categories.push({ label: "File Hashes (IoC)", icon: "hash", items: [...hashes] });
  if (usernames.size > 0) categories.push({ label: "Compromised Accounts", icon: "user", items: [...usernames] });
  if (hostnames.size > 0) categories.push({ label: "Affected Hostnames", icon: "host", items: [...hostnames] });
  if (filepaths.size > 0) categories.push({ label: "Malicious File Paths", icon: "file", items: [...filepaths] });
  if (registryKeys.size > 0) categories.push({ label: "Registry Modifications", icon: "registry", items: [...registryKeys] });
  if (eventIds.size > 0) categories.push({ label: "Windows Event IDs", icon: "event", items: [...eventIds] });

  return categories;
}

// ─── Narrative Generation ─────────────────────────────────────────────────────

function generateNarrative(
  scenario: ScenarioFull,
  timelineResults: TimelineEventResult[],
  mitreCoverage: MitreCoverageResult[],
  scores: { timeline: number; mitre: number; completeness: number }
): string {
  const { timeline, mitre, completeness } = scores;
  const scenarioTitle = scenario.title;
  const attackType = scenario.attackType;

  // Which tactics the student nailed vs missed
  const coveredTactics = mitreCoverage.filter((m) => m.status === "covered").map((m) => m.tactic);
  const missedTactics = mitreCoverage.filter((m) => m.status === "missed").map((m) => m.tactic);
  const partialTactics = mitreCoverage.filter((m) => m.status === "partial").map((m) => m.tactic);

  // Specific missed evidence titles
  const missedEvidence = timelineResults.filter((r) => r.status === "missed").map((r) => r.title);
  const outOfOrder = timelineResults.filter((r) => r.status === "out-of-order").map((r) => r.title);

  let intro = "";
  if (completeness >= 85) {
    intro = `You conducted a thorough forensic investigation of ${scenarioTitle}, successfully reconstructing the core stages of the ${attackType.toLowerCase()} attack.`;
  } else if (completeness >= 60) {
    intro = `You made meaningful progress in the ${scenarioTitle} investigation, correctly identifying several key stages of the ${attackType.toLowerCase()} attack chain.`;
  } else {
    intro = `Your investigation of ${scenarioTitle} identified some indicators, but several critical stages of the ${attackType.toLowerCase()} attack remain unaccounted for in your timeline.`;
  }

  let tacticSentence = "";
  if (coveredTactics.length > 0 && missedTactics.length === 0) {
    tacticSentence = ` All MITRE ATT&CK tactics were correctly identified, including ${coveredTactics.slice(0, 3).join(", ")}.`;
  } else if (coveredTactics.length > 0) {
    tacticSentence = ` You correctly identified ${coveredTactics.slice(0, 3).join(", ")}.`;
  }

  let missSentence = "";
  if (missedTactics.length > 0 && missedEvidence.length > 0) {
    missSentence = ` However, the ${missedTactics.join(" and ")} ${missedTactics.length === 1 ? "stage was" : "stages were"} not reflected in your timeline. Evidence such as "${missedEvidence[0]}" should have been included to complete the attack narrative.`;
  } else if (missedEvidence.length > 0) {
    missSentence = ` Some evidence items were not placed in your timeline, including "${missedEvidence[0]}," which would have strengthened your reconstruction.`;
  }

  let orderSentence = "";
  if (outOfOrder.length > 0) {
    orderSentence = ` The sequence of some events was incorrect — "${outOfOrder[0]}" was placed out of chronological order, which affects the attack chain reconstruction.`;
  }

  let closingSentence = "";
  if (timeline >= 80 && mitre >= 80) {
    closingSentence = " Overall, this is a strong investigation that demonstrates solid DFIR skills.";
  } else if (missedTactics.some((t) => t.toLowerCase().includes("persistence"))) {
    closingSentence = " The persistence mechanism was overlooked, which would have allowed the attacker to maintain access undetected after the initial compromise.";
  } else if (missedTactics.some((t) => t.toLowerCase().includes("exfil"))) {
    closingSentence = " Data exfiltration was not captured in the timeline, meaning the full business impact of this incident remains unquantified.";
  } else {
    closingSentence = " Review the missed evidence to build a more complete picture of the threat actor's kill chain.";
  }

  return intro + tacticSentence + missSentence + orderSentence + closingSentence;
}

// ─── Recommendation Generation ────────────────────────────────────────────────

function deriveRecommendations(
  scenario: ScenarioFull,
  timelineResults: TimelineEventResult[],
  mitreCoverage: MitreCoverageResult[]
): string[] {
  const recs: string[] = [];
  const missedTactics = new Set(
    mitreCoverage.filter((m) => m.status !== "covered").map((m) => m.tactic.toLowerCase())
  );
  const studentEvidenceTechniques = new Set(
    timelineResults.filter((r) => r.status !== "missed").map((r) => r.mitreTechnique)
  );

  // Always include scenario-defined recommendations
  for (const rec of scenario.recommendations) {
    recs.push(rec.text);
  }

  // Add contextual recommendations based on what was missed
  if (missedTactics.has("persistence") || missedTactics.has("persistence")) {
    recs.push("Audit all scheduled tasks and registry Run keys on domain-joined systems for unauthorized entries.");
  }
  if (missedTactics.has("exfiltration")) {
    recs.push("Review outbound firewall logs for large HTTPS transfers to external IPs during the incident window.");
  }
  if (studentEvidenceTechniques.has("T1059.001") || studentEvidenceTechniques.has("T1059")) {
    recs.push("Enable PowerShell Script Block Logging (Event ID 4104) to capture encoded commands.");
  }
  if (studentEvidenceTechniques.has("T1110.001") || studentEvidenceTechniques.has("T1110")) {
    recs.push("Implement account lockout policy: lock after 5 failed attempts for 15 minutes to prevent brute force.");
  }
  if (scenario.attackType === "Ransomware") {
    recs.push("Maintain immutable, offline backups tested quarterly to ensure recovery without paying ransom.");
  }
  if (scenario.attackType === "Insider Threat") {
    recs.push("Deploy User and Entity Behavior Analytics (UEBA) to detect anomalous data access by privileged users.");
  }

  // Deduplicate and limit
  return [...new Set(recs)].slice(0, 7);
}

// ─── Score Computation ────────────────────────────────────────────────────────

function computeScores(
  canonical: EvidenceItem[],
  invState: InvestigationState,
  correctCount: number,
  outOfOrderCount: number,
  missedCount: number,
  mitreScore: number,
  iocSummary: IocCategory[]
): {
  timelineAccuracy: number;
  threatCoverage: number;
  iocRecognition: number;
  investigationCompleteness: number;
  overallScore: number;
  rating: InvestigationRating;
} {
  const total = canonical.length;
  if (total === 0) {
    return { timelineAccuracy: 0, threatCoverage: 0, iocRecognition: 0, investigationCompleteness: 0, overallScore: 0, rating: "Needs Improvement" };
  }

  // Timeline accuracy: correct full points, out-of-order half points
  const timelineAccuracy = Math.round(
    ((correctCount + outOfOrderCount * 0.5) / total) * 100
  );

  // Threat coverage = mitre score
  const threatCoverage = mitreScore;

  // IOC recognition: how many IOC-bearing evidence items were reviewed
  const iocEvidenceIds = new Set<string>();
  // This is a proxy: if student reviewed any evidence, they "recognized" IOCs from it
  const reviewedCount = invState.reviewedEvidenceIds.length;
  const iocRecognition = Math.min(100, Math.round((reviewedCount / total) * 100));

  // Completeness: blend of all three
  const investigationCompleteness = Math.round(
    timelineAccuracy * 0.4 + threatCoverage * 0.35 + iocRecognition * 0.25
  );

  // Overall
  const overallScore = Math.round(
    timelineAccuracy * 0.35 + threatCoverage * 0.35 + iocRecognition * 0.15 + investigationCompleteness * 0.15
  );

  const rating: InvestigationRating =
    overallScore >= 80 ? "Excellent" : overallScore >= 55 ? "Good" : "Needs Improvement";

  return {
    timelineAccuracy,
    threatCoverage,
    iocRecognition,
    investigationCompleteness,
    overallScore,
    rating,
  };
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export function analyzeInvestigation(
  scenario: ScenarioFull,
  invState: InvestigationState
): InvestigationAnalysisResult {
  const canonical = getCanonicalTimeline(scenario);

  const { timelineResults, correctCount, outOfOrderCount, missedCount } =
    analyzeTimeline(scenario, invState);

  const { mitreCoverage, mitreScore } = analyzeMitre(scenario, invState);

  const iocSummary = extractIocs(scenario);

  const scores = computeScores(
    canonical,
    invState,
    correctCount,
    outOfOrderCount,
    missedCount,
    mitreScore,
    iocSummary
  );

  const investigationSummary = generateNarrative(scenario, timelineResults, mitreCoverage, {
    timeline: scores.timelineAccuracy,
    mitre: scores.threatCoverage,
    completeness: scores.investigationCompleteness,
  });

  const derivedRecommendations = deriveRecommendations(scenario, timelineResults, mitreCoverage);

  return {
    timelineResults,
    correctCount,
    outOfOrderCount,
    missedCount,
    mitreCoverage,
    mitreScore,
    iocSummary,
    ...scores,
    investigationSummary,
    derivedRecommendations,
  };
}
