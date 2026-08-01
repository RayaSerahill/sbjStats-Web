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
  playerWins: number;
  playerLosses: number;
  cashouts: number;
  players?: unknown[];
  rounds?: unknown[];
  adjustments?: unknown[];
  playerStatsSource?: "rounds" | "game_players" | "none";
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
  createdAt: Date;
  updatedAt: Date;
};

type AviatorPlayerDoc = {
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

type AviatorPlayerAggregate = Omit<AviatorPlayerDoc, "uploaderId">;

type AviatorGamePlayerAggregate = {
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

function recordValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function nestedRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function nestedArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

const PLAYER_NAME_KEYS = ["name", "player_name", "playerName", "character_name", "characterName", "character", "player"];

function normalizePlayerNameValue(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return normalizeString(recordValue(nestedRecord(value), PLAYER_NAME_KEYS));
  }

  return normalizeString(value);
}

function playerNameFromRecord(record: Record<string, unknown>) {
  for (const key of PLAYER_NAME_KEYS) {
    const name = normalizePlayerNameValue(record[key]);
    if (name) return name;
  }
  return undefined;
}

function firstFiniteNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = normalizeNumber(record[key], Number.NaN);
    if (Number.isFinite(value)) return value;
  }
  return Number.NaN;
}

function firstFiniteInt(record: Record<string, unknown>, keys: string[]) {
  const value = firstFiniteNumber(record, keys);
  return Number.isFinite(value) ? Math.trunc(value) : Number.NaN;
}

function summarizeAviatorBets(value: unknown) {
  const bets = nestedArray(value);

  return bets.reduce(
    (acc, item) => {
      const bet = nestedRecord(item);
      if (!Object.keys(bet).length) return acc;

      const betAmount = firstFiniteInt(bet, ["bet_amount", "betAmount", "bet", "amount", "stake", "staked"]);
      const payoutAmount = firstFiniteInt(bet, ["payout_amount", "payoutAmount", "payout", "win", "won"]);
      const netResult = firstFiniteInt(bet, ["net_result", "netResult", "net", "profit"]);
      const cashoutMultiplier = firstFiniteNumber(bet, ["cashout_multiplier", "cashoutMultiplier", "multiplier", "cashout"]);

      acc.rounds += 1;
      acc.betTotal += Number.isFinite(betAmount) ? betAmount : 0;
      acc.payoutTotal += Number.isFinite(payoutAmount) ? payoutAmount : 0;
      acc.net += Number.isFinite(netResult)
        ? netResult
        : (Number.isFinite(payoutAmount) ? payoutAmount : 0) - (Number.isFinite(betAmount) ? betAmount : 0);

      const cashedOut = Number.isFinite(cashoutMultiplier) || (Number.isFinite(payoutAmount) && payoutAmount > 0);
      acc.cashouts += cashedOut ? 1 : 0;
      acc.wins += cashedOut ? 1 : 0;
      return acc;
    },
    { rounds: 0, wins: 0, betTotal: 0, payoutTotal: 0, net: 0, cashouts: 0 }
  );
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

  const player = value as Record<string, unknown>;
  const name = playerNameFromRecord(player);
  if (!name) return null;

  const sourcePlayerId = normalizeString(recordValue(player, ["player_id", "playerId", "id"]));
  const bet = normalizeInt(recordValue(player, ["bet", "bet_amount", "betAmount", "total_staked", "totalStaked", "total_bet", "totalBet", "total_bets", "totalBets", "betTotal", "bet_total"]));
  const win = normalizeInt(recordValue(player, ["win", "payout", "payout_amount", "payoutAmount", "total_won", "totalWon", "total_win", "totalWin", "total_wins", "totalWins", "total_payout", "totalPayout", "total_payouts", "totalPayouts", "payoutTotal", "payout_total"]));
  const netValue = recordValue(player, ["net", "net_result", "netResult", "net_profit", "netProfit", "profit"]);
  const net = Number.isFinite(normalizeNumber(netValue, Number.NaN))
    ? normalizeInt(netValue)
    : win - bet;
  const cashoutMultiplierValue = recordValue(player, ["cashout_multiplier", "cashoutMultiplier", "multiplier", "cashout"]);
  const cashoutMultiplier = Number.isFinite(normalizeNumber(cashoutMultiplierValue, Number.NaN))
    ? normalizeNumber(cashoutMultiplierValue)
    : null;

  return {
    playerId: playerIdFromParts(sourcePlayerId, name),
    ...(sourcePlayerId ? { sourcePlayerId } : {}),
    name,
    ...(Number.isFinite(normalizeNumber(recordValue(player, ["slot", "seat"]), Number.NaN)) ? { slot: normalizeInt(recordValue(player, ["slot", "seat"])) } : {}),
    bet,
    cashoutMultiplier,
    win,
    net,
    won: normalizeBoolean(recordValue(player, ["won", "win_status", "winStatus", "result"])) || win > bet,
  };
}

