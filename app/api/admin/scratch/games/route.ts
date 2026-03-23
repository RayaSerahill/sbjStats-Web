import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type ScratchGameDoc = {
  _id?: any;
  uploaderId: string;
  playerName: string;
  archivedAt: number; // unix seconds
  totalCards: number;
  wins: number;
  prizesWon: string[];
};

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") || 1);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
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
  const scratchGames = db.collection<ScratchGameDoc>("scratch_games");

  const filter: Record<string, unknown> = { uploaderId: gate.auth.id };
  if (fromDate || toDate) {
    filter.archivedAt = {
      ...(fromDate ? { $gte: Math.floor(fromDate.getTime() / 1000) } : {}),
      ...(toDate ? { $lte: Math.floor(toDate.getTime() / 1000) } : {}),
    };
  }

  const rows = await scratchGames
    .find(filter, { projection: { playerName: 1, archivedAt: 1, totalCards: 1, wins: 1, prizesWon: 1 } })
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
      id: game._id?.toString?.() ?? "",
      playerName: game.playerName,
      archivedAt: new Date((Number(game.archivedAt) || 0) * 1000).toISOString(),
      totalCards: Number(game.totalCards) || 0,
      wins: Number(game.wins) || 0,
      prizes: Array.isArray(game.prizesWon) ? game.prizesWon.length : 0,
    })),
  });
}
