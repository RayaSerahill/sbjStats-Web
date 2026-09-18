import type { Db, AnyBulkWriteOperation } from "mongodb";
import { normalizeScratchPrizeName, parseFormattedGilPrizeValue } from "@/lib/scratchPrizes";

/**
 * SimpleWheel upload contract (see the SimpleStats plugin docs).
 *
 * The plugin posts either one record (live, right after a game's last spin)
 * or an array of records (archive snapshot). Archive rows are pre-renamed by
 * the plugin so both share this shape. Archive rows never carry
 * `player_homeworld`, `spins_used` or `dealer`, so a live record is always
 * the richer one and must win when both exist for the same `game_uuid`.
 *
 * SimpleWheel's IPC is additive: unknown extra fields are passed through by
 * the plugin and must be ignored here rather than rejected.
 */
export type WheelGamePayload = {
  game_uuid: string;
  player_name: string;
  player_homeworld?: string | null;
  host_name?: string;
  theme?: string;
  preset?: string;
  max_spins?: number;
  spins_used?: number | null;
  spin_cost?: number;
  prizes_won?: unknown[];
  archived_at?: number | string | null;
  dealer?: string;
};

export type NormalizedWheelGame = {
  gameUuid: string;
  playerName: string;
  playerHomeworld?: string;
  hostName?: string;
  theme?: string;
  preset?: string;
  maxSpins: number;
  spinsUsed?: number;
  spinCost: number;
  prizesWon: string[];
  archivedAt: number;
  /** Set on live records; falls back to hostName, which the plugin guarantees is the uploading character. */
  dealer?: string;
  /** True when the record came from a live GameEndedIPC event rather than an archive snapshot. */
  live: boolean;
};

export type WheelGameDoc = {
  uploaderId: string;
  gameUuid: string;
  playerName: string;
  playerHomeworld?: string;
  hostName?: string;
  theme?: string;
  preset?: string;
  maxSpins: number;
  spinsUsed?: number;
  spinCost: number;
  prizesWon: string[];
  archivedAt: number;
  dealer?: string;
  /** Whether a live record has ever been merged into this doc. */
  live: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type WheelPrizeDoc = {
  uploaderId: string;
  prize: string;
  value?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isIntLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
}

/**
 * Loose shape check. Only the identity fields are mandatory; everything
 * else is coerced with safe defaults so a slightly odd SimpleWheel row
 * never sinks a 20k-row archive upload.
 */
export function isWheelGamePayload(value: unknown): value is WheelGamePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const v = value as Record<string, unknown>;

  return (
    isNonEmptyString(v.game_uuid) &&
    isNonEmptyString(v.player_name) &&
    (isNullish(v.player_homeworld) || typeof v.player_homeworld === "string") &&
    (isNullish(v.host_name) || typeof v.host_name === "string") &&
    (isNullish(v.theme) || typeof v.theme === "string") &&
    (isNullish(v.preset) || typeof v.preset === "string") &&
    (isNullish(v.max_spins) || isIntLike(v.max_spins)) &&
    (isNullish(v.spins_used) || isIntLike(v.spins_used)) &&
    (isNullish(v.spin_cost) || isIntLike(v.spin_cost)) &&
    (isNullish(v.prizes_won) || Array.isArray(v.prizes_won)) &&
    (isNullish(v.dealer) || typeof v.dealer === "string")
  );
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toInt(value: unknown, fallback: number): number {
  const num = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return fallback;
  return Math.trunc(num);
}

function toOptionalInt(value: unknown): number | undefined {
  if (isNullish(value)) return undefined;
  const num = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return undefined;
  return Math.trunc(num);
}

/**
 * Accepts unix seconds, unix milliseconds, numeric strings and ISO-8601.
 * Falls back to "now" when the value is null or unparseable, which the
 * plugin documents as a possibility for archive rows.
 */
export function normalizeWheelArchivedAt(value: unknown, now = () => Date.now()): number {
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
      if (!Number.isNaN(parsed.getTime())) {
        return Math.trunc(parsed.getTime() / 1000);
      }
    }
  }

  return Math.trunc(now() / 1000);
}

