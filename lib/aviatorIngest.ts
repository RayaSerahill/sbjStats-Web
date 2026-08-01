import type { AnyBulkWriteOperation, Db, ObjectId } from "mongodb";

export type AviatorRoundPlayerPayload = {
  player_id?: number | string;
  name?: string;
  slot?: number | string;
  bet?: number | string;
  cashout_multiplier?: number | string | null;
  win?: number | string;
  net?: number | string;
  won?: boolean | number | string;
};

export type AviatorLiveRoundPayload = {
  upload_type: "live_round";
  source?: string;
  archived_at?: number | string;
  dealer?: string;
  round: {
    game_id?: string;
    round_number?: number | string;
    crash_point?: number | string;
    players?: AviatorRoundPlayerPayload[];
  };
};

type AviatorStatsPayload = {
  dealer_character?: string;
  dealer_homeworld?: string;
  total_games?: number | string;
  total_rounds?: number | string;
  total_players?: number | string;
  total_bets_taken?: number | string;
  total_payouts?: number | string;
  house_profit?: number | string;
  games?: unknown[];
};

type AviatorArchiveSummaryPayload = {
  game_id?: string;
  theme?: string;
  created_at?: string;
  final_status?: string;
  total_rounds?: number | string;
  total_players?: number | string;
  total_bets?: number | string;
  total_payouts?: number | string;
  dealer_profit?: number | string;
};

type AviatorGameArchivePayload = {
  game_id?: string;
  theme?: string;
  created_at?: string;
  final_status?: string;
  dealer_name?: string;
  dealer_homeworld?: string;
  totals?: {
    rounds?: number | string;
    players?: number | string;
    total_bets?: number | string;
    total_payouts?: number | string;
    total_adjustments?: number | string;
    dealer_profit?: number | string;
  };
  players?: unknown[];
  rounds?: unknown[];
  adjustments?: unknown[];
};

export type AviatorArchivePayload = {
  upload_type: "archive";
  source?: string;
  archived_at?: number | string;
  dealer?: string;
  stats?: AviatorStatsPayload;
  archive?: AviatorArchiveSummaryPayload[];
  game_archives?: AviatorGameArchivePayload[];
};

export type AviatorImportPayload = AviatorLiveRoundPayload | AviatorArchivePayload;

export type AviatorRoundPlayerDoc = {
  playerId: string;
  sourcePlayerId?: string;
  name: string;
  slot?: number;
  bet: number;
  cashoutMultiplier: number | null;
  win: number;
  net: number;
  won: boolean;
};

export type AviatorRoundDoc = {
  _id?: ObjectId;
  uploaderId: string;
  uploadType: "live_round" | "archive";
  source?: string;
  archivedAt: number;
  dealer?: string;
  dealerHomeworld?: string;
  dealerKey: string;
  gameId: string;
  roundNumber: number;
  crashPoint: number;
  players: AviatorRoundPlayerDoc[];
  playerCount: number;
  totalBets: number;
  totalPayouts: number;
  dealerProfit: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AviatorGameDoc = {
  _id?: ObjectId;
  uploaderId: string;
  source?: string;
  archivedAt: number;
  gameId: string;
  theme?: string;
  startedAt?: Date;
  finalStatus?: string;
  dealerName?: string;
  dealerHomeworld?: string;
  totalRounds: number;
  totalPlayers: number;
  totalBets: number;
  totalPayouts: number;
  totalAdjustments: number;
  dealerProfit: number;
  players?: unknown[];
  rounds?: unknown[];
  adjustments?: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

type AviatorStatsSnapshotDoc = {
  uploaderId: string;
  source?: string;
  archivedAt: number;
  dealer?: string;
  dealerCharacter: string;
  dealerHomeworld?: string;
  totalGames: number;
  totalRounds: number;
  totalPlayers: number;
  totalBetsTaken: number;
  totalPayouts: number;
  houseProfit: number;
  games?: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

type AviatorPlayerDoc = {
  uploaderId: string;
  playerId: string;
  sourcePlayerId?: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

type AviatorPlayerStatsDoc = {
  uploaderId: string;
  playerId: string;
  sourcePlayerId?: string;
  name: string;
  rounds: number;
  wins: number;
  losses: number;
  betTotal: number;
  payoutTotal: number;
  net: number;
  cashouts: number;
  createdAt: Date;
  updatedAt: Date;
};

type AviatorDealerStatsDoc = {
  uploaderId: string;
  dealerKey: string;
  dealer?: string;
  dealerHomeworld?: string;
  roundsHosted: number;
  playerCount: number;
  playerWins: number;
  playerLosses: number;
  betTotal: number;
  payoutTotal: number;
  dealerProfit: number;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeString(value: unknown) {
  if (typeof value !== "string") {
    if (value === null || value === undefined) return undefined;
    const converted = String(value).trim();
    return converted || undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_:-]+/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/[\s\u00A0\u202F]/g, "")
      .replace(/,/g, "")
      .replace(/'/g, "");
    if (cleaned) {
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return fallback;
}

function normalizeInt(value: unknown, fallback = 0) {
  return Math.trunc(normalizeNumber(value, fallback));
}

function normalizeBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "won", "win"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "lost", "loss"].includes(normalized)) return false;
  }

  return false;
}

function normalizeUnixSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1_000_000_000_000 ? Math.trunc(value / 1000) : Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric >= 1_000_000_000_000 ? Math.trunc(numeric / 1000) : Math.trunc(numeric);
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) return Math.trunc(parsed.getTime() / 1000);
    }
  }

  return Math.trunc(Date.now() / 1000);
}

