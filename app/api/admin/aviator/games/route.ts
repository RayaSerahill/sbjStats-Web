import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type AviatorGameRow = {
  _id?: { toString?: () => string };
  archivedAt?: number;
  gameId?: string;
  theme?: string;
  startedAt?: Date;
  finalStatus?: string;
  dealerName?: string;
  dealerHomeworld?: string;
  totalRounds?: number;
  totalPlayers?: number;
  totalBets?: number;
  totalPayouts?: number;
  totalAdjustments?: number;
  dealerProfit?: number;
  playerWins?: number;
  playerLosses?: number;
  cashouts?: number;
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
  const filter: Record<string, unknown> = { uploaderId: gate.auth.id };
  if (fromDate || toDate) {
    filter.archivedAt = {
      ...(fromDate ? { $gte: Math.floor(fromDate.getTime() / 1000) } : {}),
      ...(toDate ? { $lte: Math.floor(toDate.getTime() / 1000) } : {}),
    };
  }

  const db = await getDb();
  const aviatorGames = db.collection<AviatorGameRow>("aviator_games");
  const rows = await aviatorGames
    .find(filter, {
      projection: {
        archivedAt: 1,
        gameId: 1,
        theme: 1,
        startedAt: 1,
        finalStatus: 1,
        dealerName: 1,
        dealerHomeworld: 1,
        totalRounds: 1,
        totalPlayers: 1,
        totalBets: 1,
        totalPayouts: 1,
        totalAdjustments: 1,
        dealerProfit: 1,
        playerWins: 1,
        playerLosses: 1,
        cashouts: 1,
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
      id: game._id?.toString?.() ?? "",
      archivedAt: new Date((Number(game.archivedAt) || 0) * 1000).toISOString(),
      gameId: game.gameId ?? "",
      theme: game.theme ?? "",
      startedAt: game.startedAt ?? null,
      finalStatus: game.finalStatus ?? "",
      dealerName: game.dealerName ?? "",
      dealerHomeworld: game.dealerHomeworld ?? "",
      totalRounds: Number(game.totalRounds) || 0,
      totalPlayers: Number(game.totalPlayers) || 0,
      totalBets: Number(game.totalBets) || 0,
      totalPayouts: Number(game.totalPayouts) || 0,
      totalAdjustments: Number(game.totalAdjustments) || 0,
      dealerProfit: Number(game.dealerProfit) || 0,
      playerWins: Number(game.playerWins) || 0,
      playerLosses: Number(game.playerLosses) || 0,
      cashouts: Number(game.cashouts) || 0,
    })),
  });
}
