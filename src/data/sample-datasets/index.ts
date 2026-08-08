/**
 * sample-datasets/index.ts
 *
 * Metadata registry for built-in sample datasets.
 * The actual JSON files are loaded at runtime via fetch("/sample-datasets/...").
 * This file provides the UI with display metadata only.
 *
 * All datasets are SYNTHETIC. No real threat data. All IPs, usernames,
 * hostnames, and hashes are fictional and used for training purposes only.
 */

export interface SampleDatasetMeta {
  id: string;
  title: string;
  description: string;
  attackType: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  eventCount: number;
  timeRangeLabel: string;
  tags: string[];
  /** Path relative to /public/sample-datasets/ */
  fileName: string;
}

export const SAMPLE_DATASETS: SampleDatasetMeta[] = [
  {
    id: "sample-brute-force",
    title: "SSH Brute Force & Lateral Movement",
    description:
      "An attacker performs a brute-force SSH attack against an exposed VPN gateway, gains access, downloads a payload, escalates privileges, and moves laterally to an internal application server.",
    attackType: "Brute Force / Credential Theft",
    difficulty: "Beginner",
    eventCount: 23,
    timeRangeLabel: "~4 minutes",
    tags: ["Brute Force", "SSH", "Lateral Movement", "Persistence"],
    fileName: "brute-force.json",
  },
  {
    id: "sample-ransomware",
    title: "Phishing → Ransomware Deployment",
    description:
      "A Finance employee opens a macro-enabled invoice document, triggering a PowerShell dropper that establishes C2, dumps credentials via LSASS, moves laterally to a file server, stages data for exfiltration, and deploys ransomware.",
    attackType: "Ransomware",
    difficulty: "Intermediate",
    eventCount: 18,
    timeRangeLabel: "~16 minutes",
    tags: ["Phishing", "Ransomware", "Credential Access", "Exfiltration"],
    fileName: "ransomware.json",
  },
  {
    id: "sample-insider-threat",
    title: "Insider Data Exfiltration",
    description:
      "A trusted engineer accesses bulk files after hours, archives them with 7-Zip, uploads to personal cloud storage, copies to a USB drive, and attempts to cover tracks by clearing security logs.",
    attackType: "Insider Threat",
    difficulty: "Intermediate",
    eventCount: 17,
    timeRangeLabel: "~80 minutes",
    tags: ["Insider Threat", "Data Theft", "DLP", "Defense Evasion"],
    fileName: "insider-threat.json",
  },
  {
    id: "sample-elastic-format",
    title: "Elastic ECS Format — Web Server Compromise",
    description:
      "Demonstrates @timestamp and nested Elastic Common Schema fields. An attacker downloads a payload via curl, executes it, escalates privileges, establishes C2, and clears logs. Tests non-standard field name handling.",
    attackType: "Credential Theft",
    difficulty: "Beginner",
    eventCount: 8,
    timeRangeLabel: "~2 minutes",
    tags: ["ECS Format", "@timestamp", "Reverse Shell", "Persistence"],
    fileName: "elastic-format.json",
  },
];

export function getSampleDatasetById(id: string): SampleDatasetMeta | undefined {
  return SAMPLE_DATASETS.find((d) => d.id === id);
}
