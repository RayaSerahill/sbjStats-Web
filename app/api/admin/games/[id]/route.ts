import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type GamePlayer = {
    playerId: string;
    playerTag?: string;
    name?: string;
    world?: string;
    dealer?: boolean;
    splitNum?: number;
    bet?: number;
    payout?: number;
    isDoubleDown?: boolean;
    result?: number;
    comboKey?: string;
};

type GameDoc = {
    _id?: ObjectId;
    createdAt?: Date;
    uploaderId: string;
    hostId?: string;
    players?: GamePlayer[];
};

function outcomeBuckets(result: number) {
    const r = Number(result);
    if (r === 1) return { wins: 1, losses: 0, pushes: 0, other: 0 };
    if (r === 2) return { wins: 0, losses: 0, pushes: 1, other: 0 };
    if (r === 0 || r === 3 || r === 6) return { wins: 0, losses: 1, pushes: 0, other: 0 };
    return { wins: 0, losses: 0, pushes: 0, other: 1 };
}

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/games/[id]">) {
    await ensureGameCollections();
    const gate = await requireAdminRequest(req);
    if (!gate.ok) return gate.res;

    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
    }

    const db = await getDb();
    const games = db.collection<GameDoc>("games");
    const statsPlayer = db.collection("stats_player");
    const statsCombo = db.collection("stats_combo");
    const statsHost = db.collection("stats_host");

    const game = await games.findOne({ _id: new ObjectId(id), uploaderId: gate.auth.id });
    if (!game) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const nonDealer = Array.isArray(game.players) ? game.players.filter((player) => !player?.dealer) : [];
    const dealer = Array.isArray(game.players) ? game.players.find((player) => player?.dealer) : null;
    const uploaderId = gate.auth.id;
    const hostId = game.hostId || dealer?.playerId;
    const createdAt = game.createdAt ?? new Date();

    const playerOps = nonDealer.map((player) => {
        const outcome = outcomeBuckets(Number(player.result) || 0);
        const bet = Number(player.bet) || 0;
        const payout = Number(player.payout) || 0;
        const net = payout - bet;

        return {
            updateOne: {
                filter: { uploaderId, playerId: player.playerId },
                update: {
                    $set: {
                        playerTag: player.playerTag,
                        name: player.name,
                        world: player.world,
                        updatedAt: createdAt,
                    },
                    $inc: {
                        games: -1,
                        wins: -outcome.wins,
                        losses: -outcome.losses,
                        pushes: -outcome.pushes,
                        otherResults: -outcome.other,
                        betTotal: -bet,
                        payoutTotal: -payout,
                        net: -net,
                        doubleDowns: player.isDoubleDown ? -1 : 0,
                        splits: Number(player.splitNum) > 0 ? -1 : 0,
                    },
                },
            },
        };
    });

    const comboCounts = new Map<string, ReturnType<typeof outcomeBuckets> & { seen: number; betTotal: number; payoutTotal: number; net: number }>();
    for (const player of nonDealer) {
        if (!player.comboKey) continue;
        const existing = comboCounts.get(player.comboKey) ?? { seen: 0, wins: 0, losses: 0, pushes: 0, other: 0, betTotal: 0, payoutTotal: 0, net: 0 };
        const outcome = outcomeBuckets(Number(player.result) || 0);
        const bet = Number(player.bet) || 0;
        const payout = Number(player.payout) || 0;
        existing.seen += 1;
        existing.wins += outcome.wins;
        existing.losses += outcome.losses;
        existing.pushes += outcome.pushes;
        existing.other += outcome.other;
        existing.betTotal += bet;
        existing.payoutTotal += payout;
        existing.net += payout - bet;
        comboCounts.set(player.comboKey, existing);
    }

    const comboOps = Array.from(comboCounts.entries()).map(([comboKey, agg]) => ({
        updateOne: {
            filter: { uploaderId, comboKey },
            update: {
                $set: { updatedAt: createdAt },
                $inc: {
                    seen: -agg.seen,
                    wins: -agg.wins,
                    losses: -agg.losses,
                    pushes: -agg.pushes,
                    otherResults: -agg.other,
                    betTotal: -agg.betTotal,
                    payoutTotal: -agg.payoutTotal,
                    net: -agg.net,
                },
            },
        },
    }));

    const hostAgg = nonDealer.reduce(
        (acc, player) => {
            const outcome = outcomeBuckets(Number(player.result) || 0);
            acc.playerWins += outcome.wins;
            acc.playerLosses += outcome.losses;
            acc.playerPushes += outcome.pushes;
            acc.playerOtherResults += outcome.other;
            acc.betTotal += Number(player.bet) || 0;
            acc.payoutTotal += Number(player.payout) || 0;
            return acc;
        },
        { playerWins: 0, playerLosses: 0, playerPushes: 0, playerOtherResults: 0, betTotal: 0, payoutTotal: 0 }
    );

    const deleteResult = await games.deleteOne({ _id: new ObjectId(id), uploaderId });
    if (!deleteResult.deletedCount) {
        return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    if (playerOps.length) await statsPlayer.bulkWrite(playerOps, { ordered: false });
    if (comboOps.length) await statsCombo.bulkWrite(comboOps, { ordered: false });
    if (hostId) {
        await statsHost.updateOne(
            { uploaderId, hostId },
            {
                $set: {
                    playerTag: dealer?.playerTag,
                    name: dealer?.name,
                    world: dealer?.world,
                    updatedAt: createdAt,
                },
                $inc: {
                    gamesHosted: -1,
                    playerWins: -hostAgg.playerWins,
                    playerLosses: -hostAgg.playerLosses,
                    playerPushes: -hostAgg.playerPushes,
                    playerOtherResults: -hostAgg.playerOtherResults,
                    betTotal: -hostAgg.betTotal,
                    payoutTotal: -hostAgg.payoutTotal,
                    net: -(hostAgg.payoutTotal - hostAgg.betTotal),
                },
            }
        );
    }

    await Promise.all([
        statsPlayer.deleteMany({ uploaderId, games: { $lte: 0 } }),
        statsCombo.deleteMany({ uploaderId, seen: { $lte: 0 } }),
        statsHost.deleteMany({ uploaderId, gamesHosted: { $lte: 0 } }),
    ]);

    return NextResponse.json({ ok: true });
}
