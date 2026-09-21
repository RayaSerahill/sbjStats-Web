import { parseFormattedGilPrizeValue } from "@/lib/scratchPrizes";
import { wheelPrizeValueFromSegments, type NormalizedWheelSegment } from "@/lib/wheelPresets";

/**
 * Pure stats for the public wheel page. Mirrors the Scratch page's shape
 * (totals, last hosting day, daily series, players, prizes) so the two
 * pages can share a layout.
 */
export type WheelStatsGameRow = {
  _id?: unknown;
  playerName?: string;
  archivedAt?: number;
  preset?: string;
  presetId?: unknown;
  maxSpins?: number;
  spinsUsed?: number;
  spinsPaid?: number;
  spinCost?: number;
  prizesWon?: string[];
};

export type WheelStatsPresetRow = {
  _id?: unknown;
  name?: string;
  version?: number;
  segments?: NormalizedWheelSegment[];
};

export type WheelStatsPrizeRow = {
  prize?: string;
  value?: number | null;
};

export type WheelStatsAliasRow = {
  primaryTag?: string;
  aliasTag?: string;
};

export type WheelStatsInput = {
  games: WheelStatsGameRow[];
  presets: WheelStatsPresetRow[];
  prizes: WheelStatsPrizeRow[];
  aliases: WheelStatsAliasRow[];
};

export type WheelStatsPrize = {
  name: string;
  /** Times this prize was won. */
  value: number;
  prizeValue: number;
  totalWinValue: number;
};

export type WheelStatsPlayer = {
  name: string;
  totalGames: number;
  totalSpins: number;
  /** Gil actually walked away with, after bankrupts wiped the pot. */
  totalWinValue: number;
  /** Times the wheel landed on a bankrupt segment. */
  bankrupts: number;
  /** Gil that was in the pot when a bankrupt wiped it. */
  lostToBankrupt: number;
  prizes: WheelStatsPrize[];
};

export type WheelStatsSummary = {
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
};

export type WheelStatsDaily = WheelStatsSummary & { date: string };

export type WheelStats = WheelStatsSummary & {
  bankrupts: number;
  lostToBankrupt: number;
  new: WheelStatsSummary;
  dailyProfits: WheelStatsDaily[];
  players: WheelStatsPlayer[];
  prizes: WheelStatsPrize[];
};

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveWheelAliasName(input: string, aliasToPrimary: Map<string, string>) {
  let current = input.trim();
  const seen = new Set<string>();

  while (aliasToPrimary.has(norm(current)) && !seen.has(norm(current))) {
    const key = norm(current);
    seen.add(key);
    current = aliasToPrimary.get(key) ?? current;
  }

  return current;
}

export function toUtcDayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Spins a game actually took: the live count when we have it, else one per prize landed. */
export function wheelGameSpins(game: WheelStatsGameRow): number {
  if (typeof game.spinsUsed === "number" && Number.isFinite(game.spinsUsed)) return Math.max(0, game.spinsUsed);
  return Array.isArray(game.prizesWon) ? game.prizesWon.length : 0;
}

/**
 * Value of one prize label for one game. A dealer-set override in
 * wheel_prizes wins; otherwise the preset version the game is linked to
 * decides; "1M gil"-style labels value themselves; everything else
 * (multipliers, free spins, mounts) is 0.
 */
export function wheelPrizeValue(
  label: string,
  segments: NormalizedWheelSegment[] | undefined,
  configured: Map<string, number>
): number {
  const name = label.trim();
  if (!name) return 0;

  const fromConfig = configured.get(name);
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig)) return fromConfig;

  if (segments) {
    const fromPreset = wheelPrizeValueFromSegments(segments, name);
    if (fromPreset !== null) return fromPreset;
  }

  return parseFormattedGilPrizeValue(name) ?? 0;
}

/**
 * Whether one landed prize is a bankrupt. The linked preset version
 * knows for sure; games with no preset fall back to the label saying so.
 */
export function wheelPrizeIsBankrupt(label: string, segments: NormalizedWheelSegment[] | undefined): boolean {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return false;
  const seg = segments?.find((s) => s.label.trim().toLowerCase() === wanted);
  if (seg) return seg.bankrupt;
  return /bankrupt/.test(wanted);
}

function sortPrizes(a: WheelStatsPrize, b: WheelStatsPrize) {
  if (b.value !== a.value) return b.value - a.value;
  if (b.totalWinValue !== a.totalWinValue) return b.totalWinValue - a.totalWinValue;
  return a.name.localeCompare(b.name);
}

