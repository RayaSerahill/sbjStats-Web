import { ObjectId } from "mongodb";
import type { Db } from "mongodb";
import type { AnyBulkWriteOperation } from "mongodb";

type StatsHostDoc = Record<string, any>;

export type RawRoundEntry = {
  PlayerName: string;
  Cards: number[];
  SplitNum?: number;
  Bet?: number;
  Payout?: number;
  IsDoubleDown?: boolean;
  Result?: number;
  Dealer?: boolean;
  Integrity?: number;
};

export type ParsedRoundEntry = {
  playerId: string;
  playerTag: string;
  name: string;
  world: string;
  dealer: boolean;
  splitNum: number;
  bet: number;
  payout: number;
  isDoubleDown: boolean;
  result: number;
  cards: number[];
  comboKey: string;
  integrity: number;
};

type PlayerDoc = {
  _id: string;
  playerTag: string;
  name: string;
  world: string;
  createdAt: Date;
  updatedAt: Date;
};

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function playerTagToParts(playerTag: string) {
  // Some player tags are suffixed with instance markers like "Name@World [1]".
  // Strip a trailing " [<digits>]" so identity and stats aggregate correctly.
  const trimmed = (playerTag ?? "")
    .replace(/\s*\[\d+\]\s*$/, "")
    .trim();
  const at = trimmed.lastIndexOf("@");
  if (at === -1) {
    return { name: trimmed, world: "unknown", playerTag: trimmed };
  }

  const name = trimmed.slice(0, at).trim();
  const world = trimmed.slice(at + 1).trim() || "unknown";
  return { name, world, playerTag: trimmed };
}

export function toPlayerId(playerTag: string) {
  const { name, world } = playerTagToParts(playerTag);
  return `${slugify(world)}:${slugify(name)}`;
}

export function toComboKey(cards: number[]) {
  const cleaned = (cards ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n));
  // Order-sensitive combo key (e.g. "10-2" differs from "2-10").
  // We intentionally do NOT sort here.
  return cleaned.join("-");
}

export function decodeRoundPayload(input: string): { entries: RawRoundEntry[]; payloadBase64?: string } {
  const raw = (input ?? "").trim();
  if (!raw) return { entries: [] };

  // Allow either base64 or direct JSON (handy for debugging).
  const looksLikeJson = raw.startsWith("[") || raw.startsWith("{");
  if (looksLikeJson) {
    return { entries: JSON.parse(raw) };
  }

  const json = Buffer.from(raw, "base64").toString("utf8");
  return { entries: JSON.parse(json), payloadBase64: raw };
}

function outcomeBuckets(result: number) {
  // Result encoding from game base64 details:
  // Bust=0, Win=1, Draw=2, Loss=3, Surrender=6
  // For stats: Bust/Loss/Surrender => loss, Draw => draw, Win => win.
  const r = Number(result);
  if (r === 1) return { wins: 1, losses: 0, pushes: 0, other: 0 };
  if (r === 2) return { wins: 0, losses: 0, pushes: 1, other: 0 };
  if (r === 0 || r === 3 || r === 6) return { wins: 0, losses: 1, pushes: 0, other: 0 };
  return { wins: 0, losses: 0, pushes: 0, other: 1 };
}

export function parseRoundEntries(rawEntries: RawRoundEntry[]): ParsedRoundEntry[] {
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries
    .filter((e) => e && typeof e.PlayerName === "string")
    .map((e) => {
      const { name, world, playerTag } = playerTagToParts(e.PlayerName);
      const playerId = toPlayerId(playerTag);
      const cards = Array.isArray(e.Cards) ? e.Cards.map((n) => Number(n)).filter((n) => Number.isFinite(n)) : [];
      const comboKey = toComboKey(cards);

      return {
        playerId,
        playerTag,
        name,
        world,
        dealer: Boolean(e.Dealer),
        splitNum: Number.isFinite(Number(e.SplitNum)) ? Number(e.SplitNum) : 0,
        bet: Number.isFinite(Number(e.Bet)) ? Number(e.Bet) : 0,
        payout: Number.isFinite(Number(e.Payout)) ? Number(e.Payout) : 0,
        isDoubleDown: Boolean(e.IsDoubleDown),
        result: Number.isFinite(Number(e.Result)) ? Number(e.Result) : 0,
        cards,
        comboKey,
        integrity: Number.isFinite(Number(e.Integrity)) ? Number(e.Integrity) : 0,
      };
    });
}

