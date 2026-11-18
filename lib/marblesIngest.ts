import type { Db, AnyBulkWriteOperation } from "mongodb";
import { syncMarblesGamePlayers } from "@/lib/marblesPlayers";

/**
 * SimpleMarbles archive upload.
 *
 * The SimpleStats plugin posts the array SimpleMarbles' GetArchiveIPC returns,
 * untouched. Each row is a game-level summary: one game holds one or more
 * races, and the row only carries totals. Who raced and who won is not in it.
 *
 * For the dealer's own finished games the plugin also attaches the result of
 * GetGameArchiveIPC as `detail`: races, finishing orders and each player's
 * money. It is stored exactly as received, and one row per player per game
 * is derived from it into marbles_players (see lib/marblesPlayers.ts), which
 * is what player stats are computed from. Keeping the raw detail means those
 * rows can be re-derived without anyone re-uploading.
 *
 * The archive lists every game the dealer can see, not only their own; `mine`
 * tells them apart. A game that is still running shows up as `active` with
 * zero totals and is overwritten by later snapshots.
 */
export type MarblesGamePayload = {
  game_id: string | number;
  theme?: string | null;
  track_theme_name?: string | null;
  /** ISO-8601 without an offset. SimpleMarbles writes UTC. */
  created_at: string | number;
  ended_at?: string | number | null;
  /** Seen so far: active, completed, auto_closed. */
  final_status?: string | null;
  total_races?: number | null;
  total_players?: number | null;
  total_taken?: number | null;
  total_payouts?: number | null;
  total_venue_cut?: number | null;
  total_boost?: number | null;
  tournament?: boolean | null;
  tournament_format?: string | null;
  creator_name?: string | null;
  creator_world?: string | null;
  mine?: boolean | null;
  /** GetGameArchiveIPC's answer for this game, passed through by the plugin. */
  detail?: unknown;
};

export type NormalizedMarblesGame = {
  gameId: string;
  theme?: string;
  trackThemeName?: string;
  status: string;
  /** Unix seconds, UTC. */
  startedAt: number;
  endedAt?: number;
  totalRaces: number;
  totalPlayers: number;
  totalTaken: number;
  totalPayouts: number;
  totalVenueCut: number;
  totalBoost: number;
  tournament: boolean;
  tournamentFormat?: string;
  creatorName?: string;
  creatorWorld?: string;
  mine: boolean;
  /** Raw per-game detail, only when the upload carried a usable one. */
  detail?: Record<string, unknown> | unknown[];
};

export type MarblesGameDoc = NormalizedMarblesGame & {
  uploaderId: string;
  detailUpdatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

export const MARBLES_STATUS_ACTIVE = "active";

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isNumberLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function toAmount(value: unknown): number {
  const num = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

/** A game's detail is a handful of races; anything past this is not one and is dropped. */
export const MARBLES_DETAIL_MAX_BYTES = 512 * 1024;

/** The detail as stored, or undefined when it is missing, empty or implausibly large. */
export function normalizeMarblesDetail(value: unknown): Record<string, unknown> | unknown[] | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0) return undefined;
  if (Buffer.byteLength(JSON.stringify(value), "utf8") > MARBLES_DETAIL_MAX_BYTES) return undefined;
  return value as Record<string, unknown> | unknown[];
}

const HAS_UTC_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Unix seconds from a SimpleMarbles timestamp, or undefined when it cannot be
 * read. ISO strings arrive without an offset and mean UTC; `new Date()` would
 * read them as server-local time, so the offset is added before parsing.
 * Unix seconds and milliseconds are accepted too.
 */
export function parseMarblesTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1_000_000_000_000 ? Math.trunc(value / 1000) : Math.trunc(value);
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) {
    return numeric >= 1_000_000_000_000 ? Math.trunc(numeric / 1000) : Math.trunc(numeric);
  }

  const isoLike = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const withOffset = HAS_UTC_OFFSET.test(isoLike) ? isoLike : `${isoLike}Z`;
  const parsed = new Date(withOffset);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return Math.trunc(parsed.getTime() / 1000);
}

/**
 * Loose shape check. Only the game id and a readable start time are
 * mandatory; everything else is coerced with safe defaults so one odd row
 * never sinks a whole archive upload.
 */
export function isMarblesGamePayload(value: unknown): value is MarblesGamePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const v = value as Record<string, unknown>;
  const hasId =
    (typeof v.game_id === "string" && v.game_id.trim().length > 0) ||
    (typeof v.game_id === "number" && Number.isFinite(v.game_id));

  return (
    hasId &&
    parseMarblesTimestamp(v.created_at) !== undefined &&
    (isNullish(v.final_status) || typeof v.final_status === "string") &&
    (isNullish(v.total_races) || isNumberLike(v.total_races)) &&
    (isNullish(v.total_players) || isNumberLike(v.total_players)) &&
    (isNullish(v.total_taken) || isNumberLike(v.total_taken)) &&
    (isNullish(v.total_payouts) || isNumberLike(v.total_payouts)) &&
    (isNullish(v.total_venue_cut) || isNumberLike(v.total_venue_cut)) &&
    (isNullish(v.total_boost) || isNumberLike(v.total_boost))
  );
}