function normalizePrizesWon(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0);
}

export function normalizeWheelPayload(value: WheelGamePayload, opts?: { now?: () => number }): NormalizedWheelGame {
  const dealer = optionalString(value.dealer);
  const hostName = optionalString(value.host_name);
  const spinsUsed = toOptionalInt(value.spins_used);
  const playerHomeworld = optionalString(value.player_homeworld);

  return {
    gameUuid: value.game_uuid.trim(),
    playerName: value.player_name.trim(),
    playerHomeworld,
    hostName,
    theme: optionalString(value.theme),
    preset: optionalString(value.preset),
    maxSpins: Math.max(0, toInt(value.max_spins, 0)),
    spinsUsed: spinsUsed === undefined ? undefined : Math.max(0, spinsUsed),
    spinCost: Math.max(0, toInt(value.spin_cost, 0)),
    prizesWon: normalizePrizesWon(value.prizes_won),
    archivedAt: normalizeWheelArchivedAt(value.archived_at, opts?.now),
    dealer: dealer ?? hostName,
    // The plugin only attaches `dealer` to live GameEndedIPC uploads.
    live: dealer !== undefined,
  };
}

/**
 * Splits a raw request body into normalized games and the number of rows
 * that were dropped for not looking like a wheel record. The body may be a
 * single object (live) or an array (archive).
 */
export function parseWheelUploadBody(
  body: unknown,
  opts?: { now?: () => number }
): { games: NormalizedWheelGame[]; skipped: number; total: number } {
  const rows = Array.isArray(body) ? body : [body];
  const games: NormalizedWheelGame[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!isWheelGamePayload(row)) {
      skipped += 1;
      continue;
    }
    games.push(normalizeWheelPayload(row, opts));
  }

  return { games, skipped, total: rows.length };
}

/**
 * Merges two records for the same game. Later wins for the fields it
 * actually carries; live-only fields (homeworld, spins used, dealer) are kept
 * from whichever side has them so an archive re-upload never erases what the
 * live event told us.
 */
export function mergeWheelGames(base: NormalizedWheelGame, incoming: NormalizedWheelGame): NormalizedWheelGame {
  // A live record is richer, so it takes precedence for shared fields too.
  const [weaker, stronger] = incoming.live || !base.live ? [base, incoming] : [incoming, base];

  return {
    gameUuid: stronger.gameUuid,
    playerName: stronger.playerName || weaker.playerName,
    playerHomeworld: stronger.playerHomeworld ?? weaker.playerHomeworld,
    hostName: stronger.hostName ?? weaker.hostName,
    theme: stronger.theme ?? weaker.theme,
    preset: stronger.preset ?? weaker.preset,
    maxSpins: stronger.maxSpins || weaker.maxSpins,
    spinsUsed: stronger.spinsUsed ?? weaker.spinsUsed,
    spinCost: stronger.spinCost || weaker.spinCost,
    prizesWon: stronger.prizesWon.length ? stronger.prizesWon : weaker.prizesWon,
    archivedAt: stronger.archivedAt,
    dealer: stronger.dealer ?? weaker.dealer,
    live: base.live || incoming.live,
  };
}

/** Collapses duplicate game_uuids inside one upload so bulkWrite never races itself. */
export function dedupeWheelGames(games: NormalizedWheelGame[]): NormalizedWheelGame[] {
  const byUuid = new Map<string, NormalizedWheelGame>();

  for (const game of games) {
    const existing = byUuid.get(game.gameUuid);
    byUuid.set(game.gameUuid, existing ? mergeWheelGames(existing, game) : game);
  }

  return Array.from(byUuid.values());
}

