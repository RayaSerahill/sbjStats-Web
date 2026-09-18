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
  totalWinValue: number;
  prizes: WheelStatsPrize[];
};

export type WheelStatsSummary = {
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
};

export type WheelStatsDaily = WheelStatsSummary & { date: string };

export type WheelStats = WheelStatsSummary & {
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
 * Value of one prize label for one game. The linked preset version knows
 * best; a dealer-configured prize value comes next; "1M gil"-style labels
 * value themselves; everything else (multipliers, free spins, mounts) is 0.
 */
export function wheelPrizeValue(
  label: string,
  segments: NormalizedWheelSegment[] | undefined,
  configured: Map<string, number>
): number {
  const name = label.trim();
  if (!name) return 0;

  if (segments) {
    const fromPreset = wheelPrizeValueFromSegments(segments, name);
    if (fromPreset !== null) return fromPreset;
  }

  const fromConfig = configured.get(name);
  if (typeof fromConfig === "number" && Number.isFinite(fromConfig)) return fromConfig;

  return parseFormattedGilPrizeValue(name) ?? 0;
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
  const dailyMap = new Map<string, WheelStatsDaily>();
  const prizeCounts = new Map<string, { count: number; totalWinValue: number }>();
  const playerMap = new Map<
    string,
    { name: string; totalGames: number; totalSpins: number; totalWinValue: number; prizes: Map<string, { count: number; totalWinValue: number }> }
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
      prizes: new Map(),
    };

    let gameWinValue = 0;
    for (const rawPrize of prizesWon) {
      const name = String(rawPrize ?? "").trim();
      if (!name) continue;
      const value = wheelPrizeValue(name, segments, configuredPrizeValues);
      gameWinValue += value;

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

    player.totalGames += 1;
    player.totalSpins += spins;
    player.totalWinValue += gameWinValue;
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
    new: latest,
    dailyProfits: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
    players,
    prizes: toPrizeList(prizeCounts),
  };
}
