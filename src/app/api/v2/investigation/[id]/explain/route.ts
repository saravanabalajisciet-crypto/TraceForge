/**
 * POST /api/v2/investigation/:id/explain
 *
 * AI Mentor for V2 investigations.
 * Same Gemini → Offline fallback architecture as V1 /api/coach.
 * Works over dynamically reconstructed datasets instead of predefined scenarios.
 */

import { NextRequest, NextResponse } from "next/server";
import { getInvestigation } from "@/lib/v2/investigationStore";
import { GeminiRateLimitError, GeminiAPIError } from "@/lib/geminiCoach";
import { V2CoachActionType } from "@/types/v2";

// ─── V2 Prompt Builders ───────────────────────────────────────────────────────

function buildV2SystemPrompt(): string {
  return `You are a Senior Digital Forensics and Incident Response (DFIR) mentor guiding a student through a dynamically reconstructed security investigation.

The investigation was built from real uploaded event data using automated correlation and attack chain reconstruction.

Your role:
- Teach through questions, not answers
- Explain forensic reasoning behind each finding
- Help the student understand WHY events are connected
- Reference MITRE ATT&CK tactics and techniques where relevant
- Guide the student to draw their own conclusions

Critical rules:
- NEVER say "the attacker did X" as absolute fact — say "the evidence suggests..."
- NEVER reveal the full attack chain in one response
- ALWAYS explain the forensic significance of each piece of evidence
- ALWAYS ask a follow-up investigative question
- Confidence levels are probabilistic — teach the student to think in probabilities`;
}

function buildExplainEventPrompt(reconstruction: NonNullable<ReturnType<typeof getInvestigation>>, eventId: string): string {
  const event = reconstruction.events.find((e) => e.id === eventId);
  if (!event) return "Event not found in this investigation.";

  const relatedRels = reconstruction.relationships.filter(
    (r) => r.fromEventId === eventId || r.toEventId === eventId
  );
  const stage = reconstruction.attackStory.stages.find((s) => s.supportingEventIds.includes(eventId));
  const mitre = reconstruction.mitreMappings.find((m) => m.supportingEventIds.includes(eventId));

  return `${buildV2SystemPrompt()}

INVESTIGATION CONTEXT:
- Dataset: ${reconstruction.datasetId}
- Total events: ${reconstruction.events.length}
- Attack stages detected: ${reconstruction.attackStory.stages.map((s) => s.name).join(", ")}

FOCUSED EVENT:
Type: ${event.eventType}
Timestamp: ${event.timestamp}
Source IP: ${event.sourceIp ?? "N/A"}
Destination IP: ${event.destinationIp ?? "N/A"}
User: ${event.user ?? "N/A"}
Hostname: ${event.hostname ?? "N/A"}
Process: ${event.process ?? "N/A"}
Command: ${event.command ?? "N/A"}
Severity: ${event.severity ?? "N/A"}

ATTACK STAGE: ${stage?.name ?? "Not yet assigned to a stage"}
MITRE TECHNIQUE: ${mitre?.techniqueId ?? "None inferred"} — ${mitre?.techniqueName ?? ""}
RELATIONSHIPS: ${relatedRels.length} connection(s) to other events

The student wants to understand this event.

Explain:
1. What this event type means forensically
2. Why the severity level (${event.severity}) was assigned
3. What attacker behaviour this typically indicates
4. How it connects to the ${stage?.name ?? "broader"} attack stage
5. What the student should look for next

End with one investigative question. Keep response under 200 words.`;
}

function buildV2HintPrompt(reconstruction: NonNullable<ReturnType<typeof getInvestigation>>): string {
  const stages = reconstruction.attackStory.stages;
  const lowConfStages = stages.filter((s) => s.confidence < 0.7);
  const stageNames = stages.map((s) => s.name).join(", ");

  return `${buildV2SystemPrompt()}

INVESTIGATION SUMMARY:
${reconstruction.attackStory.summary}

DETECTED STAGES: ${stageNames || "None yet"}
OVERALL CONFIDENCE: ${Math.round(reconstruction.attackStory.overallConfidence * 100)}%
UNCERTAINTIES: ${reconstruction.attackStory.uncertainties[0] ?? "None noted"}

${lowConfStages.length > 0 ? `LOW-CONFIDENCE STAGES NEEDING REVIEW: ${lowConfStages.map((s) => s.name).join(", ")}` : ""}

The student is asking for a hint on what to investigate next.

Guide them to:
1. Examine the low-confidence stages or gaps in the chain
2. Look at IOC relationships they haven't explored
3. Consider what attack stage might be missing

Ask one probing question that guides without revealing. Under 150 words.`;
}

function buildV2NextStepPrompt(reconstruction: NonNullable<ReturnType<typeof getInvestigation>>): string {
  const stages = reconstruction.attackStory.stages.map((s) => `${s.name} (${Math.round(s.confidence * 100)}%)`);
  const iocCount = reconstruction.iocs.length;

  return `${buildV2SystemPrompt()}

RECONSTRUCTION STATUS:
- Stages detected: ${stages.join(", ")}
- IOCs extracted: ${iocCount}
- Relationships mapped: ${reconstruction.relationships.length}
- Suspicious events: ${reconstruction.events.filter((e) => e.severity === "critical" || e.severity === "high").length}

The student asks: "What should I investigate next?"

Recommend a direction based on gaps in the reconstruction. Focus on:
1. Which attack phases are not yet confirmed
2. Which high-severity events haven't been explained
3. What correlation might strengthen a low-confidence stage

Under 200 words. End with a question.`;
}

