/**
 * investigationStore.ts
 *
 * Simple in-memory store for V2 ReconstructionResults.
 * Lives in the Next.js server process — cleared on restart.
 * Keyed by datasetId. Max 20 entries (LRU eviction).
 */

import { ReconstructionResult } from "@/types/v2";

const MAX_ENTRIES = 20;
const store = new Map<string, { result: ReconstructionResult; createdAt: number }>();

export function saveInvestigation(result: ReconstructionResult): void {
  // Evict oldest if at capacity
  if (store.size >= MAX_ENTRIES) {
    let oldestKey = "";
    let oldestTime = Infinity;
    for (const [key, val] of store) {
      if (val.createdAt < oldestTime) { oldestTime = val.createdAt; oldestKey = key; }
    }
    if (oldestKey) store.delete(oldestKey);
  }
  store.set(result.datasetId, { result, createdAt: Date.now() });
}

export function getInvestigation(datasetId: string): ReconstructionResult | null {
  return store.get(datasetId)?.result ?? null;
}

export function listInvestigations(): Array<{ datasetId: string; createdAt: number; eventCount: number }> {
  return [...store.entries()].map(([id, { result, createdAt }]) => ({
    datasetId: id, createdAt, eventCount: result.events.length,
  }));
}
