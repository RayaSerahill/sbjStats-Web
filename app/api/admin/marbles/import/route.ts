import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { ingestMarblesGames, parseMarblesUploadBody } from "@/lib/marblesIngest";

/**
 * SimpleMarbles upload endpoint used by the SimpleStats plugin.
 *
 * Body is the archive array from SimpleMarbles' GetArchiveIPC, one summary
 * row per game, sent in chunks. A row may carry the game's full detail under
 * `detail`, which is stored and turned into per-player results. Unknown fields are ignored; rows that do not look like a
 * marbles game are skipped and counted rather than failing the whole upload.
 * Live RaceEnded uploads are not handled yet and are rejected as invalid.
 * Error bodies stay short because the plugin shows them to the dealer
 * verbatim in a toast.
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
    return NextResponse.json({ ok: false, error: "Expected an array of marbles games" }, { status: 400 });
  }

  const { games, skipped, total } = parseMarblesUploadBody(body);

  if (games.length === 0) {
    const error = total === 0 ? "Nothing to import" : "No valid marbles games in payload";
    return NextResponse.json({ ok: false, error, skipped }, { status: 400 });
  }

  const db = await getDb();
  const result = await ingestMarblesGames({
    db,
    uploaderId: gate.auth.id,
    games,
  });

  return NextResponse.json({
    ok: true,
    imported: result.inserted,
    updated: result.updated,
    players: result.players,
    skipped,
    count: total,
  });
}
