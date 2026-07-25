/**
 * geminiCoach.ts
 *
 * Gemini-powered DFIR Investigation Coach.
 * Server-side only — never expose to frontend.
 */

export type CoachActionType = "hint" | "explain-evidence" | "next-step" | "explain-mistakes";

interface CoachContext {
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
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Senior Digital Forensics and Incident Response (DFIR) mentor coaching students through realistic cyber incident investigations.

Your role:
- Guide students to discover answers through investigative thinking
- Ask probing questions that lead to insights
- Explain forensic concepts and MITRE ATT&CK techniques
- Teach correlation between evidence items
- Encourage systematic investigation methodology

Critical rules:
- NEVER reveal the correct timeline order
- NEVER reveal which evidence items are missing from their timeline
- NEVER say "the answer is..." or "you should place X before Y"
- NEVER solve the investigation for them
- ALWAYS encourage discovery through guided questions
- ALWAYS explain WHY certain evidence matters forensically
- ALWAYS reference MITRE ATT&CK tactics/techniques when relevant

Your tone: Professional, educational, encouraging. You are a mentor, not ChatGPT.`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildHintPrompt(ctx: CoachContext): string {
  const timelineCount = ctx.currentTimeline?.length ?? 0;
  const reviewedCount = ctx.reviewedEvidence?.length ?? 0;

  return `${SYSTEM_PROMPT}

SCENARIO: ${ctx.scenarioTitle} (${ctx.attackType}, ${ctx.difficulty})

STUDENT PROGRESS:
- Timeline events placed: ${timelineCount}
- Evidence items reviewed: ${reviewedCount}

The student is asking for a hint. Provide guidance without revealing answers.

Your response should:
1. Ask an investigative question that directs their attention to a key forensic concept
2. Suggest WHICH TYPE of evidence to look for (e.g., "look for signs of persistence mechanisms")
3. Explain WHY that type of evidence matters in ${ctx.attackType} attacks
4. Encourage them to correlate evidence they've already seen

Keep your response under 150 words. Be specific but never reveal the solution.`;
}

function buildExplainEvidencePrompt(ctx: CoachContext): string {
  return `${SYSTEM_PROMPT}

SCENARIO: ${ctx.scenarioTitle} (${ctx.attackType})

EVIDENCE ITEM:
Title: ${ctx.selectedEvidenceTitle}
Details: ${ctx.selectedEvidenceDetails}

The student wants to understand this evidence item.

Your response should:
1. Explain what this evidence represents in forensic terms
2. Describe what attacker behavior this indicates
3. Identify which MITRE ATT&CK tactic/technique this typically maps to
4. Suggest what OTHER types of evidence to look for that correlate with this
5. Explain how this fits into the broader ${ctx.attackType} attack chain

Do NOT reveal:
- Where this should be placed in the timeline
- Which specific evidence items come before or after this
- Whether this evidence is critical or optional

Keep response under 200 words. Focus on teaching forensic analysis.`;
}

function buildNextStepPrompt(ctx: CoachContext): string {
  const timelineCount = ctx.currentTimeline?.length ?? 0;
  const reviewedCount = ctx.reviewedEvidence?.length ?? 0;

  // Build timeline summary
  let timelineText = "No events in timeline yet.";
  if (ctx.currentTimeline && ctx.currentTimeline.length > 0) {
    timelineText = ctx.currentTimeline
      .map((ev, i) => `${i + 1}. ${ev.title}`)
      .join("\n");
  }

  // Build reviewed evidence summary
  let reviewedText = "No evidence reviewed yet.";
  if (ctx.reviewedEvidence && ctx.reviewedEvidence.length > 0) {
    reviewedText = ctx.reviewedEvidence
      .map((ev) => `- ${ev.title} (${ev.mitreTactic})`)
      .slice(0, 10)
      .join("\n");
  }

  return `${SYSTEM_PROMPT}

SCENARIO: ${ctx.scenarioTitle} (${ctx.attackType}, ${ctx.difficulty})

CURRENT TIMELINE:
${timelineText}

EVIDENCE REVIEWED:
${reviewedText}

Total timeline events: ${timelineCount}
Total evidence reviewed: ${reviewedCount}

The student is asking: "What should I investigate next?"

Your response should:
1. Analyze what types of evidence they've reviewed
2. Identify which MITRE tactics are covered vs not covered
3. Suggest a DIRECTION to investigate (e.g., "look for signs of lateral movement" or "search for persistence mechanisms")
4. Ask a question that helps them think about attack progression
5. Encourage correlation between evidence they've already seen

Do NOT:
- Reveal specific evidence items they haven't found
- Tell them the correct timeline order
- Solve the investigation for them

Keep response under 200 words.`;
}

function buildExplainMistakesPrompt(ctx: CoachContext): string {
  const missedText = ctx.missedEvents?.join(", ") ?? "none identified";

  return `${SYSTEM_PROMPT}

SCENARIO: ${ctx.scenarioTitle} (${ctx.attackType})

INVESTIGATION RESULTS:
Timeline Accuracy: ${ctx.timelineAccuracy ?? 0}%
MITRE Coverage: ${ctx.mitreScore ?? 0}%

Analysis Summary:
${ctx.investigationSummary}

Missed Events (general categories):
${missedText}

The student has completed their investigation and wants to understand their mistakes.

Your response should:
1. Explain forensic concepts they may have missed (without revealing the exact timeline)
2. Describe why certain MITRE tactics are critical in ${ctx.attackType} attacks
3. Teach attack chain progression (Initial Access → Execution → Persistence → etc.)
4. Suggest what to study or practice next
5. Encourage them with positive reinforcement for what they DID find

Do NOT:
- Provide the correct timeline order
- List every missed evidence item
- Make them feel bad about mistakes

Your tone should be educational and encouraging. This is a learning opportunity.
Keep response under 250 words.`;
}

// ─── Custom error types ───────────────────────────────────────────────────────

export class GeminiRateLimitError extends Error {
  constructor(retryAfterSeconds?: number) {
    super(
      retryAfterSeconds
        ? `Gemini API rate limit hit. Retry after ${retryAfterSeconds}s.`
        : "Gemini API rate limit hit."
    );
    this.name = "GeminiRateLimitError";
  }
}

export class GeminiAPIError extends Error {
  constructor(public statusCode: number, message: string) {
    super(`Gemini API error ${statusCode}: ${message}`);
    this.name = "GeminiAPIError";
  }
}

// ─── Gemini API Call (single attempt) ────────────────────────────────────────

interface GeminiAttemptResult {
  text: string;
  rateLimited: false;
}
interface GeminiRateLimitResult {
  rateLimited: true;
  retryAfterSeconds: number;
}
type GeminiAttempt = GeminiAttemptResult | GeminiRateLimitResult;

async function attemptGeminiAPI(prompt: string, apiKey: string): Promise<GeminiAttempt> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 256,
    },
  });

  // Use Node's https module directly — avoids undici IPv6 timeout issues
  const https = await import("https");

  const { statusCode, responseText, retryAfter } = await new Promise<{
    statusCode: number;
    responseText: string;
    retryAfter: number | null;
  }>((resolve, reject) => {
    const req = https.request(
      "https://generativelanguage.googleapis.com",
      {
        method: "POST",
        path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        family: 4, // force IPv4
        timeout: 30000,
        // Allow self-signed/intercepted certs (corporate proxies)
        rejectUnauthorized: false,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const retryAfterHeader = res.headers["retry-after"];
          const retryAfter = retryAfterHeader ? parseInt(String(retryAfterHeader), 10) : null;
          resolve({
            statusCode: res.statusCode ?? 0,
            responseText: data,
            retryAfter: isNaN(retryAfter ?? NaN) ? null : retryAfter,
          });
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Gemini API request timed out"));
    });
    req.write(body);
    req.end();
  });

  // Rate limited — caller decides whether to retry
  if (statusCode === 429) {
    console.warn("[Gemini API] 429 response body:", responseText.slice(0, 300));
    return { rateLimited: true, retryAfterSeconds: retryAfter ?? 15 };
  }

  if (statusCode >= 400) {
    console.error("[Gemini API] Error response:", responseText);
    throw new GeminiAPIError(statusCode, responseText.slice(0, 200));
  }

  const data = JSON.parse(responseText);

  if (!data.candidates || data.candidates.length === 0) {
    throw new GeminiAPIError(200, "No candidates returned");
  }

  const text = data.candidates[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiAPIError(200, "Empty text in response");
  }

  return { rateLimited: false, text: text.trim() };
}

// ─── Gemini API Call with retry ───────────────────────────────────────────────

const MAX_RETRIES = 1; // fail fast — offline fallback handles the rest
const BASE_BACKOFF_MS = 1000; // 1s base

async function callGeminiAPI(prompt: string, apiKey: string): Promise<string> {
  let lastRetryAfter = BASE_BACKOFF_MS / 1000;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await attemptGeminiAPI(prompt, apiKey);

    if (!result.rateLimited) {
      return result.text;
    }

    lastRetryAfter = result.retryAfterSeconds;
    console.warn(
      `[Gemini API] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}). ` +
        `Waiting ${lastRetryAfter}s before retry...`
    );

    if (attempt < MAX_RETRIES) {
      // Exponential backoff: respect Retry-After header, but cap at 3s so offline fallback is fast
      const waitMs = Math.min(
        Math.max(lastRetryAfter * 1000, BASE_BACKOFF_MS * Math.pow(2, attempt)),
        3000
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // All retries exhausted
  throw new GeminiRateLimitError(lastRetryAfter);
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function coachRequest(
  action: CoachActionType,
  context: CoachContext,
  apiKey: string
): Promise<string> {
  let prompt: string;

  switch (action) {
    case "hint":
      prompt = buildHintPrompt(context);
      break;
    case "explain-evidence":
      prompt = buildExplainEvidencePrompt(context);
      break;
    case "next-step":
      prompt = buildNextStepPrompt(context);
      break;
    case "explain-mistakes":
      prompt = buildExplainMistakesPrompt(context);
      break;
    default:
      throw new Error(`Unknown action type: ${action}`);
  }

  return await callGeminiAPI(prompt, apiKey);
}
