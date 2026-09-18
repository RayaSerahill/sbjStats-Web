import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { ingestWheelGames, parseWheelUploadBody, upsertFormattedGilWheelPrizeValues } from "@/lib/wheelIngest";

/**
 * SimpleWheel upload endpoint used by the SimpleStats plugin.
 *
 * Body is either one record (live, fired on a game's last spin) or an
 * array of records (archive snapshot). Unknown fields are ignored; rows
 * that do not look like a wheel game are skipped and counted rather than
 * failing the whole upload. Error bodies stay short because the plugin
 * shows them to the dealer verbatim in a toast.
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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Expected a wheel game or an array of them" }, { status: 400 });
  }

  const { games, skipped, total } = parseWheelUploadBody(body);

  if (games.length === 0) {
    const error = total === 0 ? "Nothing to import" : "No valid wheel games in payload";
    return NextResponse.json({ ok: false, error, skipped }, { status: 400 });
  }

  const db = await getDb();
  const result = await ingestWheelGames({
    db,
    uploaderId: gate.auth.id,
    games,
  });
  const autoValues = await upsertFormattedGilWheelPrizeValues({
    db,
    uploaderId: gate.auth.id,
    games,
  });

  return NextResponse.json({
    ok: true,
    imported: result.inserted,
    updated: result.updated,
    skipped,
    autoValuedPrizes: autoValues.inserted + autoValues.updated,
    count: total,
  });
}
