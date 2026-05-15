import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { GLOBAL_ALIASES_CREATED_BY, orderAliasesByPrecedence, usesGlobalAliases } from "@/lib/aliases";
import { ensureAuthCollections, ensureGameCollections, getDb, type UserDoc } from "@/lib/db";
import { playerTagToParts, toPlayerId } from "@/lib/gameIngest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PlayerDoc = {
  _id: string;
  playerTag?: string;
  name?: string;
  world?: string;
};

type AliasDoc = {
  primaryTag?: string;
  aliasTag?: string;
  createdBy?: string;
};

type MatchOption = {
  playerId: string;
  playerTag: string;
  name: string;
  world: string;
  aliases: string[];
};

type AliasContext = {
  aliasToPrimary: Map<string, string>;
  displayTags: Map<string, string>;
};

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function norm(input: unknown) {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  return s.normalize("NFKC").trim().toLowerCase();
}

function normalizePlayerTag(input: unknown) {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  return playerTagToParts(s).playerTag;
}

function tagKey(input: unknown) {
  return norm(normalizePlayerTag(input));
}

function addDisplayTag(displayTags: Map<string, string>, tag: unknown) {
  const playerTag = normalizePlayerTag(tag);
  const key = tagKey(playerTag);
  if (key && !displayTags.has(key)) displayTags.set(key, playerTag);
}

function buildAliasContext(aliasRows: AliasDoc[], uploaderId: string): AliasContext {
  const aliasToPrimary = new Map<string, string>();
  const displayTags = new Map<string, string>();

  for (const row of orderAliasesByPrecedence(aliasRows, uploaderId)) {
    const alias = normalizePlayerTag(row.aliasTag);
    const primary = normalizePlayerTag(row.primaryTag);
    const aliasKey = tagKey(alias);
    const primaryKey = tagKey(primary);

    addDisplayTag(displayTags, alias);
    addDisplayTag(displayTags, primary);
    if (aliasKey && primaryKey && aliasKey !== primaryKey) aliasToPrimary.set(aliasKey, primaryKey);
  }

  return { aliasToPrimary, displayTags };
}

function resolveCanonicalKey(tag: unknown, aliases: AliasContext) {
  let current = tagKey(tag);
  const seen = new Set<string>();

  while (current && aliases.aliasToPrimary.has(current) && !seen.has(current)) {
    seen.add(current);
    current = aliases.aliasToPrimary.get(current) ?? current;
  }

  return current;
}

function tagsForPlayer(player: PlayerDoc, aliasRows: AliasDoc[], aliases: AliasContext) {
  const directTag = normalizePlayerTag(player.playerTag);
  const canonicalKey = resolveCanonicalKey(directTag || player._id, aliases);
  const tags = new Map<string, string>();

  const add = (tag: unknown) => {
    const normalized = normalizePlayerTag(tag);
    const key = tagKey(normalized);
    if (key && !tags.has(key)) tags.set(key, normalized);
  };

  add(directTag);

  for (const row of aliasRows) {
    const primary = normalizePlayerTag(row.primaryTag);
    const alias = normalizePlayerTag(row.aliasTag);
    if (resolveCanonicalKey(primary, aliases) === canonicalKey || resolveCanonicalKey(alias, aliases) === canonicalKey) {
      add(primary);
      add(alias);
    }
  }

  const canonicalTag = aliases.displayTags.get(canonicalKey) ?? tags.get(canonicalKey) ?? directTag;
  if (canonicalTag) add(canonicalTag);

  return {
    canonicalKey,
    canonicalTag,
    aliases: Array.from(tags.values()).filter((tag) => tag !== canonicalTag),
    allTags: Array.from(tags.values()),
  };
}

