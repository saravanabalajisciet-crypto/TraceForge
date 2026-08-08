/**
 * POST /api/v2/investigation/reconstruct
 *
 * Runs the full reconstruction pipeline on a raw event dataset.
 * Stores the result in the in-memory investigation store.
 * Returns the complete ReconstructionResult.
 */

import { NextRequest, NextResponse } from "next/server";
import { runReconstructionPipeline } from "@/lib/v2/reconstructionPipeline";
import { saveInvestigation } from "@/lib/v2/investigationStore";
import { IngestionFormat } from "@/types/v2";

const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
    }

    const { data, format, fileName, fileSizeBytes } = body as Record<string, unknown>;

    if (typeof data !== "string" || !data.trim()) {
      return NextResponse.json({ error: "Missing required field: data (string)." }, { status: 400 });
    }

    const byteLen = Buffer.byteLength(data, "utf8");
    if (byteLen > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: `Dataset too large (${Math.round(byteLen / 1024)}KB). Maximum is 5MB.` },
        { status: 413 }
      );
    }

    const validFormats: IngestionFormat[] = ["json", "ndjson", "csv"];
    const fmt: IngestionFormat | undefined =
      typeof format === "string" && validFormats.includes(format as IngestionFormat)
        ? (format as IngestionFormat)
        : undefined;

    const result = runReconstructionPipeline({
      rawData: data,
      format: fmt,
      fileName: typeof fileName === "string" ? fileName : undefined,
      fileSizeBytes: typeof fileSizeBytes === "number" ? fileSizeBytes : byteLen,
    });

    // Persist for later retrieval
    saveInvestigation(result.reconstruction);

    return NextResponse.json({
      datasetId: result.reconstruction.datasetId,
      reconstruction: result.reconstruction,
      overview: result.overview,
      warnings: {
        ingestion: result.ingestionWarnings,
        normalization: result.normalizationWarnings,
      },
    });
  } catch (err) {
    console.error("[/api/v2/investigation/reconstruct]", err);
    const message = err instanceof Error ? err.message : "Reconstruction failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