export function calculateWheelStats(input: WheelStatsInput): WheelStats {
  const aliasToPrimary = new Map<string, string>();
  for (const alias of input.aliases) {
    const primary = String(alias.primaryTag ?? "").trim();
    const aliasName = String(alias.aliasTag ?? "").trim();
    if (!primary || !aliasName || norm(primary) === norm(aliasName)) continue;
    aliasToPrimary.set(norm(aliasName), primary);
  }

  const configuredPrizeValues = new Map<string, number>();
  for (const prize of input.prizes) {
    const name = String(prize.prize ?? "").trim();
    if (!name) continue;
    if (typeof prize.value === "number" && Number.isFinite(prize.value)) {
      configuredPrizeValues.set(name, prize.value);
    }
  }

  const segmentsByPresetId = new Map<string, NormalizedWheelSegment[]>();
  for (const preset of input.presets) {
    if (preset._id === undefined || preset._id === null) continue;
    segmentsByPresetId.set(String(preset._id), Array.isArray(preset.segments) ? preset.segments : []);
  }

  let newestDayKey: string | null = null;
  for (const game of input.games) {
    const archivedAt = Number(game.archivedAt ?? 0);
    if (!archivedAt) continue;
    const dayKey = toUtcDayKey(archivedAt);
    if (newestDayKey === null || dayKey > newestDayKey) newestDayKey = dayKey;
  }

  const totals: WheelStatsSummary = { totalGames: 0, totalSpins: 0, totalWinValue: 0 };
  const latest: WheelStatsSummary = { totalGames: 0, totalSpins: 0, totalWinValue: 0 };
  let totalBankrupts = 0;
  let totalLostToBankrupt = 0;
  const dailyMap = new Map<string, WheelStatsDaily>();
  const prizeCounts = new Map<string, { count: number; totalWinValue: number }>();
  const playerMap = new Map<
    string,
    {
      name: string;
      totalGames: number;
      totalSpins: number;
      totalWinValue: number;
      bankrupts: number;
      lostToBankrupt: number;
      prizes: Map<string, { count: number; totalWinValue: number }>;
    }
  >();

  for (const game of input.games) {
    const playerName = resolveWheelAliasName(String(game.playerName ?? "").trim() || "Unknown", aliasToPrimary);
    const playerKey = playerName.toLowerCase();
    const archivedAt = Number(game.archivedAt ?? 0);
    const spins = wheelGameSpins(game);
    const prizesWon = Array.isArray(game.prizesWon) ? game.prizesWon : [];
    const segments = game.presetId !== undefined && game.presetId !== null ? segmentsByPresetId.get(String(game.presetId)) : undefined;

    const player = playerMap.get(playerKey) ?? {
      name: playerName,
      totalGames: 0,
      totalSpins: 0,
      totalWinValue: 0,
      bankrupts: 0,
      lostToBankrupt: 0,
      prizes: new Map(),
    };

    // Prizes are in spin order. A bankrupt empties whatever the pot held
    // so far; spins after it start filling a fresh pot.
    let gameWinValue = 0;
    let gameBankrupts = 0;
    let gameLost = 0;
    for (const rawPrize of prizesWon) {
      const name = String(rawPrize ?? "").trim();
      if (!name) continue;
      const bankrupt = wheelPrizeIsBankrupt(name, segments);
      const value = bankrupt ? 0 : wheelPrizeValue(name, segments, configuredPrizeValues);
      if (bankrupt) {
        gameBankrupts += 1;
        gameLost += gameWinValue;
        gameWinValue = 0;
      } else {
        gameWinValue += value;
      }

      const total = prizeCounts.get(name) ?? { count: 0, totalWinValue: 0 };
      total.count += 1;
      total.totalWinValue += value;
      prizeCounts.set(name, total);

      const mine = player.prizes.get(name) ?? { count: 0, totalWinValue: 0 };
      mine.count += 1;
      mine.totalWinValue += value;
      player.prizes.set(name, mine);
    }

    totals.totalGames += 1;
    totals.totalSpins += spins;
    totals.totalWinValue += gameWinValue;
    totalBankrupts += gameBankrupts;
    totalLostToBankrupt += gameLost;

    player.totalGames += 1;
    player.totalSpins += spins;
    player.totalWinValue += gameWinValue;
    player.bankrupts += gameBankrupts;
    player.lostToBankrupt += gameLost;
    playerMap.set(playerKey, player);

    if (archivedAt) {
      const dayKey = toUtcDayKey(archivedAt);
      const day = dailyMap.get(dayKey) ?? { date: dayKey, totalGames: 0, totalSpins: 0, totalWinValue: 0 };
      day.totalGames += 1;
      day.totalSpins += spins;
      day.totalWinValue += gameWinValue;
      dailyMap.set(dayKey, day);

      if (newestDayKey && dayKey === newestDayKey) {
        latest.totalGames += 1;
        latest.totalSpins += spins;
        latest.totalWinValue += gameWinValue;
      }
    }
  }

  const toPrizeList = (map: Map<string, { count: number; totalWinValue: number }>): WheelStatsPrize[] =>
    Array.from(map.entries())
      .map(([name, { count, totalWinValue }]) => ({
        name,
        value: count,
        prizeValue: count > 0 ? Math.round(totalWinValue / count) : 0,
        totalWinValue,
      }))
      .sort(sortPrizes);

  const players: WheelStatsPlayer[] = Array.from(playerMap.values())
    .map((player) => ({
      name: player.name,
      totalGames: player.totalGames,
      totalSpins: player.totalSpins,
      totalWinValue: player.totalWinValue,
      bankrupts: player.bankrupts,
      lostToBankrupt: player.lostToBankrupt,
      prizes: toPrizeList(player.prizes),
    }))
    .sort((a, b) => {
      if (b.totalWinValue !== a.totalWinValue) return b.totalWinValue - a.totalWinValue;
      if (b.totalSpins !== a.totalSpins) return b.totalSpins - a.totalSpins;
      if (b.totalGames !== a.totalGames) return b.totalGames - a.totalGames;
      return a.name.localeCompare(b.name);
    });

  return {
    ...totals,
    bankrupts: totalBankrupts,
    lostToBankrupt: totalLostToBankrupt,
    new: latest,
    dailyProfits: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    players,
    prizes: toPrizeList(prizeCounts),
  };
}

