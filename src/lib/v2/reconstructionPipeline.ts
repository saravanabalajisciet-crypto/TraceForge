/**
 * reconstructionPipeline.ts
 *
 * Orchestrates all V2 engines in sequence:
 * Ingest → Normalize → Reconstruct Timeline → Attack Story → MITRE → IOCs
 *
 * Single entry point for both the API route and any future callers.
 * Returns a complete ReconstructionResult.
 */

import { ingestEvents, buildDatasetOverview } from "@/lib/v2/eventIngestion";
import { normalizeEvents } from "@/lib/v2/eventNormalization";
import { reconstructTimeline } from "@/lib/v2/timelineReconstruction";
import { generateAttackStory } from "@/lib/v2/attackStory";
import { inferMitreMappings } from "@/lib/v2/mitreInference";
import { extractIocs } from "@/lib/v2/iocExtraction";
import {
  IngestionFormat,
  ReconstructionResult,
  ConfidenceSummary,
  DatasetOverview,
} from "@/types/v2";

export interface PipelineInput {
  rawData: string;
  format?: IngestionFormat;
  fileName?: string;
  fileSizeBytes?: number;
}

export interface PipelineResult {
  reconstruction: ReconstructionResult;
  overview: DatasetOverview;
  ingestionWarnings: string[];
  normalizationWarnings: string[];
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB hard limit

export function runReconstructionPipeline(input: PipelineInput): PipelineResult {
  const start = Date.now();

  // ── Guard: file size ──────────────────────────────────────────────────────
  const byteSize = input.fileSizeBytes ?? Buffer.byteLength(input.rawData, "utf8");
  if (byteSize > MAX_FILE_SIZE) {
    throw new Error(`Dataset too large (${Math.round(byteSize / 1024)}KB). Maximum allowed is 5MB.`);
  }

  // ── Stage 1: Ingest ───────────────────────────────────────────────────────
  const ingestionResult = ingestEvents(input.rawData, input.format);

  const overview = buildDatasetOverview(
    ingestionResult,
    input.fileName ?? "uploaded-dataset.json",
    byteSize,
    input.format ?? "json"
  );

  if (ingestionResult.events.length === 0) {
    const empty = buildEmptyResult(ingestionResult.datasetId, start);
    return { reconstruction: empty, overview, ingestionWarnings: ingestionResult.warnings, normalizationWarnings: [] };
  }

  // ── Stage 2: Normalize ────────────────────────────────────────────────────
  const normResult = normalizeEvents(ingestionResult.events);

  // ── Stage 3: Timeline Reconstruction ─────────────────────────────────────
  const timelineResult = reconstructTimeline(normResult.events);

  // ── Stage 4: Attack Story ─────────────────────────────────────────────────
  const attackStory = generateAttackStory(
    timelineResult.sorted,
    timelineResult.relationships,
    timelineResult.detectedPatterns,
    ingestionResult.datasetId
  );

  // ── Stage 5: MITRE Inference ──────────────────────────────────────────────
  const mitreMappings = inferMitreMappings(timelineResult.sorted, attackStory);

  // ── Stage 6: IOC Extraction ───────────────────────────────────────────────
  const iocs = extractIocs(timelineResult.sorted, attackStory);

  // ── Compute time range ────────────────────────────────────────────────────
  const sorted = timelineResult.sorted;
  const firstTs = new Date(sorted[0].timestamp).getTime();
  const lastTs = new Date(sorted[sorted.length - 1].timestamp).getTime();

  // ── Compute confidence summary ────────────────────────────────────────────
  const timelineConf = sorted.length > 0
    ? Math.min(100, Math.round((timelineResult.relationships.length / sorted.length) * 80 + 20))
    : 0;
  const mitreConf = mitreMappings.length > 0
    ? Math.round(mitreMappings.reduce((s, m) => s + m.confidence, 0) / mitreMappings.length * 100)
    : 0;
  const storyConf = Math.round(attackStory.overallConfidence * 100);
  const overall = Math.round((timelineConf * 0.3 + mitreConf * 0.35 + storyConf * 0.35));

  const confidenceSummary: ConfidenceSummary = {
    overall, timeline: timelineConf, mitre: mitreConf, story: storyConf,
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    totalEvents: sorted.length,
    suspiciousEvents: timelineResult.stats.suspiciousEventIds.size,
    uniqueUsers: new Set(sorted.map((e) => e.user).filter(Boolean)).size,
    uniqueHosts: new Set(sorted.map((e) => e.hostname).filter(Boolean)).size,
    uniqueIps: new Set([
      ...sorted.map((e) => e.sourceIp),
      ...sorted.map((e) => e.destinationIp),
    ].filter(Boolean)).size,
    uniqueEventTypes: new Set(sorted.map((e) => e.eventType)).size,
  };

  const reconstruction: ReconstructionResult = {
    datasetId: ingestionResult.datasetId,
    events: sorted,
    relationships: timelineResult.relationships,
    groups: timelineResult.groups,
    attackStory,
    mitreMappings,
    iocs,
    timeRange: { start: new Date(firstTs).toISOString(), end: new Date(lastTs).toISOString(), durationMs: lastTs - firstTs },
    stats,
    confidenceSummary,
    reconstructedAt: new Date().toISOString(),
    processingMs: Date.now() - start,
  };

  return {
    reconstruction,
    overview,
    ingestionWarnings: ingestionResult.warnings,
    normalizationWarnings: normResult.warnings.map((w) => w.reason),
  };
}

function buildEmptyResult(datasetId: string, start: number): ReconstructionResult {
  const emptyStory = {
    id: `story_empty`, datasetId, summary: "No valid events were found in the uploaded dataset.",
    stages: [], overallConfidence: 0, evidence: [],
    uncertainties: ["Dataset contained no parseable events."],
    generatedAt: new Date().toISOString(),
  };
  return {
    datasetId, events: [], relationships: [], groups: [],
    attackStory: emptyStory, mitreMappings: [], iocs: [],
    timeRange: { start: new Date().toISOString(), end: new Date().toISOString(), durationMs: 0 },
    stats: { totalEvents: 0, suspiciousEvents: 0, uniqueUsers: 0, uniqueHosts: 0, uniqueIps: 0, uniqueEventTypes: 0 },
    confidenceSummary: { overall: 0, timeline: 0, mitre: 0, story: 0 },
    reconstructedAt: new Date().toISOString(),
    processingMs: Date.now() - start,
  };
}
