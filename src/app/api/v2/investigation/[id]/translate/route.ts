/**
 * POST /api/v2/investigation/:id/translate
 *
 * Translates explanation text to a supported language.
 * Gemini-powered with English fallback.
 * NEVER translates MITRE IDs, IPs, hashes, domains, or timestamps.
 */

import { NextRequest, NextResponse } from "next/server";
import { localizeExplanation, LocalizationContext } from "@/lib/v2/explanationLocalization";
import { SupportedLanguage, SUPPORTED_LANGUAGES } from "@/types/v2";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing investigation ID." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const { text, language, context } = (body ?? {}) as Record<string, unknown>;

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing required field: text" }, { status: 400 });
  }

  const validLanguages = Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[];
  if (typeof language !== "string" || !validLanguages.includes(language as SupportedLanguage)) {
    return NextResponse.json(
      { error: `Invalid language. Supported: ${validLanguages.join(", ")}` },
      { status: 400 }
    );
  }

  const validContexts: LocalizationContext[] = ["summary", "stage", "mitre", "ioc", "recommendation", "mentor", "general"];
  const ctx: LocalizationContext = (typeof context === "string" && validContexts.includes(context as LocalizationContext))
    ? (context as LocalizationContext)
    : "general";

  const result = await localizeExplanation(
    text,
    language as SupportedLanguage,
    ctx,
    process.env.GEMINI_API_KEY
  );

  return NextResponse.json({
    translated: result.translated,
    language: result.language,
    usedFallback: result.usedFallback,
    languageLabel: SUPPORTED_LANGUAGES[result.language],
  });
}
