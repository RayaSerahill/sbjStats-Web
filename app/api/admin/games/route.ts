import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type GamePlayer = {
    dealer?: boolean;
    bet?: number;
    payout?: number;
};

type GameDoc = {
    _id?: ObjectId;
    createdAt?: Date;
    collected?: number;
    paidOut?: number;
    profit?: number;
    players?: GamePlayer[];
    uploaderId: string;
};

function toTotals(game: GameDoc) {
    const nonDealer = Array.isArray(game.players) ? game.players.filter((player) => !player?.dealer) : [];
    const collected = typeof game.collected === "number"
        ? game.collected
        : nonDealer.reduce((sum, player) => sum + (Number(player?.bet) || 0), 0);
    const paidOut = typeof game.paidOut === "number"
        ? game.paidOut
        : nonDealer.reduce((sum, player) => sum + (Number(player?.payout) || 0), 0);
    const profit = typeof game.profit === "number" ? game.profit : collected - paidOut;
    return { collected, paidOut, profit };
}

export async function GET(req: Request) {
    await ensureGameCollections();
    const gate = await requireAdminRequest(req);
    if (!gate.ok) return gate.res;

    const url = new URL(req.url);
    const pageRaw = Number(url.searchParams.get("page") || 1);
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const db = await getDb();
    const games = db.collection<GameDoc>("games");

    const rows = await games
        .find(
            { uploaderId: gate.auth.id },
            { projection: { createdAt: 1, collected: 1, paidOut: 1, profit: 1, players: 1 } }
        )
        .sort({ createdAt: -1, _id: -1 })
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
        games: visible.map((game) => {
            const totals = toTotals(game);
            return {
                id: game._id?.toHexString() ?? "",
                createdAt: game.createdAt ?? null,
                collected: totals.collected,
                paidOut: totals.paidOut,
                profit: totals.profit,
            };
        }),
    });
}
