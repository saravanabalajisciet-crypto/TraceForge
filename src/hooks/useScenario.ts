import { useState } from "react";
import { Scenario } from "@/types";
import { scenarios } from "@/data/scenarios";

export function useScenario(id?: string) {
  const scenario = id ? scenarios.find((s) => s.id === id) ?? null : null;
  return { scenario, scenarios };
}

export function useActiveScenario() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const scenario = activeId
    ? scenarios.find((s) => s.id === activeId) ?? null
    : null;

  return { scenario, activeId, setActiveId };
}