function buildV2SummarizePrompt(reconstruction: NonNullable<ReturnType<typeof getInvestigation>>): string {
  return `${buildV2SystemPrompt()}

FULL INVESTIGATION SUMMARY:
${reconstruction.attackStory.summary}

STAGE BREAKDOWN:
${reconstruction.attackStory.stages.map((s) =>
  `- ${s.name} (${Math.round(s.confidence * 100)}% confidence): ${s.reasoning}`
).join("\n")}

UNCERTAINTIES:
${reconstruction.attackStory.uncertainties.join("\n")}

Generate a professional DFIR incident summary suitable for a technical audience.
- 3–4 sentences
- Reference the attack chain chronologically
- Note confidence levels honestly
- Do NOT claim certainty where the evidence is ambiguous`;
}

// ─── Offline V2 Fallback ──────────────────────────────────────────────────────

function offlineV2Response(
  action: V2CoachActionType,
  reconstruction: NonNullable<ReturnType<typeof getInvestigation>>
): string {
  const stages = reconstruction.attackStory.stages;
  const stageNames = stages.map((s) => s.name);

  switch (action) {
    case "hint":
      return `This investigation has detected ${stages.length} attack stage${stages.length !== 1 ? "s" : ""}: ${stageNames.join(", ")}.\n\nLook at the events with the lowest confidence and ask: what additional evidence would confirm or deny this stage?\n\nFor each suspicious event, consider: could this have a legitimate explanation? What would distinguish normal activity from malicious intent in this context?`;

    case "explain-event":
      return `To understand any event in a DFIR investigation, consider four dimensions:\n\n1. **Timing** — when did it occur relative to other events?\n2. **Actor** — which account or process triggered it?\n3. **Location** — which host, and is that expected?\n4. **Action** — is this behaviour normal for this actor on this host?\n\nCorrelation across all four dimensions is more reliable than analysing any single field in isolation.`;

    case "next-step":
      if (stages.length === 0) return `No attack stages have been confirmed yet. Start by reviewing the highest-severity events and ask: what was the attacker trying to achieve? Work backwards from the most obvious malicious activity to find the initial access vector.`;
      return `You've confirmed: ${stageNames.join(", ")}.\n\nNow consider what's missing from the chain. In most attacks, every stage leaves traces. If a stage isn't represented, either the evidence was deleted, wasn't logged, or the attack didn't follow that path.\n\nWhich gap in the chain is most significant for understanding the full scope of this incident?`;

    case "summarize-investigation":
      return reconstruction.attackStory.summary;

    default:
      return `Review the reconstructed timeline and focus on events with critical or high severity. Each high-severity event represents a significant attacker action — understanding the sequence between them will reveal the attack chain.`;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reconstruction = getInvestigation(id);
  if (!reconstruction) {
    return NextResponse.json(
      { error: `Investigation ${id} not found. Please re-upload your dataset.` },
      { status: 404 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { action, eventId } = (body ?? {}) as Record<string, unknown>;
  const validActions: V2CoachActionType[] = [
    "hint", "explain-event", "next-step", "summarize-investigation",
    "explain-relationship", "explain-stage", "explain-mistakes",
  ];

  if (!action || !validActions.includes(action as V2CoachActionType)) {
    return NextResponse.json(
      { error: `Invalid action. Valid: ${validActions.join(", ")}` },
      { status: 400 }
    );
  }

  const act = action as V2CoachActionType;

  // ── Try Gemini ─────────────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const { coachRequest } = await import("@/lib/geminiCoach");

      // Build a prompt appropriate for V2
      let prompt: string;
      switch (act) {
        case "explain-event":
          prompt = buildExplainEventPrompt(reconstruction, typeof eventId === "string" ? eventId : "");
          break;
        case "next-step":
          prompt = buildV2NextStepPrompt(reconstruction);
          break;
        case "summarize-investigation":
          prompt = buildV2SummarizePrompt(reconstruction);
          break;
        default:
          prompt = buildV2HintPrompt(reconstruction);
      }

      // Reuse geminiCoach's raw Gemini call by wrapping in a compatible context
      const guidance = await coachRequest("hint", {
        scenarioId: reconstruction.datasetId,
        scenarioTitle: reconstruction.attackStory.summary.slice(0, 80),
        attackType: reconstruction.attackStory.stages[0]?.name ?? "Unknown",
        difficulty: "Advanced",
        investigationSummary: prompt,
      }, process.env.GEMINI_API_KEY);

      return NextResponse.json({ guidance, source: "gemini" });
    } catch (err) {
      const reason = err instanceof GeminiRateLimitError ? "rate-limited"
        : err instanceof GeminiAPIError ? `API error ${err.statusCode}`
        : err instanceof Error ? err.message : "unknown";
      console.warn(`[V2 Explain] Gemini unavailable (${reason}). Using offline mentor.`);
    }
  }

  // ── Offline fallback ───────────────────────────────────────────────────────
  const guidance = offlineV2Response(act, reconstruction);
  return NextResponse.json({ guidance, source: "offline" });
}
