import { NextRequest, NextResponse } from "next/server";
import { coachRequest, CoachActionType, GeminiRateLimitError } from "@/lib/geminiCoach";
import { offlineCoachRequest, OfflineCoachContext } from "@/lib/offlineCoach";

// ─── Request Schema ───────────────────────────────────────────────────────────

interface CoachRequestBody {
  action: CoachActionType;
  context: OfflineCoachContext;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRequest(body: unknown): body is CoachRequestBody {
  if (!body || typeof body !== "object") return false;
  const req = body as Record<string, unknown>;

  if (typeof req.action !== "string") return false;
  if (!["hint", "explain-evidence", "next-step", "explain-mistakes"].includes(req.action)) return false;
  if (!req.context || typeof req.context !== "object") return false;

  const ctx = req.context as Record<string, unknown>;
  if (typeof ctx.scenarioId !== "string" || !ctx.scenarioId) return false;
  if (typeof ctx.scenarioTitle !== "string" || !ctx.scenarioTitle) return false;

  return true;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  // Validate
  if (!validateRequest(body)) {
    return NextResponse.json(
      { error: "Invalid request payload. Missing required fields or invalid action type." },
      { status: 400 }
    );
  }

  const { action, context } = body;

  // ── Try Gemini first ──────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const guidance = await coachRequest(action, context, process.env.GEMINI_API_KEY);
      return NextResponse.json({ guidance, source: "gemini" });
    } catch (err) {
      // Log the failure but do NOT surface it to the client — fall through to offline
      const reason =
        err instanceof GeminiRateLimitError
          ? "rate-limited"
          : err instanceof Error
          ? err.message
          : "unknown";
      console.warn(`[Coach API] Gemini unavailable (${reason}). Falling back to offline mentor.`);
    }
  } else {
    console.warn("[Coach API] GEMINI_API_KEY not set. Using offline mentor.");
  }

  // ── Offline fallback — always succeeds ────────────────────────────────────
  try {
    const guidance = offlineCoachRequest(action, context);
    return NextResponse.json({ guidance, source: "offline" });
  } catch (err) {
    // This should never happen, but handle it gracefully
    console.error("[Coach API] Offline coach error:", err);
    return NextResponse.json(
      { error: "Mentor is temporarily unavailable. Please try again." },
      { status: 500 }
    );
  }
}

// Only POST is allowed
export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