function normalizeGamePlayerAggregate(value: unknown, now: Date): AviatorGamePlayerAggregate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const player = value as Record<string, unknown>;
  const totals = nestedRecord(player.totals ?? player.stats);
  const name = playerNameFromRecord(player);
  if (!name) return null;

  const sourcePlayerId = normalizeString(recordValue(player, ["player_id", "playerId", "id"]));
  const betSummary = summarizeAviatorBets(player.bets);

  const explicitRounds = firstFiniteInt(player, ["rounds", "rounds_played", "roundsPlayed", "total_rounds", "totalRounds", "plays"]);
  const totalsRounds = firstFiniteInt(totals, ["rounds", "rounds_played", "roundsPlayed", "total_rounds", "totalRounds"]);
  const rounds = Math.max(0, Number.isFinite(explicitRounds) ? explicitRounds : Number.isFinite(totalsRounds) ? totalsRounds : betSummary.rounds);

  const explicitWins = firstFiniteInt(player, ["wins", "rounds_won", "roundsWon", "cashouts", "total_cashouts", "totalCashouts"]);
  const totalsWins = firstFiniteInt(totals, ["wins", "rounds_won", "roundsWon", "cashouts", "total_cashouts", "totalCashouts"]);
  const wins = Math.max(0, Number.isFinite(explicitWins) ? explicitWins : Number.isFinite(totalsWins) ? totalsWins : betSummary.wins);

  const explicitLosses = firstFiniteInt(player, ["losses", "rounds_lost", "roundsLost", "crashes"]);
  const totalsLosses = firstFiniteInt(totals, ["losses", "rounds_lost", "roundsLost", "crashes"]);
  const losses = Number.isFinite(explicitLosses)
    ? Math.max(0, explicitLosses)
    : Number.isFinite(totalsLosses)
      ? Math.max(0, totalsLosses)
      : Math.max(0, rounds - wins);

  const explicitBetTotal = firstFiniteInt(player, ["betTotal", "bet_total", "total_staked", "totalStaked", "total_bets", "totalBets", "total_bet", "totalBet", "total_wagered", "totalWagered"]);
  const totalsBetTotal = firstFiniteInt(totals, ["betTotal", "bet_total", "total_staked", "totalStaked", "total_bets", "totalBets", "total_bet", "totalBet", "total_wagered", "totalWagered"]);
  const betTotal = Number.isFinite(explicitBetTotal)
    ? explicitBetTotal
    : Number.isFinite(totalsBetTotal)
      ? totalsBetTotal
      : betSummary.betTotal;

  const explicitPayoutTotal = firstFiniteInt(player, ["payoutTotal", "payout_total", "total_won", "totalWon", "total_payouts", "totalPayouts", "total_payout", "totalPayout", "total_wins", "totalWins", "total_win", "totalWin"]);
  const totalsPayoutTotal = firstFiniteInt(totals, ["payoutTotal", "payout_total", "total_won", "totalWon", "total_payouts", "totalPayouts", "total_payout", "totalPayout", "total_wins", "totalWins", "total_win", "totalWin"]);
  const payoutTotal = Number.isFinite(explicitPayoutTotal)
    ? explicitPayoutTotal
    : Number.isFinite(totalsPayoutTotal)
      ? totalsPayoutTotal
      : betSummary.payoutTotal;

  const explicitNet = firstFiniteInt(player, ["net", "net_profit", "netProfit", "profit", "player_profit", "playerProfit"]);
  const totalsNet = firstFiniteInt(totals, ["net", "net_profit", "netProfit", "profit", "player_profit", "playerProfit"]);
  const net = Number.isFinite(explicitNet)
    ? explicitNet
    : Number.isFinite(totalsNet)
      ? totalsNet
      : betSummary.rounds > 0
        ? betSummary.net
        : payoutTotal - betTotal;

  const explicitCashouts = firstFiniteInt(player, ["cashouts", "total_cashouts", "totalCashouts"]);
  const totalsCashouts = firstFiniteInt(totals, ["cashouts", "total_cashouts", "totalCashouts"]);
  const cashouts = Math.max(
    0,
    Number.isFinite(explicitCashouts) ? explicitCashouts : Number.isFinite(totalsCashouts) ? totalsCashouts : betSummary.cashouts
  );

  return {
    playerId: playerIdFromParts(sourcePlayerId, name),
    ...(sourcePlayerId ? { sourcePlayerId } : {}),
    name,
    rounds,
    wins,
    losses,
    betTotal,
    payoutTotal,
    net,
    cashouts,
    createdAt: now,
    updatedAt: now,
  };
}

