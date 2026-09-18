import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { ingestWheelPresets, parseWheelPresetUpload } from "@/lib/wheelPresets";

/**
 * SimpleWheel preset upload used by the SimpleStats plugin.
 *
 * One envelope object with the uploading character, a timestamp and the
 * full preset list. Presets are stored per API-key account and versioned
 * by content; nothing is ever deleted, so a preset that stops being
 * uploaded simply keeps its last known version.
 */
export async function POST(req: Request) {
  await ensureGameCollections();

  const gate = await requireUserRequest(req);
  if (!gate.ok) return gate.res;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseWheelPresetUpload(body);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  if (parsed.upload.presets.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid presets in payload", skipped: parsed.skipped }, { status: 400 });
  }

  const db = await getDb();
  const result = await ingestWheelPresets({
    db,
    uploaderId: gate.auth.id,
    upload: parsed.upload,
  });

  return NextResponse.json({
    ok: true,
    created: result.created,
    versioned: result.versioned,
    unchanged: result.unchanged,
    skipped: parsed.skipped,
    linkedGames: result.linkedGames,
    count: parsed.upload.presets.length,
  });
}
