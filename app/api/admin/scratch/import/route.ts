import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import {
  isScratchArchivePayload,
  isScratchSummaryPayload,
  normalizeScratchPayload,
  ingestScratchGames,
} from "@/lib/scratchIngest";

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

  const payload = Array.isArray(body) ? body : [body];

  for (const item of payload) {
    if (!isScratchArchivePayload(item) && !isScratchSummaryPayload(item)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
  }

  const normalizedGames = payload.map((item) => normalizeScratchPayload(item));
  const db = await getDb();
  const result = await ingestScratchGames({
    db,
    uploaderId: gate.auth.id,
    games: normalizedGames,
  });

  return NextResponse.json({
    ok: true,
    inserted: result.inserted,
    updated: result.updated,
    count: normalizedGames.length,
  });
}