export async function ingestWheelGames(opts: {
  db: Db;
  uploaderId: string;
  games: NormalizedWheelGame[];
  now?: Date;
}) {
  const games = dedupeWheelGames(opts.games);

  if (games.length === 0) {
    return { ok: true as const, inserted: 0, updated: 0 };
  }

  const wheelGames = opts.db.collection<WheelGameDoc>("wheel_games");
  const now = opts.now ?? new Date();

  const ops: AnyBulkWriteOperation<WheelGameDoc>[] = games.map((game) => {
    // Only $set what this record actually knows. An archive row carries
    // nulls for the live-only fields and must not wipe an earlier live upload.
    const set: Partial<WheelGameDoc> = {
      playerName: game.playerName,
      maxSpins: game.maxSpins,
      spinCost: game.spinCost,
      prizesWon: game.prizesWon,
      archivedAt: game.archivedAt,
      updatedAt: now,
      ...(game.playerHomeworld !== undefined ? { playerHomeworld: game.playerHomeworld } : {}),
      ...(game.hostName !== undefined ? { hostName: game.hostName } : {}),
      ...(game.theme !== undefined ? { theme: game.theme } : {}),
      ...(game.preset !== undefined ? { preset: game.preset } : {}),
      ...(game.spinsUsed !== undefined ? { spinsUsed: game.spinsUsed } : {}),
      ...(game.dealer !== undefined ? { dealer: game.dealer } : {}),
      ...(game.live ? { live: true } : {}),
    };

    return {
      updateOne: {
        filter: {
          uploaderId: opts.uploaderId,
          gameUuid: game.gameUuid,
        },
        update: {
          $set: set,
          $setOnInsert: {
            uploaderId: opts.uploaderId,
            gameUuid: game.gameUuid,
            createdAt: now,
            ...(game.live ? {} : { live: false }),
          },
        },
        upsert: true,
      },
    };
  });

  const result = await wheelGames.bulkWrite(ops, { ordered: false });

  return {
    ok: true as const,
    inserted: result.upsertedCount,
    updated: result.matchedCount,
  };
}

/**
 * Same trick as Scratch: prize labels like "1M Gil" or "250k Gil" carry their
 * own value, so record it up front. Never overwrites a value a dealer typed in.
 */
export async function upsertFormattedGilWheelPrizeValues(opts: {
  db: Db;
  uploaderId: string;
  games: NormalizedWheelGame[];
}) {
  const inferredValues = new Map<string, number>();

  for (const game of opts.games) {
    for (const rawPrize of game.prizesWon) {
      const prize = normalizeScratchPrizeName(rawPrize);
      if (!prize) continue;

      const value = parseFormattedGilPrizeValue(prize);
      if (value === null) continue;

      inferredValues.set(prize, value);
    }
  }

  if (inferredValues.size === 0) {
    return { ok: true as const, inserted: 0, updated: 0 };
  }

  const wheelPrizes = opts.db.collection<WheelPrizeDoc>("wheel_prizes");
  const now = new Date();
  const entries = Array.from(inferredValues.entries());

  const fillMissingOps: AnyBulkWriteOperation<WheelPrizeDoc>[] = entries.map(([prize, value]) => ({
    updateOne: {
      filter: {
        uploaderId: opts.uploaderId,
        prize,
        $or: [{ value: null }, { value: { $exists: false } }],
      },
      update: {
        $set: {
          value,
          updatedAt: now,
        },
      },
    },
  }));

  const fillMissingResult = await wheelPrizes.bulkWrite(fillMissingOps, { ordered: false });

  const insertMissingOps: AnyBulkWriteOperation<WheelPrizeDoc>[] = entries.map(([prize, value]) => ({
    updateOne: {
      filter: {
        uploaderId: opts.uploaderId,
        prize,
      },
      update: {
        $setOnInsert: {
          uploaderId: opts.uploaderId,
          prize,
          value,
          createdAt: now,
          updatedAt: now,
        },
      },
      upsert: true,
    },
  }));

  const insertMissingResult = await wheelPrizes.bulkWrite(insertMissingOps, { ordered: false });

  return {
    ok: true as const,
    inserted: insertMissingResult.upsertedCount,
    updated: fillMissingResult.modifiedCount,
  };
}