function toOption(player: PlayerDoc, aliasRows: AliasDoc[], aliases: AliasContext): MatchOption {
  const aliasInfo = tagsForPlayer(player, aliasRows, aliases);
  const playerTag = aliasInfo.canonicalTag || normalizePlayerTag(player.playerTag) || player._id;
  const parts = playerTagToParts(playerTag);

  return {
    playerId: String(player._id),
    playerTag,
    name: parts.name || player.name || playerTag,
    world: parts.world || player.world || "unknown",
    aliases: aliasInfo.aliases,
  };
}

function isExactPlayerMatch(player: PlayerDoc, qNorm: string) {
  return norm(player._id) === qNorm || norm(player.playerTag) === qNorm || norm(player.name) === qNorm;
}

function groupMatches(players: PlayerDoc[], aliasRows: AliasDoc[], aliases: AliasContext) {
  const grouped = new Map<string, MatchOption>();

  for (const player of players) {
    const tag = normalizePlayerTag(player.playerTag) || player._id;
    const canonicalKey = resolveCanonicalKey(tag, aliases) || norm(player._id);
    if (!canonicalKey || grouped.has(canonicalKey)) continue;
    grouped.set(canonicalKey, toOption(player, aliasRows, aliases));
  }

  return Array.from(grouped.values());
}

