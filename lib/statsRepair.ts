import type { AnyBulkWriteOperation, Db } from "mongodb";
import { decodeRoundPayload, parseRoundEntries, type ParsedRoundEntry } from "@/lib/gameIngest";
import type { RawRoundEntry } from "@/lib/gameIngest";
import { computeDedupeKey, computeGameTotals, computeHandPayouts, isDuplicateKeyError, outcomeBuckets } from "@/lib/roundMath";

/**
 * Phase 2 repair: recompute every cards game's money from its stored payload
 * (the lossless source of truth), backfill dedupeKey + per-hand payouts, and
 * rebuild the stats_* collections from scratch.
 *
 * Guarantees:
 *  - payloadBase64 is never modified; players[] is re-derived from it with the
 *    same parser ingestion uses (adding handPayout), so no information is lost.
 *  - The first repair of a doc preserves the old money values under
 *    repair.prev; re-runs never overwrite that snapshot.
 *  - Idempotent: a second run finds everything alreadyCorrect and writes
 *    nothing.
 *  - dryRun computes and reports everything but writes nothing.
 */

export type RepairReport = {
  dryRun: boolean;
  scanned: number;
  repaired: number;
  alreadyCorrect: number;
  duplicatesRemoved: number;
  payloadFallback: number;
  dedupeCollisions: number;
  anomalies: Array<{ gameId: string; reason: string }>;
  statsDocs: { players: number; hosts: number; combos: number };
  perUploader: Array<{
    uploaderId: string;
    games: number;
    collected: number;
    paidOut: number;
    profitBefore: number;
    profitAfter: number;
  }>;
};

type AnyDoc = Record<string, any>;

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function analyzeGame(doc: AnyDoc):
  | { ok: true; newPlayers: ParsedRoundEntry[]; usedFallback: boolean; note?: string; dedupeKey: string }
  | { ok: false; reason: string } {
  const players: AnyDoc[] = Array.isArray(doc.players) ? doc.players : [];
  if (players.length === 0) return { ok: false, reason: "no players array" };

  const payloadBase64 = typeof doc.payloadBase64 === "string" && doc.payloadBase64 ? doc.payloadBase64 : null;
  const sourceDateTime = typeof doc.sourceDateTime === "string" ? doc.sourceDateTime : undefined;

  if (payloadBase64) {
    let parsed: ParsedRoundEntry[] | null = null;
    try {
      parsed = parseRoundEntries(decodeRoundPayload(payloadBase64).entries);
    } catch {
      parsed = null;
    }
    if (parsed && parsed.length > 0) {
      return {
        ok: true,
        newPlayers: parsed,
        usedFallback: false,
        note: parsed.length !== players.length ? `payload has ${parsed.length} entries, doc had ${players.length}` : undefined,
        dedupeKey: computeDedupeKey(sourceDateTime, parsed),
      };
    }
    return { ok: false, reason: "payloadBase64 present but not decodable" };
  }

  // No payload stored: derive handPayout from the parsed entries we have.
  // Grouping falls back to the stripped playerTag, which can merge "[n]"
  // seats — counted so these docs can be reviewed.
  const pseudoRaw = players.map((p) => ({
    PlayerName: String(p.playerTag ?? p.name ?? ""),
    Payout: Number(p.payout) || 0,
    SplitNum: Number(p.splitNum) || 0,
    Bet: Number(p.bet) || 0,
    Dealer: Boolean(p.dealer),
  })) as unknown as RawRoundEntry[];
  const handPayouts = computeHandPayouts(pseudoRaw);
  const newPlayers = players.map((p, i) => ({ ...p, handPayout: handPayouts[i] })) as ParsedRoundEntry[];

  return {
    ok: true,
    newPlayers,
    usedFallback: true,
    dedupeKey: computeDedupeKey(sourceDateTime, newPlayers),
  };
}

type KeeperCandidate = { id: AnyDoc["_id"]; createdAt: Date; hasRepair: boolean };

/** Earlier createdAt wins; ties prefer the already-repaired original, then the smaller _id. */
function betterKeeper(a: KeeperCandidate, b: KeeperCandidate) {
  if (+a.createdAt !== +b.createdAt) return +a.createdAt < +b.createdAt ? a : b;
  if (a.hasRepair !== b.hasRepair) return a.hasRepair ? a : b;
  return String(a.id) <= String(b.id) ? a : b;
}