export type WheelHallOfFameEntry = {
  name: string;
  /** The number the title was earned with (gil, spins or gil per spin). */
  value: number;
};

export type WheelHallOfFame = {
  biggestWinner: WheelHallOfFameEntry | null;
  mostSpins: WheelHallOfFameEntry | null;
  mostGames: WheelHallOfFameEntry | null;
  mostBankrupt: WheelHallOfFameEntry | null;
  luckiestSpinner: WheelHallOfFameEntry | null;
};

/** Spins a player needs before their gil per spin is allowed to count as luck. */
export const LUCKIEST_SPINNER_MIN_SPINS = 5;

function bestBy(players: WheelStatsPlayer[], metric: (player: WheelStatsPlayer) => number): WheelHallOfFameEntry | null {
  let best: WheelHallOfFameEntry | null = null;
  for (const player of players) {
    const value = metric(player);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (!best || value > best.value) best = { name: player.name, value };
  }
  return best;
}

/**
 * The podium for the Fortune layout. Luckiest spinner is gil per spin,
 * limited to players with a few spins so a single lucky spin cannot
 * take the crown; if nobody qualifies, everyone competes.
 */
export function wheelHallOfFame(players: WheelStatsPlayer[]): WheelHallOfFame {
  const seasoned = players.filter((player) => player.totalSpins >= LUCKIEST_SPINNER_MIN_SPINS);
  const perSpin = (player: WheelStatsPlayer) => (player.totalSpins > 0 ? player.totalWinValue / player.totalSpins : 0);

  return {
    biggestWinner: bestBy(players, (player) => player.totalWinValue),
    mostSpins: bestBy(players, (player) => player.totalSpins),
    mostGames: bestBy(players, (player) => player.totalGames),
    mostBankrupt: bestBy(players, (player) => player.bankrupts),
    luckiestSpinner: bestBy(seasoned, perSpin) ?? bestBy(players, perSpin),
  };
}

export type WheelOutcomeSlice = { name: string; count: number };

/**
 * Prize distribution for a donut: the most landed prizes by count, with
 * the long tail folded into "Other".
 */
export function wheelOutcomeSlices(prizes: WheelStatsPrize[], maxSlices = 5): WheelOutcomeSlice[] {
  const sorted = prizes
    .filter((prize) => prize.value > 0)
    .slice()
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  if (sorted.length <= maxSlices) return sorted.map((prize) => ({ name: prize.name, count: prize.value }));

  const head = sorted.slice(0, maxSlices - 1).map((prize) => ({ name: prize.name, count: prize.value }));
  const rest = sorted.slice(maxSlices - 1).reduce((sum, prize) => sum + prize.value, 0);
  return [...head, { name: "Other", count: rest }];
}

/**
 * The last `days` calendar days ending on the newest hosting day, with
 * quiet days filled in as zero so a sparkline has a steady x axis.
 */
export function wheelRecentDays(daily: WheelStatsDaily[], days: number): WheelStatsDaily[] {
  if (!daily.length || days <= 0) return [];
  const byDate = new Map(daily.map((day) => [day.date, day]));
  const newest = daily.reduce((max, day) => (day.date > max ? day.date : max), daily[0].date);
  const end = Date.UTC(Number(newest.slice(0, 4)), Number(newest.slice(5, 7)) - 1, Number(newest.slice(8, 10)));

  const out: WheelStatsDaily[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = toUtcDayKey((end - offset * 86_400_000) / 1000);
    out.push(byDate.get(date) ?? { date, totalGames: 0, totalSpins: 0, totalWinValue: 0 });
  }
  return out;
}