function normalizeDate(value: unknown) {
  const raw = normalizeString(value);
  if (!raw) return undefined;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function playerIdFromParts(sourcePlayerId: string | undefined, name: string) {
  if (sourcePlayerId) return sourcePlayerId;
  return `name:${slugify(name) || "unknown"}`;
}

function dealerKey(dealer: string | undefined, homeworld?: string) {
  const name = slugify(dealer || "unknown");
  const world = slugify(homeworld || "");
  return world ? `${world}:${name}` : name;
}

function normalizeRoundPlayer(value: unknown): AviatorRoundPlayerDoc | null {
  if (!value || typeof value !== "object") return null;

  const player = value as AviatorRoundPlayerPayload;
  const name = normalizeString(player.name);
  if (!name) return null;

  const sourcePlayerId = normalizeString(player.player_id);
  const bet = normalizeInt(player.bet);
  const win = normalizeInt(player.win);
  const net = Number.isFinite(normalizeNumber(player.net, Number.NaN))
    ? normalizeInt(player.net)
    : win - bet;
  const cashoutMultiplier = Number.isFinite(normalizeNumber(player.cashout_multiplier, Number.NaN))
    ? normalizeNumber(player.cashout_multiplier)
    : null;

  return {
    playerId: playerIdFromParts(sourcePlayerId, name),
    ...(sourcePlayerId ? { sourcePlayerId } : {}),
    name,
    ...(Number.isFinite(normalizeNumber(player.slot, Number.NaN)) ? { slot: normalizeInt(player.slot) } : {}),
    bet,
    cashoutMultiplier,
    win,
    net,
    won: normalizeBoolean(player.won) || win > bet,
  };
}

function roundTotals(players: AviatorRoundPlayerDoc[]) {
  return players.reduce(
    (acc, player) => {
      acc.totalBets += player.bet;
      acc.totalPayouts += player.win;
      return acc;
    },
    { totalBets: 0, totalPayouts: 0 }
  );
}

function normalizeLiveRound(
  payload: AviatorLiveRoundPayload,
  now: Date
): AviatorRoundDoc | null {
  const round = payload.round;
  if (!round || typeof round !== "object") return null;

  const gameId = normalizeString(round.game_id);
  const roundNumber = normalizeInt(round.round_number, Number.NaN);
  const crashPoint = normalizeNumber(round.crash_point, Number.NaN);
  if (!gameId || !Number.isFinite(roundNumber) || !Number.isFinite(crashPoint)) return null;

  const players = Array.isArray(round.players)
    ? round.players.map((player) => normalizeRoundPlayer(player)).filter((player): player is AviatorRoundPlayerDoc => Boolean(player))
    : [];
  const totals = roundTotals(players);
  const dealer = normalizeString(payload.dealer);

  return {
    uploaderId: "",
    uploadType: "live_round",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(payload.archived_at),
    ...(dealer ? { dealer } : {}),
    dealerKey: dealerKey(dealer),
    gameId,
    roundNumber,
    crashPoint,
    players,
    playerCount: players.length,
    totalBets: totals.totalBets,
    totalPayouts: totals.totalPayouts,
    dealerProfit: totals.totalBets - totals.totalPayouts,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeArchiveGameSummary(
  payload: AviatorArchivePayload,
  item: AviatorArchiveSummaryPayload,
  now: Date
): AviatorGameDoc | null {
  const gameId = normalizeString(item.game_id);
  if (!gameId) return null;

  const totalBets = normalizeInt(item.total_bets);
  const totalPayouts = normalizeInt(item.total_payouts);

  return {
    uploaderId: "",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(payload.archived_at),
    gameId,
    theme: normalizeString(item.theme),
    startedAt: normalizeDate(item.created_at),
    finalStatus: normalizeString(item.final_status),
    dealerName: normalizeString(payload.dealer),
    totalRounds: normalizeInt(item.total_rounds),
    totalPlayers: normalizeInt(item.total_players),
    totalBets,
    totalPayouts,
    totalAdjustments: 0,
    dealerProfit: Number.isFinite(normalizeNumber(item.dealer_profit, Number.NaN))
      ? normalizeInt(item.dealer_profit)
      : totalBets - totalPayouts,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeGameArchive(
  payload: AviatorArchivePayload,
  item: AviatorGameArchivePayload,
  now: Date
): AviatorGameDoc | null {
  const gameId = normalizeString(item.game_id);
  if (!gameId) return null;

  const totals = item.totals && typeof item.totals === "object" ? item.totals : {};
  const totalBets = normalizeInt(totals.total_bets);
  const totalPayouts = normalizeInt(totals.total_payouts);

  return {
    uploaderId: "",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(payload.archived_at),
    gameId,
    theme: normalizeString(item.theme),
    startedAt: normalizeDate(item.created_at),
    finalStatus: normalizeString(item.final_status),
    dealerName: normalizeString(item.dealer_name) ?? normalizeString(payload.dealer),
    dealerHomeworld: normalizeString(item.dealer_homeworld),
    totalRounds: normalizeInt(totals.rounds),
    totalPlayers: normalizeInt(totals.players),
    totalBets,
    totalPayouts,
    totalAdjustments: normalizeInt(totals.total_adjustments),
    dealerProfit: Number.isFinite(normalizeNumber(totals.dealer_profit, Number.NaN))
      ? normalizeInt(totals.dealer_profit)
      : totalBets - totalPayouts,
    players: Array.isArray(item.players) ? item.players : [],
    rounds: Array.isArray(item.rounds) ? item.rounds : [],
    adjustments: Array.isArray(item.adjustments) ? item.adjustments : [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeArchiveRound(
  payload: AviatorArchivePayload,
  game: AviatorGameDoc,
  value: unknown,
  now: Date
): AviatorRoundDoc | null {
  if (!value || typeof value !== "object") return null;
  const round = value as Record<string, unknown>;

  const roundNumber = normalizeInt(
    round.round_number ?? round.roundNumber ?? round.round ?? round.number,
    Number.NaN
  );
  const crashPoint = normalizeNumber(
    round.crash_point ?? round.crashPoint ?? round.crash ?? round.multiplier,
    Number.NaN
  );
  if (!Number.isFinite(roundNumber) || !Number.isFinite(crashPoint)) return null;

  const playersRaw = round.players;
  const players = Array.isArray(playersRaw)
    ? playersRaw.map((player) => normalizeRoundPlayer(player)).filter((player): player is AviatorRoundPlayerDoc => Boolean(player))
    : [];
  const totals = roundTotals(players);
  const dealer = normalizeString(round.dealer) ?? game.dealerName ?? normalizeString(payload.dealer);

  return {
    uploaderId: "",
    uploadType: "archive",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(round.archived_at ?? round.archivedAt ?? payload.archived_at),
    ...(dealer ? { dealer } : {}),
    ...(game.dealerHomeworld ? { dealerHomeworld: game.dealerHomeworld } : {}),
    dealerKey: dealerKey(dealer, game.dealerHomeworld),
    gameId: game.gameId,
    roundNumber,
    crashPoint,
    players,
    playerCount: players.length,
    totalBets: totals.totalBets,
    totalPayouts: totals.totalPayouts,
    dealerProfit: totals.totalBets - totals.totalPayouts,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeStatsSnapshot(
  payload: AviatorArchivePayload,
  now: Date
): AviatorStatsSnapshotDoc | null {
  const stats = payload.stats;
  if (!stats || typeof stats !== "object") return null;

  const dealerCharacter = normalizeString(stats.dealer_character) ?? normalizeString(payload.dealer);
  if (!dealerCharacter) return null;

  return {
    uploaderId: "",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(payload.archived_at),
    dealer: normalizeString(payload.dealer),
    dealerCharacter,
    dealerHomeworld: normalizeString(stats.dealer_homeworld),
    totalGames: normalizeInt(stats.total_games),
    totalRounds: normalizeInt(stats.total_rounds),
    totalPlayers: normalizeInt(stats.total_players),
    totalBetsTaken: normalizeInt(stats.total_bets_taken),
    totalPayouts: normalizeInt(stats.total_payouts),
    houseProfit: normalizeInt(stats.house_profit),
    games: Array.isArray(stats.games) ? stats.games : [],
    createdAt: now,
    updatedAt: now,
  };
}

export function isAviatorLiveRoundPayload(value: unknown): value is AviatorLiveRoundPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as AviatorLiveRoundPayload;
  return payload.upload_type === "live_round" && !!payload.round && typeof payload.round === "object";
}

export function isAviatorArchivePayload(value: unknown): value is AviatorArchivePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as AviatorArchivePayload;
  return (
    payload.upload_type === "archive" &&
    (!!payload.stats ||
      Array.isArray(payload.archive) ||
      Array.isArray(payload.game_archives))
  );
}

export function isAviatorImportPayload(value: unknown): value is AviatorImportPayload {
  return isAviatorLiveRoundPayload(value) || isAviatorArchivePayload(value);
}

function uniqueRounds(rounds: AviatorRoundDoc[]) {
  const byKey = new Map<string, AviatorRoundDoc>();
  for (const round of rounds) {
    byKey.set(`${round.gameId}:${round.roundNumber}`, round);
  }
  return Array.from(byKey.values());
}

function uniqueGames(games: AviatorGameDoc[]) {
  const byKey = new Map<string, AviatorGameDoc>();
  for (const game of games) {
    const existing = byKey.get(game.gameId);
    byKey.set(game.gameId, existing ? { ...existing, ...game } : game);
  }
  return Array.from(byKey.values());
}

function roundUpsertOps(rounds: AviatorRoundDoc[]): AnyBulkWriteOperation<AviatorRoundDoc>[] {
  return rounds.map((round) => ({
    updateOne: {
      filter: {
        uploaderId: round.uploaderId,
        gameId: round.gameId,
        roundNumber: round.roundNumber,
      },
      update: {
        $set: {
          uploadType: round.uploadType,
          source: round.source,
          archivedAt: round.archivedAt,
          dealer: round.dealer,
          dealerHomeworld: round.dealerHomeworld,
          dealerKey: round.dealerKey,
          crashPoint: round.crashPoint,
          players: round.players,
          playerCount: round.playerCount,
          totalBets: round.totalBets,
          totalPayouts: round.totalPayouts,
          dealerProfit: round.dealerProfit,
          updatedAt: round.updatedAt,
        },
        $setOnInsert: {
          uploaderId: round.uploaderId,
          gameId: round.gameId,
          roundNumber: round.roundNumber,
          createdAt: round.createdAt,
        },
      },
      upsert: true,
    },
  }));
}

function gameUpsertOps(games: AviatorGameDoc[]): AnyBulkWriteOperation<AviatorGameDoc>[] {
  return games.map((game) => ({
    updateOne: {
      filter: {
        uploaderId: game.uploaderId,
        gameId: game.gameId,
      },
      update: {
        $set: {
          source: game.source,
          archivedAt: game.archivedAt,
          theme: game.theme,
          startedAt: game.startedAt,
          finalStatus: game.finalStatus,
          dealerName: game.dealerName,
          dealerHomeworld: game.dealerHomeworld,
          totalRounds: game.totalRounds,
          totalPlayers: game.totalPlayers,
          totalBets: game.totalBets,
          totalPayouts: game.totalPayouts,
          totalAdjustments: game.totalAdjustments,
          dealerProfit: game.dealerProfit,
          players: game.players,
          rounds: game.rounds,
          adjustments: game.adjustments,
          updatedAt: game.updatedAt,
        },
        $setOnInsert: {
          uploaderId: game.uploaderId,
          gameId: game.gameId,
          createdAt: game.createdAt,
        },
      },
      upsert: true,
    },
  }));
}

function statsSnapshotUpsertOps(stats: AviatorStatsSnapshotDoc[]): AnyBulkWriteOperation<AviatorStatsSnapshotDoc>[] {
  return stats.map((snapshot) => ({
    updateOne: {
      filter: {
        uploaderId: snapshot.uploaderId,
        dealerCharacter: snapshot.dealerCharacter,
        archivedAt: snapshot.archivedAt,
      },
      update: {
        $set: {
          source: snapshot.source,
          dealer: snapshot.dealer,
          dealerHomeworld: snapshot.dealerHomeworld,
          totalGames: snapshot.totalGames,
          totalRounds: snapshot.totalRounds,
          totalPlayers: snapshot.totalPlayers,
          totalBetsTaken: snapshot.totalBetsTaken,
          totalPayouts: snapshot.totalPayouts,
          houseProfit: snapshot.houseProfit,
          games: snapshot.games,
          updatedAt: snapshot.updatedAt,
        },
        $setOnInsert: {
          uploaderId: snapshot.uploaderId,
          dealerCharacter: snapshot.dealerCharacter,
          archivedAt: snapshot.archivedAt,
          createdAt: snapshot.createdAt,
        },
      },
      upsert: true,
    },
  }));
}

function collectUpsertedDocs<T>(docs: T[], result: unknown): T[] {
  const upsertedIds = (result as { upsertedIds?: Record<string, unknown> })?.upsertedIds ?? {};
  return Object.keys(upsertedIds)
    .map((index) => docs[Number(index)])
    .filter((doc): doc is T => Boolean(doc));
}

async function updatePlayerIdentity(opts: { db: Db; uploaderId: string; rounds: AviatorRoundDoc[] }) {
  const playerById = new Map<string, AviatorPlayerDoc>();
  for (const round of opts.rounds) {
    for (const player of round.players) {
      const existing = playerById.get(player.playerId);
      if (!existing) {
        playerById.set(player.playerId, {
          uploaderId: opts.uploaderId,
          playerId: player.playerId,
          sourcePlayerId: player.sourcePlayerId,
          name: player.name,
          createdAt: round.createdAt,
          updatedAt: round.updatedAt,
        });
        continue;
      }

      existing.name = player.name;
      existing.sourcePlayerId = player.sourcePlayerId ?? existing.sourcePlayerId;
      if (round.createdAt < existing.createdAt) existing.createdAt = round.createdAt;
      if (round.updatedAt > existing.updatedAt) existing.updatedAt = round.updatedAt;
    }
  }

  const ops: AnyBulkWriteOperation<AviatorPlayerDoc>[] = Array.from(playerById.values()).map((player) => ({
    updateOne: {
      filter: { uploaderId: player.uploaderId, playerId: player.playerId },
      update: {
        $set: {
          sourcePlayerId: player.sourcePlayerId,
          name: player.name,
          updatedAt: player.updatedAt,
        },
        $setOnInsert: {
          uploaderId: player.uploaderId,
          playerId: player.playerId,
          createdAt: player.createdAt,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length) await opts.db.collection<AviatorPlayerDoc>("aviator_players").bulkWrite(ops, { ordered: false });
}

async function incrementRoundStats(opts: { db: Db; uploaderId: string; rounds: AviatorRoundDoc[] }) {
  if (opts.rounds.length === 0) return;

  const playerAgg = new Map<
    string,
    {
      name: string;
      sourcePlayerId?: string;
      rounds: number;
      wins: number;
      losses: number;
      betTotal: number;
      payoutTotal: number;
      net: number;
      cashouts: number;
      createdAt: Date;
      updatedAt: Date;
    }
  >();
  const dealerAgg = new Map<
    string,
    {
      dealer?: string;
      dealerHomeworld?: string;
      roundsHosted: number;
      playerCount: number;
      playerWins: number;
      playerLosses: number;
      betTotal: number;
      payoutTotal: number;
      dealerProfit: number;
      createdAt: Date;
      updatedAt: Date;
    }
  >();

  for (const round of opts.rounds) {
    const existingDealer = dealerAgg.get(round.dealerKey) ?? {
      dealer: round.dealer,
      dealerHomeworld: round.dealerHomeworld,
      roundsHosted: 0,
      playerCount: 0,
      playerWins: 0,
      playerLosses: 0,
      betTotal: 0,
      payoutTotal: 0,
      dealerProfit: 0,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
    };
    existingDealer.dealer = round.dealer ?? existingDealer.dealer;
    existingDealer.dealerHomeworld = round.dealerHomeworld ?? existingDealer.dealerHomeworld;
    existingDealer.roundsHosted += 1;
    existingDealer.playerCount += round.playerCount;
    existingDealer.betTotal += round.totalBets;
    existingDealer.payoutTotal += round.totalPayouts;
    existingDealer.dealerProfit += round.dealerProfit;
    if (round.createdAt < existingDealer.createdAt) existingDealer.createdAt = round.createdAt;
    if (round.updatedAt > existingDealer.updatedAt) existingDealer.updatedAt = round.updatedAt;

    for (const player of round.players) {
      const existingPlayer = playerAgg.get(player.playerId) ?? {
        name: player.name,
        sourcePlayerId: player.sourcePlayerId,
        rounds: 0,
        wins: 0,
        losses: 0,
        betTotal: 0,
        payoutTotal: 0,
        net: 0,
        cashouts: 0,
        createdAt: round.createdAt,
        updatedAt: round.updatedAt,
      };

      existingPlayer.name = player.name;
      existingPlayer.sourcePlayerId = player.sourcePlayerId ?? existingPlayer.sourcePlayerId;
      existingPlayer.rounds += 1;
      existingPlayer.wins += player.won ? 1 : 0;
      existingPlayer.losses += player.won ? 0 : 1;
      existingPlayer.betTotal += player.bet;
      existingPlayer.payoutTotal += player.win;
      existingPlayer.net += player.net;
      existingPlayer.cashouts += player.cashoutMultiplier !== null ? 1 : 0;
      if (round.createdAt < existingPlayer.createdAt) existingPlayer.createdAt = round.createdAt;
      if (round.updatedAt > existingPlayer.updatedAt) existingPlayer.updatedAt = round.updatedAt;
      playerAgg.set(player.playerId, existingPlayer);

      existingDealer.playerWins += player.won ? 1 : 0;
      existingDealer.playerLosses += player.won ? 0 : 1;
    }

    dealerAgg.set(round.dealerKey, existingDealer);
  }

  const playerOps: AnyBulkWriteOperation<AviatorPlayerStatsDoc>[] = Array.from(playerAgg.entries()).map(([playerId, agg]) => ({
    updateOne: {
      filter: { uploaderId: opts.uploaderId, playerId },
      update: {
        $set: {
          sourcePlayerId: agg.sourcePlayerId,
          name: agg.name,
          updatedAt: agg.updatedAt,
        },
        $setOnInsert: {
          uploaderId: opts.uploaderId,
          playerId,
          createdAt: agg.createdAt,
        },
        $inc: {
          rounds: agg.rounds,
          wins: agg.wins,
          losses: agg.losses,
          betTotal: agg.betTotal,
          payoutTotal: agg.payoutTotal,
          net: agg.net,
          cashouts: agg.cashouts,
        },
      },
      upsert: true,
    },
  }));

  const dealerOps: AnyBulkWriteOperation<AviatorDealerStatsDoc>[] = Array.from(dealerAgg.entries()).map(([key, agg]) => ({
    updateOne: {
      filter: { uploaderId: opts.uploaderId, dealerKey: key },
      update: {
        $set: {
          dealer: agg.dealer,
          dealerHomeworld: agg.dealerHomeworld,
          updatedAt: agg.updatedAt,
        },
        $setOnInsert: {
          uploaderId: opts.uploaderId,
          dealerKey: key,
          createdAt: agg.createdAt,
        },
        $inc: {
          roundsHosted: agg.roundsHosted,
          playerCount: agg.playerCount,
          playerWins: agg.playerWins,
          playerLosses: agg.playerLosses,
          betTotal: agg.betTotal,
          payoutTotal: agg.payoutTotal,
          dealerProfit: agg.dealerProfit,
        },
      },
      upsert: true,
    },
  }));

  if (playerOps.length) await opts.db.collection<AviatorPlayerStatsDoc>("aviator_stats_player").bulkWrite(playerOps, { ordered: false });
  if (dealerOps.length) await opts.db.collection<AviatorDealerStatsDoc>("aviator_stats_dealer").bulkWrite(dealerOps, { ordered: false });
}

export async function ingestAviatorPayloads(opts: {
  db: Db;
  uploaderId: string;
  payloads: AviatorImportPayload[];
}) {
  const now = new Date();
  const rounds: AviatorRoundDoc[] = [];
  const games: AviatorGameDoc[] = [];
  const statsSnapshots: AviatorStatsSnapshotDoc[] = [];
  let invalid = 0;

  for (const payload of opts.payloads) {
    if (isAviatorLiveRoundPayload(payload)) {
      const round = normalizeLiveRound(payload, now);
      if (!round) {
        invalid += 1;
        continue;
      }
      rounds.push({ ...round, uploaderId: opts.uploaderId });
      continue;
    }

    if (!isAviatorArchivePayload(payload)) {
      invalid += 1;
      continue;
    }

    const statsSnapshot = normalizeStatsSnapshot(payload, now);
    if (statsSnapshot) statsSnapshots.push({ ...statsSnapshot, uploaderId: opts.uploaderId });

    const archiveGames = Array.isArray(payload.archive)
      ? payload.archive
          .map((item) => normalizeArchiveGameSummary(payload, item, now))
          .filter((item): item is AviatorGameDoc => Boolean(item))
      : [];

    const detailedGames = Array.isArray(payload.game_archives)
      ? payload.game_archives
          .map((item) => normalizeGameArchive(payload, item, now))
          .filter((item): item is AviatorGameDoc => Boolean(item))
      : [];

    for (const game of uniqueGames([...archiveGames, ...detailedGames])) {
      const doc = { ...game, uploaderId: opts.uploaderId };
      games.push(doc);

      if (Array.isArray(doc.rounds)) {
        for (const rawRound of doc.rounds) {
          const round = normalizeArchiveRound(payload, doc, rawRound, now);
          if (round) rounds.push({ ...round, uploaderId: opts.uploaderId });
        }
      }
    }
  }

  const aviatorRounds = opts.db.collection<AviatorRoundDoc>("aviator_rounds");
  const aviatorGames = opts.db.collection<AviatorGameDoc>("aviator_games");
  const aviatorStats = opts.db.collection<AviatorStatsSnapshotDoc>("aviator_stats");

  const normalizedRounds = uniqueRounds(rounds);
  const normalizedGames = uniqueGames(games);

  let insertedRounds: AviatorRoundDoc[] = [];
  let roundResult: { upsertedCount?: number; matchedCount?: number; modifiedCount?: number } | null = null;
  if (normalizedRounds.length) {
    const result = await aviatorRounds.bulkWrite(roundUpsertOps(normalizedRounds), { ordered: false });
    roundResult = result;
    insertedRounds = collectUpsertedDocs(normalizedRounds, result);
    await updatePlayerIdentity({ db: opts.db, uploaderId: opts.uploaderId, rounds: normalizedRounds });
    await incrementRoundStats({ db: opts.db, uploaderId: opts.uploaderId, rounds: insertedRounds });
  }

  let gameResult: { upsertedCount?: number; matchedCount?: number; modifiedCount?: number } | null = null;
  if (normalizedGames.length) {
    gameResult = await aviatorGames.bulkWrite(gameUpsertOps(normalizedGames), { ordered: false });
  }

  let statsResult: { upsertedCount?: number; matchedCount?: number; modifiedCount?: number } | null = null;
  if (statsSnapshots.length) {
    statsResult = await aviatorStats.bulkWrite(statsSnapshotUpsertOps(statsSnapshots), { ordered: false });
  }

  return {
    ok: true as const,
    invalid,
    rounds: {
      inserted: roundResult?.upsertedCount ?? 0,
      updated: roundResult?.matchedCount ?? 0,
      modified: roundResult?.modifiedCount ?? 0,
    },
    games: {
      inserted: gameResult?.upsertedCount ?? 0,
      updated: gameResult?.matchedCount ?? 0,
      modified: gameResult?.modifiedCount ?? 0,
    },
    stats: {
      inserted: statsResult?.upsertedCount ?? 0,
      updated: statsResult?.matchedCount ?? 0,
      modified: statsResult?.modifiedCount ?? 0,
    },
    count: opts.payloads.length,
  };
}
