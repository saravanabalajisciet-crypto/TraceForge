/**
 * POST /api/v2/events/ingest
 *
 * Accepts a raw event dataset string, runs ingestion + normalization,
 * returns IngestionResult + DatasetOverview without running full reconstruction.
 * Lets the UI show a preview before committing to full reconstruction.
 */

import { NextRequest, NextResponse } from "next/server";
import { ingestEvents, buildDatasetOverview } from "@/lib/v2/eventIngestion";
import { IngestionFormat } from "@/types/v2";

const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(request: NextRequest) {
  try {
    // Parse body
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

    // Size guard
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

    const result = ingestEvents(data, fmt);
    const overview = buildDatasetOverview(
      result,
      typeof fileName === "string" ? fileName : "dataset.json",
      typeof fileSizeBytes === "number" ? fileSizeBytes : byteLen,
      fmt ?? "json"
    );

    return NextResponse.json({ ingestion: result, overview });
  } catch (err) {
    console.error("[/api/v2/events/ingest]", err);
    return NextResponse.json(
      { error: "Ingestion failed. Please check your dataset format." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed." }, { status: 405 });
}
