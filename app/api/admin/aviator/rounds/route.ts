import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type AviatorRoundRow = {
  _id?: { toString?: () => string };
  uploadType?: string;
  archivedAt?: number;
  dealer?: string;
  dealerHomeworld?: string;
  gameId?: string;
  roundNumber?: number;
  crashPoint?: number;
  playerCount?: number;
  totalBets?: number;
  totalPayouts?: number;
  dealerProfit?: number;
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
  const aviatorRounds = db.collection<AviatorRoundRow>("aviator_rounds");
  const rows = await aviatorRounds
    .find(filter, {
      projection: {
        uploadType: 1,
        archivedAt: 1,
        dealer: 1,
        dealerHomeworld: 1,
        gameId: 1,
        roundNumber: 1,
        crashPoint: 1,
        playerCount: 1,
        totalBets: 1,
        totalPayouts: 1,
        dealerProfit: 1,
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
    rounds: visible.map((round) => ({
      id: round._id?.toString?.() ?? "",
      uploadType: round.uploadType ?? "",
      archivedAt: new Date((Number(round.archivedAt) || 0) * 1000).toISOString(),
      dealer: round.dealer ?? "",
      dealerHomeworld: round.dealerHomeworld ?? "",
      gameId: round.gameId ?? "",
      roundNumber: Number(round.roundNumber) || 0,
      crashPoint: Number(round.crashPoint) || 0,
      playerCount: Number(round.playerCount) || 0,
      totalBets: Number(round.totalBets) || 0,
      totalPayouts: Number(round.totalPayouts) || 0,
      dealerProfit: Number(round.dealerProfit) || 0,
    })),
  });
}