export async function ingestRound(opts: {
  db: Db;
  uploaderId: string;
  payload: string;
  createdAt?: Date;
  sourceDateTime?: string;
}) {
  const { entries: rawEntries, payloadBase64 } = decodeRoundPayload(opts.payload);
  const players = parseRoundEntries(rawEntries);

  if (players.length === 0) {
    return { ok: false as const, error: "No players found in payload" };
  }

  const dealerEntry = players.find((p) => p.dealer);
  if (!dealerEntry) {
    return { ok: false as const, error: "No dealer/host entry found (Dealer=true)" };
  }

  const createdAt = opts.createdAt ?? new Date();
  const uploaderId = opts.uploaderId;
  const hostId = dealerEntry.playerId;

  // If the caller provides a dedupe key (CSV's "Date and time"), try to insert first and skip on duplicates.
  const gamesCol = opts.db.collection("games");
  const insertDoc = {
    createdAt,
    sourceDateTime: opts.sourceDateTime,
    uploaderId,
    hostId,
    gameType: "cards",
    integrity: {
      version: 1,
    },
    players,
    payloadBase64,
  };

  let insertRes;
  try {
    insertRes = await gamesCol.insertOne(insertDoc);
  } catch (e: any) {
    if (e?.code === 11000) {
      return { ok: true as const, skipped: true as const };
    }
    throw e;
  }

  // Upsert into players collection (identity + display tag).
  const playersCol = opts.db.collection<PlayerDoc>("players");
  const now = new Date();

  const playerOps: AnyBulkWriteOperation<PlayerDoc>[] = players.map((p) => {
    const id = `${p.world}:${p.playerTag}`; // or just p.playerTag if guaranteed unique

    return {
      updateOne: {
        filter: { _id: id },
        update: {
          $setOnInsert: { _id: id, createdAt: now },
          $set: {
            playerTag: p.playerTag,
            name: p.name,
            world: p.world,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    };
  });

  if (playerOps.length) await playersCol.bulkWrite(playerOps, { ordered: false });

  // Stats updates
  const statsPlayer = opts.db.collection("stats_player");
  const statsCombo = opts.db.collection("stats_combo");
  const statsHost = opts.db.collection<StatsHostDoc>("stats_host");

  const nonDealer = players.filter((p) => !p.dealer);
  const hostAggregates = nonDealer.reduce(
    (acc, p) => {
      const b = outcomeBuckets(p.result);
      acc.playerWins += b.wins;
      acc.playerLosses += b.losses;
      acc.playerPushes += b.pushes;
      acc.playerOther += b.other;
      acc.betTotal += p.bet;
      acc.payoutTotal += p.payout;
      return acc;
    },
    { playerWins: 0, playerLosses: 0, playerPushes: 0, playerOther: 0, betTotal: 0, payoutTotal: 0 }
  );

  const playerStatOps: any[] = [];
  const comboStatOps: any[] = [];

  for (const p of nonDealer) {
    const o = outcomeBuckets(p.result);
    const net = p.payout - p.bet;
    playerStatOps.push({
      updateOne: {
        filter: { uploaderId, playerId: p.playerId },
        update: {
          // Avoid ConflictingUpdateOperators (code 40): the same path cannot be targeted by
          // both $setOnInsert and $set in a single update.
          $setOnInsert: {
            uploaderId,
            playerId: p.playerId,
            createdAt,
          },
          $set: {
            playerTag: p.playerTag,
            name: p.name,
            world: p.world,
            updatedAt: createdAt,
          },
          $inc: {
            games: 1,
            wins: o.wins,
            losses: o.losses,
            pushes: o.pushes,
            otherResults: o.other,
            betTotal: p.bet,
            payoutTotal: p.payout,
            net,
            doubleDowns: p.isDoubleDown ? 1 : 0,
            splits: p.splitNum > 0 ? 1 : 0,
          },
        },
        upsert: true,
      },
    });

    if (p.comboKey) {
      comboStatOps.push({
        updateOne: {
          filter: { uploaderId, comboKey: p.comboKey },
          update: {
            $setOnInsert: {
              uploaderId,
              comboKey: p.comboKey,
              createdAt,
            },
            $set: {
              updatedAt: createdAt,
            },
            $inc: {
              seen: 1,
              wins: o.wins,
              losses: o.losses,
              pushes: o.pushes,
              otherResults: o.other,
              betTotal: p.bet,
              payoutTotal: p.payout,
              net,
            },
          },
          upsert: true,
        },
      });
    }
  }

  if (playerStatOps.length) await statsPlayer.bulkWrite(playerStatOps, { ordered: false });
  if (comboStatOps.length) await statsCombo.bulkWrite(comboStatOps, { ordered: false });

  await statsHost.updateOne(
    { uploaderId, hostId },
    {
      $setOnInsert: {
        uploaderId,
        hostId,
        ownedBy: uploaderId,
        createdAt,
      },
      $set: {
        ownedBy: uploaderId,
        playerTag: dealerEntry.playerTag,
        name: dealerEntry.name,
        world: dealerEntry.world,
        updatedAt: createdAt,
      },
      $inc: {
        gamesHosted: 1,
        playerWins: hostAggregates.playerWins,
        playerLosses: hostAggregates.playerLosses,
        playerPushes: hostAggregates.playerPushes,
        playerOtherResults: hostAggregates.playerOther,
        betTotal: hostAggregates.betTotal,
        payoutTotal: hostAggregates.payoutTotal,
        net: hostAggregates.payoutTotal - hostAggregates.betTotal,
      },
    },
    { upsert: true }
  );

  return {
    ok: true as const,
    skipped: false as const,
    gameId: insertRes.insertedId instanceof ObjectId ? insertRes.insertedId.toHexString() : String(insertRes.insertedId),
  };
}
