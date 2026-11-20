import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import type { MarblesGameDoc } from "@/lib/marblesIngest";

const toIso = (unixSeconds: unknown) =>
  typeof unixSeconds === "number" ? new Date(unixSeconds * 1000).toISOString() : null;

/**
 * The signed-in dealer's uploaded marbles games, newest first. `?mine=1` hides
 * other dealers' games; `?from=` and `?to=` bound the game's start time.
 */
export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const mineOnly = ["1", "true"].includes((url.searchParams.get("mine") ?? "").toLowerCase());
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  const fromDate = fromRaw ? new Date(fromRaw) : null;
  const toDate = toRaw ? new Date(toRaw) : null;

  if (fromRaw && (!fromDate || Number.isNaN(fromDate.getTime()))) {
    return NextResponse.json({ error: "Invalid from date" }, { status: 400 });
  }

  if (toRaw && (!toDate || Number.isNaN(toDate.getTime()))) {
    return NextResponse.json({ error: "Invalid to date" }, { status: 400 });
  }

  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    return NextResponse.json({ error: "From date must be before to date" }, { status: 400 });
  }

  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const db = await getDb();
  const marblesGames = db.collection<MarblesGameDoc & { _id?: unknown }>("marbles_games");

  const filter: Record<string, unknown> = { uploaderId: gate.auth.id };
  if (mineOnly) filter.mine = true;
  if (fromDate || toDate) {
    filter.startedAt = {
      ...(fromDate ? { $gte: Math.floor(fromDate.getTime() / 1000) } : {}),
      ...(toDate ? { $lte: Math.floor(toDate.getTime() / 1000) } : {}),
    };
  }

  const rows = await marblesGames
    .find(filter, { projection: { detail: 0 } })
    .sort({ startedAt: -1, _id: -1 })
    .skip(skip)
    .limit(pageSize + 1)
    .toArray();

  const hasMore = rows.length > pageSize;
  const visible = hasMore ? rows.slice(0, pageSize) : rows;

  return NextResponse.json({
    ok: true,
    page,
    pageSize,
    hasMore,
    games: visible.map((game) => ({
      id: String(game._id ?? ""),
      gameId: game.gameId,
      status: game.status,
      startedAt: toIso(game.startedAt),
      endedAt: toIso(game.endedAt),
      theme: game.theme ?? null,
      trackThemeName: game.trackThemeName ?? null,
      totalRaces: Number(game.totalRaces) || 0,
      totalPlayers: Number(game.totalPlayers) || 0,
      totalTaken: Number(game.totalTaken) || 0,
      totalPayouts: Number(game.totalPayouts) || 0,
      totalVenueCut: Number(game.totalVenueCut) || 0,
      totalBoost: Number(game.totalBoost) || 0,
      tournament: Boolean(game.tournament),
      tournamentFormat: game.tournamentFormat ?? null,
      creatorName: game.creatorName ?? null,
      creatorWorld: game.creatorWorld ?? null,
      mine: Boolean(game.mine),
      hasDetail: game.detailUpdatedAt != null,
    })),
  });
}