export function normalizeMarblesPayload(value: MarblesGamePayload): NormalizedMarblesGame {
  return {
    gameId: String(value.game_id).trim(),
    theme: optionalString(value.theme),
    trackThemeName: optionalString(value.track_theme_name),
    status: optionalString(value.final_status)?.toLowerCase() ?? "unknown",
    startedAt: parseMarblesTimestamp(value.created_at) ?? 0,
    endedAt: parseMarblesTimestamp(value.ended_at),
    totalRaces: toAmount(value.total_races),
    totalPlayers: toAmount(value.total_players),
    totalTaken: toAmount(value.total_taken),
    totalPayouts: toAmount(value.total_payouts),
    totalVenueCut: toAmount(value.total_venue_cut),
    totalBoost: toAmount(value.total_boost),
    tournament: value.tournament === true,
    tournamentFormat: optionalString(value.tournament_format),
    creatorName: optionalString(value.creator_name),
    creatorWorld: optionalString(value.creator_world),
    mine: value.mine === true,
    detail: normalizeMarblesDetail(value.detail),
  };
}

/**
 * Splits a raw request body into normalized games and the number of rows
 * dropped for not looking like a marbles game. The body is normally the
 * archive array; a single object is accepted as an archive of one.
 */
export function parseMarblesUploadBody(body: unknown): {
  games: NormalizedMarblesGame[];
  skipped: number;
  total: number;
} {
  const rows = Array.isArray(body) ? body : [body];
  const games: NormalizedMarblesGame[] = [];
  let skipped = 0;

  for (const row of rows) {
    if (!isMarblesGamePayload(row)) {
      skipped += 1;
      continue;
    }
    games.push(normalizeMarblesPayload(row));
  }

  return { games, skipped, total: rows.length };
}

/** Collapses duplicate game ids inside one upload so bulkWrite never races itself. Later rows win. */
export function dedupeMarblesGames(games: NormalizedMarblesGame[]): NormalizedMarblesGame[] {
  const byId = new Map<string, NormalizedMarblesGame>();

  for (const game of games) {
    const existing = byId.get(game.gameId);
    byId.set(
      game.gameId,
      existing ? { ...game, mine: existing.mine || game.mine, detail: game.detail ?? existing.detail } : game
    );
  }

  return Array.from(byId.values());
}

export async function ingestMarblesGames(opts: {
  db: Db;
  uploaderId: string;
  games: NormalizedMarblesGame[];
  now?: Date;
}) {
  const games = dedupeMarblesGames(opts.games);

  if (games.length === 0) {
    return { ok: true as const, inserted: 0, updated: 0, players: 0 };
  }

  const marblesGames = opts.db.collection<MarblesGameDoc>("marbles_games");
  const now = opts.now ?? new Date();

  const ops: AnyBulkWriteOperation<MarblesGameDoc>[] = games.map((game) => {
    // The archive is a snapshot of SimpleMarbles' own totals, so the newest
    // upload is the truth for every field it carries. Optional fields are only
    // written when present so a sparse row never erases an earlier value.
    const set: Partial<MarblesGameDoc> = {
      status: game.status,
      startedAt: game.startedAt,
      totalRaces: game.totalRaces,
      totalPlayers: game.totalPlayers,
      totalTaken: game.totalTaken,
      totalPayouts: game.totalPayouts,
      totalVenueCut: game.totalVenueCut,
      totalBoost: game.totalBoost,
      tournament: game.tournament,
      updatedAt: now,
      ...(game.theme !== undefined ? { theme: game.theme } : {}),
      ...(game.trackThemeName !== undefined ? { trackThemeName: game.trackThemeName } : {}),
      ...(game.endedAt !== undefined ? { endedAt: game.endedAt } : {}),
      ...(game.tournamentFormat !== undefined ? { tournamentFormat: game.tournamentFormat } : {}),
      ...(game.creatorName !== undefined ? { creatorName: game.creatorName } : {}),
      ...(game.creatorWorld !== undefined ? { creatorWorld: game.creatorWorld } : {}),
      // `mine` is relative to the character that was logged in for the upload.
      // Once any of the account's characters has claimed a game it stays
      // claimed, so uploading from an alt never disowns the main's games.
      ...(game.mine ? { mine: true } : {}),
      // A summary-only upload (detail fetch failed, or an older plugin) keeps
      // whatever detail an earlier upload stored.
      ...(game.detail !== undefined ? { detail: game.detail, detailUpdatedAt: now } : {}),
    };

    return {
      updateOne: {
        filter: { uploaderId: opts.uploaderId, gameId: game.gameId },
        update: {
          $set: set,
          $setOnInsert: {
            uploaderId: opts.uploaderId,
            gameId: game.gameId,
            createdAt: now,
            ...(game.mine ? {} : { mine: false }),
          },
        },
        upsert: true,
      },
    };
  });

  const result = await marblesGames.bulkWrite(ops, { ordered: false });

  // Games first, players second: if this stops halfway the detail is already
  // stored and the next upload derives the missing player rows.
  let players = 0;
  for (const game of games) {
    if (game.detail === undefined) continue;
    const synced = await syncMarblesGamePlayers({
      db: opts.db,
      uploaderId: opts.uploaderId,
      gameId: game.gameId,
      startedAt: game.startedAt,
      detail: game.detail,
      now,
    });
    players += synced.players;
  }

  return {
    ok: true as const,
    inserted: result.upsertedCount,
    updated: result.matchedCount,
    players,
  };
}