export async function repairGames(opts: { db: Db; dryRun?: boolean; now?: Date }): Promise<RepairReport> {
  const db = opts.db;
  const dryRun = Boolean(opts.dryRun);
  const now = opts.now ?? new Date();

  const games = db.collection("games");

  const report: RepairReport = {
    dryRun,
    scanned: 0,
    repaired: 0,
    alreadyCorrect: 0,
    duplicatesRemoved: 0,
    payloadFallback: 0,
    dedupeCollisions: 0,
    anomalies: [],
    statsDocs: { players: 0, hosts: 0, combos: 0 },
    perUploader: [],
  };

  // Pass 1: find rounds stored more than once. The v2 dedupe key (normalized
  // timestamp + canonical content) recognizes the same round even when it
  // arrived through different channels (live upload vs CSV re-import) whose
  // raw timestamp/payload strings differ. Keep one doc per key; the rest are
  // deleted and excluded from the rebuilt stats.
  const keeperByKey = new Map<string, KeeperCandidate>();
  const loserIds: AnyDoc["_id"][] = [];
  for await (const doc of games.find({ gameType: "cards" })) {
    const analysis = analyzeGame(doc);
    if (!analysis.ok) continue;
    const key = `${String(doc.uploaderId ?? "")}|${analysis.dedupeKey}`;
    const cand: KeeperCandidate = {
      id: doc._id,
      createdAt: doc.createdAt instanceof Date ? doc.createdAt : new Date(0),
      hasRepair: Boolean(doc.repair),
    };
    const existing = keeperByKey.get(key);
    if (!existing) {
      keeperByKey.set(key, cand);
    } else {
      const keeper = betterKeeper(existing, cand);
      const loser = keeper === existing ? cand : existing;
      keeperByKey.set(key, keeper);
      loserIds.push(loser.id);
    }
  }
  const loserIdSet = new Set(loserIds.map((id) => String(id)));
  report.duplicatesRemoved = loserIds.length;
  if (!dryRun && loserIds.length) {
    for (const batch of chunk(loserIds, 500)) {
      await games.deleteMany({ _id: { $in: batch } });
    }
  }

  const gameOps: AnyBulkWriteOperation[] = [];
  const playerAgg = new Map<string, AnyDoc>();
  const comboAgg = new Map<string, AnyDoc>();
  const hostAgg = new Map<string, AnyDoc>();
  const uploaderRows = new Map<string, RepairReport["perUploader"][number]>();

  const flushGameOps = async () => {
    if (dryRun || gameOps.length === 0) {
      gameOps.length = 0;
      return;
    }
    for (const batch of chunk(gameOps, 500)) {
      try {
        await games.bulkWrite(batch, { ordered: false });
      } catch (e) {
        // A dedupeKey landing on an existing key means two stored docs are the
        // same round; leave the loser un-backfilled and surface the count.
        if (!isDuplicateKeyError(e)) throw e;
        const writeErrors = (e as AnyDoc).writeErrors ?? [];
        report.dedupeCollisions += Array.isArray(writeErrors) ? writeErrors.length : 1;
      }
    }
    gameOps.length = 0;
  };

  for await (const doc of games.find({ gameType: "cards" })) {
    const gameId = String(doc._id);
    if (loserIdSet.has(gameId)) continue; // deleted duplicate (or would be, in dry-run)
    report.scanned++;
    const uploaderId = String(doc.uploaderId ?? "");
    const createdAt: Date = doc.createdAt instanceof Date ? doc.createdAt : new Date(0);

    const analysis = analyzeGame(doc);
    if (!analysis.ok) {
      report.anomalies.push({ gameId, reason: analysis.reason });
      continue;
    }
    if (analysis.usedFallback) report.payloadFallback++;
    if (analysis.note) report.anomalies.push({ gameId, reason: analysis.note });

    const { newPlayers, dedupeKey } = analysis;
    const totals = computeGameTotals(newPlayers);

    const row = uploaderRows.get(uploaderId) ?? {
      uploaderId,
      games: 0,
      collected: 0,
      paidOut: 0,
      profitBefore: 0,
      profitAfter: 0,
    };
    row.games += 1;
    row.collected += totals.collected;
    row.paidOut += totals.paidOut;
    row.profitBefore += Number(doc.profit) || 0;
    row.profitAfter += totals.profit;
    uploaderRows.set(uploaderId, row);

    const playersAlreadyMarked =
      Array.isArray(doc.players) && doc.players.every((p: AnyDoc) => typeof p?.handPayout === "number");
    const needsRepair =
      doc.dedupeKey !== dedupeKey ||
      doc.collected !== totals.collected ||
      doc.paidOut !== totals.paidOut ||
      doc.profit !== totals.profit ||
      doc.integrity?.version !== 2 ||
      !playersAlreadyMarked;

    if (needsRepair) {
      report.repaired++;
      const set: AnyDoc = {
        players: newPlayers,
        collected: totals.collected,
        paidOut: totals.paidOut,
        profit: totals.profit,
        dedupeKey,
        integrity: { version: 2 },
      };
      // Preserve the pre-repair values exactly once.
      if (!doc.repair) {
        set.repair = {
          at: now,
          prev: {
            collected: doc.collected ?? null,
            paidOut: doc.paidOut ?? null,
            profit: doc.profit ?? null,
          },
        };
      }
      gameOps.push({ updateOne: { filter: { _id: doc._id }, update: { $set: set } } });
      if (gameOps.length >= 500) await flushGameOps();
    } else {
      report.alreadyCorrect++;
    }

    // Aggregate rebuilt stats from the repaired view of the game,
    // mirroring ingestion's counting exactly.
    const dealer = newPlayers.find((p) => p.dealer);
    const hostId = String(doc.hostId ?? dealer?.playerId ?? "");
    const hostKey = `${uploaderId}\0${hostId}`;
    const host = hostAgg.get(hostKey) ?? {
      uploaderId,
      hostId,
      ownedBy: uploaderId,
      gamesHosted: 0,
      playerWins: 0,
      playerLosses: 0,
      playerPushes: 0,
      playerOtherResults: 0,
      betTotal: 0,
      payoutTotal: 0,
      net: 0,
      playerTag: "",
      name: "",
      world: "",
      createdAt,
      updatedAt: createdAt,
    };
    host.gamesHosted += 1;
    if (createdAt < host.createdAt) host.createdAt = createdAt;
    if (createdAt >= host.updatedAt) {
      host.updatedAt = createdAt;
      if (dealer) {
        host.playerTag = dealer.playerTag;
        host.name = dealer.name;
        host.world = dealer.world;
      }
    }
    hostAgg.set(hostKey, host);

    for (const p of newPlayers) {
      if (p.dealer) continue;
      const o = outcomeBuckets(Number(p.result) || 0);
      const bet = Number(p.bet) || 0;
      const payout = Number(p.handPayout) || 0;
      const net = payout - bet;

      host.playerWins += o.wins;
      host.playerLosses += o.losses;
      host.playerPushes += o.pushes;
      host.playerOtherResults += o.other;
      host.betTotal += bet;
      host.payoutTotal += payout;
      host.net = host.payoutTotal - host.betTotal;

      const playerKey = `${uploaderId}\0${p.playerId}`;
      const pa = playerAgg.get(playerKey) ?? {
        uploaderId,
        playerId: p.playerId,
        playerTag: p.playerTag,
        name: p.name,
        world: p.world,
        games: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        otherResults: 0,
        betTotal: 0,
        payoutTotal: 0,
        net: 0,
        doubleDowns: 0,
        splits: 0,
        createdAt,
        updatedAt: createdAt,
      };
      pa.games += 1;
      pa.wins += o.wins;
      pa.losses += o.losses;
      pa.pushes += o.pushes;
      pa.otherResults += o.other;
      pa.betTotal += bet;
      pa.payoutTotal += payout;
      pa.net += net;
      pa.doubleDowns += p.isDoubleDown ? 1 : 0;
      pa.splits += p.splitNum > 0 ? 1 : 0;
      if (createdAt < pa.createdAt) pa.createdAt = createdAt;
      if (createdAt >= pa.updatedAt) {
        pa.updatedAt = createdAt;
        pa.playerTag = p.playerTag;
        pa.name = p.name;
        pa.world = p.world;
      }
      playerAgg.set(playerKey, pa);

      if (p.comboKey) {
        const comboKeyFull = `${uploaderId}\0${p.comboKey}`;
        const ca = comboAgg.get(comboKeyFull) ?? {
          uploaderId,
          comboKey: p.comboKey,
          seen: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          otherResults: 0,
          betTotal: 0,
          payoutTotal: 0,
          net: 0,
          createdAt,
          updatedAt: createdAt,
        };
        ca.seen += 1;
        ca.wins += o.wins;
        ca.losses += o.losses;
        ca.pushes += o.pushes;
        ca.otherResults += o.other;
        ca.betTotal += bet;
        ca.payoutTotal += payout;
        ca.net += net;
        if (createdAt < ca.createdAt) ca.createdAt = createdAt;
        if (createdAt > ca.updatedAt) ca.updatedAt = createdAt;
        comboAgg.set(comboKeyFull, ca);
      }
    }
  }

  await flushGameOps();

  report.statsDocs = { players: playerAgg.size, hosts: hostAgg.size, combos: comboAgg.size };
  report.perUploader = Array.from(uploaderRows.values()).sort((a, b) => a.uploaderId.localeCompare(b.uploaderId));

  if (!dryRun) {
    const rebuild = async (name: string, docs: AnyDoc[]) => {
      const col = db.collection(name);
      await col.deleteMany({});
      for (const batch of chunk(docs, 1000)) {
        if (batch.length) await col.insertMany(batch, { ordered: false });
      }
    };
    await rebuild("stats_player", Array.from(playerAgg.values()));
    await rebuild("stats_host", Array.from(hostAgg.values()));
    await rebuild("stats_combo", Array.from(comboAgg.values()));
  }

  return report;
}
