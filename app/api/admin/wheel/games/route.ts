import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import type { WheelGameDoc } from "@/lib/wheelIngest";

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  const presetRaw = (url.searchParams.get("preset") ?? "").trim();

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
  const wheelGames = db.collection<WheelGameDoc & { _id?: unknown }>("wheel_games");

  const filter: Record<string, unknown> = { uploaderId: gate.auth.id };
  if (fromDate || toDate) {
    filter.archivedAt = {
      ...(fromDate ? { $gte: Math.floor(fromDate.getTime() / 1000) } : {}),
      ...(toDate ? { $lte: Math.floor(toDate.getTime() / 1000) } : {}),
    };
  }
  if (presetRaw) filter.preset = presetRaw;

  const rows = await wheelGames
    .find(filter, {
      projection: {
        gameUuid: 1,
        playerName: 1,
        playerHomeworld: 1,
        archivedAt: 1,
        preset: 1,
        presetVersion: 1,
        maxSpins: 1,
        spinsUsed: 1,
        spinsPaid: 1,
        spinCost: 1,
        prizesWon: 1,
        live: 1,
      },
    })
    .sort({ archivedAt: -1, _id: -1 })
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
      gameUuid: game.gameUuid,
      playerName: game.playerName,
      playerHomeworld: game.playerHomeworld ?? null,
      archivedAt: new Date((Number(game.archivedAt) || 0) * 1000).toISOString(),
      preset: game.preset ?? null,
      presetVersion: typeof game.presetVersion === "number" ? game.presetVersion : null,
      maxSpins: Number(game.maxSpins) || 0,
      spinsUsed: typeof game.spinsUsed === "number" ? game.spinsUsed : null,
      spinsPaid: typeof game.spinsPaid === "number" ? game.spinsPaid : null,
      spinCost: Number(game.spinCost) || 0,
      prizes: Array.isArray(game.prizesWon) ? game.prizesWon : [],
      live: Boolean(game.live),
    })),
  });
}