async function statsForPlayer(uploaderId: string, player: PlayerDoc, aliasRows: AliasDoc[], aliases: AliasContext) {
  const db = await getDb();
  const games = db.collection("games");
  const aliasInfo = tagsForPlayer(player, aliasRows, aliases);
  const playerTags = new Set(aliasInfo.allTags.map((tag) => normalizePlayerTag(tag)).filter(Boolean));
  const playerIds = new Set<string>();

  if (player._id) playerIds.add(String(player._id));
  for (const playerTag of playerTags) {
    const derivedId = toPlayerId(playerTag);
    if (derivedId) playerIds.add(derivedId);
  }

  const matchOr: Record<string, unknown>[] = [];
  if (playerIds.size) matchOr.push({ "players.playerId": { $in: Array.from(playerIds) } });
  if (playerTags.size) matchOr.push({ "players.playerTag": { $in: Array.from(playerTags) } });

  if (matchOr.length === 0) {
    return {
      player: toOption(player, aliasRows, aliases),
      totals: { rounds: 0, hands: 0, wins: 0, betTotal: 0, payoutTotal: 0, profit: 0, winRate: 0 },
      daily: [],
    };
  }

  const playerMatch = matchOr.length === 1 ? matchOr[0] : { $or: matchOr };
  const rows = await games
    .aggregate<{
      day: string;
      rounds: number;
      hands: number;
      wins: number;
      betTotal: number;
      payoutTotal: number;
      profit: number;
    }>([
      { $match: { uploaderId } },
      { $project: { createdAt: 1, players: 1 } },
      { $unwind: "$players" },
      { $match: { "players.dealer": { $ne: true }, ...playerMatch } },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: { $ifNull: ["$createdAt", new Date(0)] },
            },
          },
          gameIds: { $addToSet: "$_id" },
          hands: { $sum: 1 },
          wins: { $sum: { $cond: [{ $eq: ["$players.result", 1] }, 1, 0] } },
          betTotal: { $sum: { $ifNull: ["$players.bet", 0] } },
          payoutTotal: { $sum: { $ifNull: ["$players.payout", 0] } },
          profit: {
            $sum: {
              $subtract: [{ $ifNull: ["$players.payout", 0] }, { $ifNull: ["$players.bet", 0] }],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, day: "$_id", rounds: { $size: "$gameIds" }, hands: 1, wins: 1, betTotal: 1, payoutTotal: 1, profit: 1 } },
    ])
    .toArray();

  const totals = rows.reduce(
    (acc, row) => {
      acc.rounds += Number(row.rounds) || 0;
      acc.hands += Number(row.hands) || 0;
      acc.wins += Number(row.wins) || 0;
      acc.betTotal += Number(row.betTotal) || 0;
      acc.payoutTotal += Number(row.payoutTotal) || 0;
      acc.profit += Number(row.profit) || 0;
      return acc;
    },
    { rounds: 0, hands: 0, wins: 0, betTotal: 0, payoutTotal: 0, profit: 0, winRate: 0 }
  );
  totals.winRate = totals.hands > 0 ? (totals.wins / totals.hands) * 100 : 0;

  return {
    player: toOption(player, aliasRows, aliases),
    totals,
    daily: rows.map((row) => ({
      day: row.day,
      wins: Number(row.wins) || 0,
      profit: Number(row.profit) || 0,
    })),
  };
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  await ensureGameCollections();

  const url = new URL(req.url);
  const uploaderId = (url.searchParams.get("uploaderId") ?? "").trim();
  const q = (url.searchParams.get("q") ?? "").trim();
  const selectedPlayerId = (url.searchParams.get("playerId") ?? "").trim();

  if (!ObjectId.isValid(uploaderId)) {
    return NextResponse.json({ ok: false, error: "Invalid uploaderId" }, { status: 400 });
  }

  if (!q && !selectedPlayerId) {
    return NextResponse.json({ ok: false, error: "Search query or playerId is required" }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const players = db.collection<PlayerDoc>("players");
  const aliases = db.collection<AliasDoc>("aliases");
  const user = await users.findOne(
    { _id: new ObjectId(uploaderId), deleted: { $ne: true } },
    { projection: { _id: 1, useGlobalAliases: 1 } }
  );

  if (!user?._id) {
    return NextResponse.json({ ok: false, error: "Host not found" }, { status: 404 });
  }

  const aliasRows = await aliases
    .find(
      usesGlobalAliases(user)
        ? { createdBy: { $in: [GLOBAL_ALIASES_CREATED_BY, uploaderId] } }
        : { createdBy: uploaderId },
      { projection: { primaryTag: 1, aliasTag: 1, createdBy: 1 } }
    )
    .sort({ createdAt: -1 })
    .toArray();
  const aliasContext = buildAliasContext(aliasRows, uploaderId);

  if (selectedPlayerId) {
    const player = await players.findOne(
      { _id: selectedPlayerId },
      { projection: { _id: 1, playerTag: 1, name: 1, world: 1 } }
    );

    if (!player) {
      return NextResponse.json({ ok: true, status: "not_found", matches: [] });
    }

    const stats = await statsForPlayer(uploaderId, player, aliasRows, aliasContext);
    return NextResponse.json({ ok: true, status: "stats", ...stats });
  }

  const safeQ = q.slice(0, 80);
  const qNorm = norm(safeQ);
  const regex = escapeRegex(safeQ);
  const foundPlayers = await players
    .find(
      {
        $or: [
          { _id: { $regex: regex, $options: "i" } },
          { playerTag: { $regex: regex, $options: "i" } },
          { name: { $regex: regex, $options: "i" } },
        ],
      },
      { projection: { _id: 1, playerTag: 1, name: 1, world: 1 } }
    )
    .sort({ updatedAt: -1 })
    .limit(40)
    .toArray();

  if (foundPlayers.length === 0) {
    return NextResponse.json({ ok: true, status: "not_found", matches: [] });
  }

  const exactPlayers = foundPlayers.filter((player) => isExactPlayerMatch(player, qNorm));
  const matches = groupMatches(exactPlayers.length ? exactPlayers : foundPlayers, aliasRows, aliasContext).slice(0, 12);

  if (matches.length === 0) {
    return NextResponse.json({ ok: true, status: "not_found", matches: [] });
  }

  if (matches.length > 1) {
    return NextResponse.json({ ok: true, status: "matches", matches });
  }

  const player = await players.findOne(
    { _id: matches[0].playerId },
    { projection: { _id: 1, playerTag: 1, name: 1, world: 1 } }
  );

  if (!player) {
    return NextResponse.json({ ok: true, status: "not_found", matches: [] });
  }

  const stats = await statsForPlayer(uploaderId, player, aliasRows, aliasContext);
  return NextResponse.json({ ok: true, status: "stats", ...stats });
}
