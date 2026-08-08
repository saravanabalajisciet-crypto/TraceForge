/**
 * explanationLocalization.ts
 *
 * Phase 11 — Explanation Localization Engine
 *
 * Translates investigation explanation text to Tamil, Hindi, or Malayalam.
 * English is always returned as-is.
 *
 * Architecture:
 *   English text → Gemini translation prompt → translated text
 *   If Gemini fails → return English with inline note
 *
 * Hard rules (never broken):
 *   - NEVER translate: MITRE IDs, IPs, hashes, domains, timestamps, event IDs
 *   - NEVER invent technical facts
 *   - Only the explanation wrapper changes — underlying data is unchanged
 *   - If translation unavailable: return English + "[Translation unavailable — showing English]"
 */

import { SupportedLanguage, SUPPORTED_LANGUAGES } from "@/types/v2";

// ─── Context types ────────────────────────────────────────────────────────────

export type LocalizationContext =
  | "summary"
  | "stage"
  | "mitre"
  | "ioc"
  | "recommendation"
  | "mentor"
  | "general";

// ─── Technical token protection ───────────────────────────────────────────────

/**
 * Patterns that must never be translated.
 * These are replaced with placeholders before sending to Gemini,
 * then restored after translation.
 */
const PROTECTED_PATTERNS: Array<{ pattern: RegExp; prefix: string }> = [
  { pattern: /\bT\d{4}(?:\.\d{3})?\b/g, prefix: "MITRE_TECH" },         // T1059.001
  { pattern: /\bTA\d{4}\b/g, prefix: "MITRE_TACTIC" },                    // TA0002
  { pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, prefix: "IPv4" },           // 192.168.1.1
  { pattern: /\b[a-fA-F0-9]{32}\b/g, prefix: "MD5" },                    // MD5 hash
  { pattern: /\b[a-fA-F0-9]{40}\b/g, prefix: "SHA1" },                   // SHA1 hash
  { pattern: /\b[a-fA-F0-9]{64}\b/g, prefix: "SHA256" },                 // SHA256 hash
  { pattern: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, prefix: "TIMESTAMP" }, // ISO timestamp
  { pattern: /[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, prefix: "DOMAIN" }, // domain names
];

interface ProtectResult {
  protected: string;
  tokenMap: Map<string, string>;
}

function protectTechnicalTokens(text: string): ProtectResult {
  const tokenMap = new Map<string, string>();
  let counter = 0;
  let result = text;

  for (const { pattern, prefix } of PROTECTED_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Check if already replaced
      if (match.startsWith("__TOKEN_")) return match;
      const token = `__TOKEN_${prefix}_${counter++}__`;
      tokenMap.set(token, match);
      return token;
    });
  }

  return { protected: result, tokenMap };
}

function restoreProtectedTokens(text: string, tokenMap: Map<string, string>): string {
  let result = text;
  for (const [token, original] of tokenMap) {
    result = result.split(token).join(original);
  }
  return result;
}

// ─── Fallback strings ─────────────────────────────────────────────────────────

const FALLBACK_NOTE: Record<SupportedLanguage, string> = {
  en: "",
  ta: "[மொழிபெயர்ப்பு கிடைக்கவில்லை — ஆங்கிலத்தில் காட்டப்படுகிறது]",
  hi: "[अनुवाद उपलब्ध नहीं — अंग्रेज़ी में दिखाया जा रहा है]",
  ml: "[വിവർത്തനം ലഭ്യമല്ല — ഇംഗ്ലീഷിൽ കാണിക്കുന്നു]",
};

// ─── Gemini Translation Prompt ────────────────────────────────────────────────

function buildTranslationPrompt(
  text: string,
  targetLang: SupportedLanguage,
  context: LocalizationContext
): string {
  const langName = SUPPORTED_LANGUAGES[targetLang];

  const contextHint: Record<LocalizationContext, string> = {
    summary: "a cybersecurity incident summary",
    stage: "an attack stage description in a DFIR investigation",
    mitre: "a MITRE ATT&CK technique explanation",
    ioc: "an indicator of compromise description",
    recommendation: "a security recommendation",
    mentor: "guidance from a cybersecurity mentor",
    general: "a cybersecurity explanation",
  };

  return `You are a professional technical translator specializing in cybersecurity.

Translate the following text from English to ${langName} (${targetLang}).

Context: This is ${contextHint[context]}.

Critical rules:
1. Translate ONLY the natural language explanation — do NOT translate tokens like __TOKEN_*__
2. Preserve all __TOKEN_*__ placeholders exactly as-is
3. Maintain professional, technical tone appropriate for security analysts
4. Do NOT add any commentary or notes
5. Do NOT change the meaning or add information
6. Return ONLY the translated text — no preamble

Text to translate:
${text}`;
}

// ─── Main Translation Function ────────────────────────────────────────────────

export async function localizeExplanation(
  text: string,
  language: SupportedLanguage,
  context: LocalizationContext = "general",
  apiKey?: string
): Promise<{ translated: string; language: SupportedLanguage; usedFallback: boolean }> {
  // English — return as-is
  if (language === "en" || !text.trim()) {
    return { translated: text, language: "en", usedFallback: false };
  }

  // No API key → return English with note
  if (!apiKey) {
    return {
      translated: text + "\n\n" + FALLBACK_NOTE[language],
      language,
      usedFallback: true,
    };
  }

  try {
    // Protect technical tokens
    const { protected: protectedText, tokenMap } = protectTechnicalTokens(text);

    // Build prompt
    const prompt = buildTranslationPrompt(protectedText, language, context);

    // Call Gemini via Node https (same pattern as geminiCoach.ts)
    const https = await import("https");
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2, // low temp for translation accuracy
        topK: 20,
        topP: 0.90,
        maxOutputTokens: 512,
      },
    });

    const responseText = await new Promise<string>((resolve, reject) => {
      const req = https.request(
        "https://generativelanguage.googleapis.com",
        {
          method: "POST",
          path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
          family: 4,
          timeout: 15000,
          rejectUnauthorized: false,
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Gemini translation failed: ${res.statusCode}`));
            } else {
              resolve(data);
            }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Translation timeout")); });
      req.write(body);
      req.end();
    });

    const data = JSON.parse(responseText);
    const rawTranslated = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawTranslated) throw new Error("Empty translation response");

    // Restore protected tokens
    const restored = restoreProtectedTokens(rawTranslated.trim(), tokenMap);

    return { translated: restored, language, usedFallback: false };

  } catch (err) {
    console.warn(`[Localization] Translation to ${language} failed:`, err instanceof Error ? err.message : err);
    return {
      translated: text + "\n\n" + FALLBACK_NOTE[language],
      language,
      usedFallback: true,
    };
  }
}

// ─── Batch translation ────────────────────────────────────────────────────────

export interface TranslationBatch {
  key: string;
  text: string;
  context: LocalizationContext;
}

export interface TranslationBatchResult {
  key: string;
  translated: string;
  usedFallback: boolean;
}

/**
 * Translate multiple strings in sequence.
 * Stops retrying individual items on failure — returns fallback per item.
 */
export async function localizeBatch(
  items: TranslationBatch[],
  language: SupportedLanguage,
  apiKey?: string
): Promise<TranslationBatchResult[]> {
  if (language === "en") {
    return items.map((item) => ({ key: item.key, translated: item.text, usedFallback: false }));
  }

  const results: TranslationBatchResult[] = [];

  for (const item of items) {
    const result = await localizeExplanation(item.text, language, item.context, apiKey);
    results.push({ key: item.key, translated: result.translated, usedFallback: result.usedFallback });
  }

  return results;
}
