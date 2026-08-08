/**
 * GET /api/v2/investigation/:id
 *
 * Returns a previously reconstructed investigation by datasetId.
 */

import { NextRequest, NextResponse } from "next/server";
import { getInvestigation } from "@/lib/v2/investigationStore";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing investigation ID." }, { status: 400 });
  }

  const result = getInvestigation(id);

  if (!result) {
    return NextResponse.json(
      { error: `Investigation ${id} not found. It may have expired — please re-upload your dataset.` },
      { status: 404 }
    );
  }

  return NextResponse.json({ reconstruction: result });
}
