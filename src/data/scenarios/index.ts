import { Scenario, ScenarioFull } from "@/types";
import { shadowlock } from "./shadowlock";
import { silentInsider } from "./silent-insider";
import { ghostLogin } from "./ghost-login";

// ─── Full scenario registry (used in investigation workspace) ─────────────────
export const scenarioRegistry: Record<string, ScenarioFull> = {
  [shadowlock.id]: shadowlock,
  [silentInsider.id]: silentInsider,
  [ghostLogin.id]: ghostLogin,
};

export function getScenarioById(id: string): ScenarioFull | null {
  return scenarioRegistry[id] ?? null;
}

// ─── Lightweight list (used in Scenario Library / Landing Page) ───────────────
export const scenarios: Scenario[] = Object.values(scenarioRegistry).map(
  ({ evidence, mitreMappings, recommendations, learningObjectives, investigationBrief, riskLevel, ...meta }) => meta
);