function summarizeGamePlayerAggregates(players: AviatorGamePlayerAggregate[]) {
  return players.reduce(
    (acc, player) => {
      acc.rounds += player.rounds;
      acc.wins += player.wins;
      acc.losses += player.losses;
      acc.betTotal += player.betTotal;
      acc.payoutTotal += player.payoutTotal;
      acc.net += player.net;
      acc.cashouts += player.cashouts;
      return acc;
    },
    { rounds: 0, wins: 0, losses: 0, betTotal: 0, payoutTotal: 0, net: 0, cashouts: 0 }
  );
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
    playerWins: 0,
    playerLosses: 0,
    cashouts: 0,
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
  const startedAt = normalizeDate(item.created_at);
  const players = Array.isArray(item.players) ? item.players : [];
  const playerAggregates = players
    .map((player) => normalizeGamePlayerAggregate(player, startedAt ?? now))
    .filter((player): player is AviatorGamePlayerAggregate => Boolean(player));
  const playerSummary = summarizeGamePlayerAggregates(playerAggregates);
  const totalBetsRaw = firstFiniteInt(totals, ["total_bets", "totalBets", "betTotal", "bet_total", "total_staked", "totalStaked"]);
  const totalPayoutsRaw = firstFiniteInt(totals, ["total_payouts", "totalPayouts", "payoutTotal", "payout_total", "total_won", "totalWon"]);
  const dealerProfitRaw = firstFiniteInt(totals, ["dealer_profit", "dealerProfit", "profit"]);
  const totalBets = Number.isFinite(totalBetsRaw) ? totalBetsRaw : playerSummary.betTotal;
  const totalPayouts = Number.isFinite(totalPayoutsRaw) ? totalPayoutsRaw : playerSummary.payoutTotal;

  return {
    uploaderId: "",
    source: normalizeString(payload.source),
    archivedAt: normalizeUnixSeconds(payload.archived_at),
    gameId,
    theme: normalizeString(item.theme),
    startedAt,
    finalStatus: normalizeString(item.final_status),
    dealerName: normalizeString(item.dealer_name) ?? normalizeString(payload.dealer),
    dealerHomeworld: normalizeString(item.dealer_homeworld),
    totalRounds: Number.isFinite(firstFiniteInt(totals, ["rounds", "total_rounds", "totalRounds"]))
      ? firstFiniteInt(totals, ["rounds", "total_rounds", "totalRounds"])
      : playerSummary.rounds,
    totalPlayers: Number.isFinite(firstFiniteInt(totals, ["players", "total_players", "totalPlayers"]))
      ? firstFiniteInt(totals, ["players", "total_players", "totalPlayers"])
      : playerAggregates.length,
    totalBets,
    totalPayouts,
    totalAdjustments: normalizeInt(totals.total_adjustments),
    dealerProfit: Number.isFinite(dealerProfitRaw)
      ? dealerProfitRaw
      : totalBets - totalPayouts,
    playerWins: playerSummary.wins,
    playerLosses: playerSummary.losses,
    cashouts: playerSummary.cashouts,
    players,
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
          playerWins: game.playerWins,
          playerLosses: game.playerLosses,
          cashouts: game.cashouts,
          players: game.players,
          rounds: game.rounds,
          adjustments: game.adjustments,
          playerStatsSource: game.playerStatsSource,
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

function roundKey(round: Pick<AviatorRoundDoc, "gameId" | "roundNumber">) {
  return `${round.gameId}:${round.roundNumber}`;
}

function gameKey(game: Pick<AviatorGameDoc, "gameId">) {
  return game.gameId;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function addRoundPlayerStats(target: Map<string, AviatorPlayerAggregate>, round: AviatorRoundDoc, sign: 1 | -1) {
  for (const player of round.players) {
    const existing = target.get(player.playerId) ?? {
      playerId: player.playerId,
      sourcePlayerId: player.sourcePlayerId,
      name: player.name,
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

    if (sign > 0) {
      existing.name = player.name;
      existing.sourcePlayerId = player.sourcePlayerId ?? existing.sourcePlayerId;
    }

    existing.rounds += sign;
    existing.wins += sign * (player.won ? 1 : 0);
    existing.losses += sign * (player.won ? 0 : 1);
    existing.betTotal += sign * player.bet;
    existing.payoutTotal += sign * player.win;
    existing.net += sign * player.net;
    existing.cashouts += sign * (player.cashoutMultiplier !== null ? 1 : 0);
    if (round.createdAt < existing.createdAt) existing.createdAt = round.createdAt;
    if (round.updatedAt > existing.updatedAt) existing.updatedAt = round.updatedAt;

    target.set(player.playerId, existing);
  }
}

function addGamePlayerStats(target: Map<string, AviatorPlayerAggregate>, player: AviatorGamePlayerAggregate, sign: 1 | -1) {
  const existing = target.get(player.playerId) ?? {
    playerId: player.playerId,
    sourcePlayerId: player.sourcePlayerId,
    name: player.name,
    rounds: 0,
    wins: 0,
    losses: 0,
    betTotal: 0,
    payoutTotal: 0,
    net: 0,
    cashouts: 0,
    createdAt: player.createdAt,
    updatedAt: player.updatedAt,
  };

  if (sign > 0) {
    existing.name = player.name;
    existing.sourcePlayerId = player.sourcePlayerId ?? existing.sourcePlayerId;
  }

  existing.rounds += sign * player.rounds;
  existing.wins += sign * player.wins;
  existing.losses += sign * player.losses;
  existing.betTotal += sign * player.betTotal;
  existing.payoutTotal += sign * player.payoutTotal;
  existing.net += sign * player.net;
  existing.cashouts += sign * player.cashouts;
  if (player.createdAt < existing.createdAt) existing.createdAt = player.createdAt;
  if (player.updatedAt > existing.updatedAt) existing.updatedAt = player.updatedAt;

  target.set(player.playerId, existing);
}

function gamePlayerAggregates(game: AviatorGameDoc) {
  if (!Array.isArray(game.players)) return [];

  return game.players
    .map((player) => normalizeGamePlayerAggregate(player, game.startedAt ?? game.createdAt))
    .filter((player): player is AviatorGamePlayerAggregate => Boolean(player));
}

async function loadExistingRounds(opts: { db: Db; uploaderId: string; rounds: AviatorRoundDoc[] }) {
  const existing = new Map<string, AviatorRoundDoc>();
  const aviatorRounds = opts.db.collection<AviatorRoundDoc>("aviator_rounds");

  for (const batch of chunk(opts.rounds, 500)) {
    const rows = await aviatorRounds
      .find({
        uploaderId: opts.uploaderId,
        $or: batch.map((round) => ({ gameId: round.gameId, roundNumber: round.roundNumber })),
      })
      .toArray();

    for (const round of rows) {
      existing.set(roundKey(round), round);
    }
  }

  return existing;
}

async function loadExistingGames(opts: { db: Db; uploaderId: string; games: AviatorGameDoc[] }) {
  const existing = new Map<string, AviatorGameDoc>();
  const aviatorGames = opts.db.collection<AviatorGameDoc>("aviator_games");
  const gameIds = Array.from(new Set(opts.games.map((game) => game.gameId).filter(Boolean)));

  for (const batch of chunk(gameIds, 500)) {
    const rows = await aviatorGames
      .find({
        uploaderId: opts.uploaderId,
        gameId: { $in: batch },
      })
      .toArray();

    for (const game of rows) {
      existing.set(gameKey(game), game);
    }
  }

  return existing;
}

function hasInitializedPlayerStats(player: Partial<AviatorPlayerDoc>) {
  return (
    typeof player.rounds === "number" &&
    typeof player.wins === "number" &&
    typeof player.losses === "number" &&
    typeof player.betTotal === "number" &&
    typeof player.payoutTotal === "number" &&
    typeof player.net === "number" &&
    typeof player.cashouts === "number"
  );
}

async function loadInitializedPlayerIds(opts: { db: Db; uploaderId: string; playerIds: string[] }) {
  const initialized = new Set<string>();
  const aviatorPlayers = opts.db.collection<Partial<AviatorPlayerDoc>>("aviator_players");

  for (const batch of chunk(opts.playerIds, 1000)) {
    const rows = await aviatorPlayers
      .find(
        {
          uploaderId: opts.uploaderId,
          playerId: { $in: batch },
        },
        { projection: { playerId: 1, rounds: 1, wins: 1, losses: 1, betTotal: 1, payoutTotal: 1, net: 1, cashouts: 1 } }
      )
      .toArray();

    for (const row of rows) {
      if (typeof row.playerId === "string" && hasInitializedPlayerStats(row)) initialized.add(row.playerId);
    }
  }

  return initialized;
}

async function updateAviatorPlayersFromRounds(opts: {
  db: Db;
  uploaderId: string;
  rounds: AviatorRoundDoc[];
  existingRounds: Map<string, AviatorRoundDoc>;
}) {
  if (opts.rounds.length === 0) return;

  const currentStats = new Map<string, AviatorPlayerAggregate>();
  const deltaStats = new Map<string, AviatorPlayerAggregate>();

  for (const round of opts.rounds) {
    const previous = opts.existingRounds.get(roundKey(round));
    if (previous) addRoundPlayerStats(deltaStats, previous, -1);
    addRoundPlayerStats(deltaStats, round, 1);
    addRoundPlayerStats(currentStats, round, 1);
  }

  const currentPlayerIds = Array.from(currentStats.keys());
  const initializedPlayerIds = await loadInitializedPlayerIds({
    db: opts.db,
    uploaderId: opts.uploaderId,
    playerIds: currentPlayerIds,
  });

  const playerIds = new Set([...deltaStats.keys(), ...currentStats.keys()]);
  const ops: AnyBulkWriteOperation<AviatorPlayerDoc>[] = [];

  for (const playerId of playerIds) {
    const current = currentStats.get(playerId);
    const delta = current && !initializedPlayerIds.has(playerId) ? current : deltaStats.get(playerId);
    const identity = current ?? delta;
    if (!delta || !identity) continue;

    ops.push({
      updateOne: {
        filter: { uploaderId: opts.uploaderId, playerId },
        update: {
          $set: {
            sourcePlayerId: identity.sourcePlayerId,
            name: identity.name,
            updatedAt: identity.updatedAt,
          },
          $setOnInsert: {
            uploaderId: opts.uploaderId,
            playerId,
            createdAt: identity.createdAt,
          },
          $inc: {
            rounds: delta.rounds,
            wins: delta.wins,
            losses: delta.losses,
            betTotal: delta.betTotal,
            payoutTotal: delta.payoutTotal,
            net: delta.net,
            cashouts: delta.cashouts,
          },
        },
        upsert: Boolean(current),
      },
    });
  }

  if (ops.length) await opts.db.collection<AviatorPlayerDoc>("aviator_players").bulkWrite(ops, { ordered: false });
}

async function updateAviatorPlayersFromGamePlayers(opts: {
  db: Db;
  uploaderId: string;
  games: AviatorGameDoc[];
  existingGames: Map<string, AviatorGameDoc>;
}) {
  if (opts.games.length === 0) return;

  const currentStats = new Map<string, AviatorPlayerAggregate>();
  const deltaStats = new Map<string, AviatorPlayerAggregate>();

  for (const game of opts.games) {
    const previous = opts.existingGames.get(gameKey(game));

    if (previous?.playerStatsSource === "game_players") {
      for (const player of gamePlayerAggregates(previous)) addGamePlayerStats(deltaStats, player, -1);
    }

    if (game.playerStatsSource !== "game_players") continue;

    for (const player of gamePlayerAggregates(game)) {
      addGamePlayerStats(deltaStats, player, 1);
      addGamePlayerStats(currentStats, player, 1);
    }
  }

  const currentPlayerIds = Array.from(currentStats.keys());
  const initializedPlayerIds = await loadInitializedPlayerIds({
    db: opts.db,
    uploaderId: opts.uploaderId,
    playerIds: currentPlayerIds,
  });

  const playerIds = new Set([...deltaStats.keys(), ...currentStats.keys()]);
  const ops: AnyBulkWriteOperation<AviatorPlayerDoc>[] = [];

  for (const playerId of playerIds) {
    const current = currentStats.get(playerId);
    const delta = current && !initializedPlayerIds.has(playerId) ? current : deltaStats.get(playerId);
    const identity = current ?? delta;
    if (!delta || !identity) continue;

    ops.push({
      updateOne: {
        filter: { uploaderId: opts.uploaderId, playerId },
        update: {
          $set: {
            sourcePlayerId: identity.sourcePlayerId,
            name: identity.name,
            updatedAt: identity.updatedAt,
          },
          $setOnInsert: {
            uploaderId: opts.uploaderId,
            playerId,
            createdAt: identity.createdAt,
          },
          $inc: {
            rounds: delta.rounds,
            wins: delta.wins,
            losses: delta.losses,
            betTotal: delta.betTotal,
            payoutTotal: delta.payoutTotal,
            net: delta.net,
            cashouts: delta.cashouts,
          },
        },
        upsert: Boolean(current),
      },
    });
  }

  if (ops.length) await opts.db.collection<AviatorPlayerDoc>("aviator_players").bulkWrite(ops, { ordered: false });
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
  const gameIdsWithRoundPlayers = new Set(
    normalizedRounds.filter((round) => round.players.length > 0).map((round) => round.gameId)
  );
  const normalizedGames = uniqueGames(games).map((game) => {
    if (gameIdsWithRoundPlayers.has(game.gameId)) {
      return { ...game, playerStatsSource: "rounds" as const };
    }

    return {
      ...game,
      playerStatsSource: gamePlayerAggregates(game).length > 0 ? ("game_players" as const) : ("none" as const),
    };
  });

  let roundResult: { upsertedCount?: number; matchedCount?: number; modifiedCount?: number } | null = null;
  if (normalizedRounds.length) {
    const existingRounds = await loadExistingRounds({
      db: opts.db,
      uploaderId: opts.uploaderId,
      rounds: normalizedRounds,
    });
    const result = await aviatorRounds.bulkWrite(roundUpsertOps(normalizedRounds), { ordered: false });
    roundResult = result;
    await updateAviatorPlayersFromRounds({
      db: opts.db,
      uploaderId: opts.uploaderId,
      rounds: normalizedRounds,
      existingRounds,
    });
  }

  let gameResult: { upsertedCount?: number; matchedCount?: number; modifiedCount?: number } | null = null;
  if (normalizedGames.length) {
    const existingGames = await loadExistingGames({
      db: opts.db,
      uploaderId: opts.uploaderId,
      games: normalizedGames,
    });
    gameResult = await aviatorGames.bulkWrite(gameUpsertOps(normalizedGames), { ordered: false });
    await updateAviatorPlayersFromGamePlayers({
      db: opts.db,
      uploaderId: opts.uploaderId,
      games: normalizedGames,
      existingGames,
    });
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
