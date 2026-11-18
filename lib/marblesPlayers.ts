import type { Db, AnyBulkWriteOperation } from "mongodb";

/**
 * Per-player results of one SimpleMarbles game, derived from the game's
 * detail (GetGameArchiveIPC, attached to archive rows by the plugin).
 *
 * The parts of the detail that are read:
 *
 *   players[]            one row per participant with the game's money:
 *                        marbles bought, gil spent, gil won
 *   races[].results[]    finishing order of every marble in every race
 *   bracket              tournaments only: standings[] with points per
 *                        player, places[] with the prizes handed out
 *
 * A game is one or more races. In a plain game every race is its own
 * contest. In a tournament the races are legs of a single contest: nobody
 * "wins" a leg for money, the prize goes by the final standings, so a
 * tournament win is tracked separately from race wins.
 *
 * Everything is read defensively. SimpleMarbles' payloads are additive and
 * only one real sample has been seen, so a missing or odd field costs that
 * one figure rather than the whole game.
 */
export type MarblesPlayerGameDoc = {
  uploaderId: string;
  gameId: string;
  /** Lowercased "name@world". Many players are nicknames with no world. */
  playerKey: string;
  playerName: string;
  playerWorld?: string;
  /** The game's start, unix seconds. Copied here so player history sorts without a join. */
  startedAt: number;
  tournament: boolean;
  marbles: number;
  spent: number;
  /** Gil won, whether or not the dealer has paid it out yet. */
  winnings: number;
  /** Races the player had at least one marble in. */
  racesEntered: number;
  /** Races where one of the player's marbles finished first. */
  racesWon: number;
  /** Best finishing place across the game's races, when they raced at all. */
  bestPlace?: number;
  /** Tournaments only: final position in the standings, 1 = winner. */
  tournamentPlace?: number;
  tournamentPoints?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type MarblesPlayerGame = Omit<
  MarblesPlayerGameDoc,
  "uploaderId" | "gameId" | "startedAt" | "createdAt" | "updatedAt"
>;

type Obj = Record<string, unknown>;

function asObject(value: unknown): Obj | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Obj) : undefined;
}

function asObjects(value: unknown): Obj[] {
  return Array.isArray(value) ? value.map(asObject).filter((v): v is Obj => v !== undefined) : [];
}

function toAmount(value: unknown): number {
  const num = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof num !== "number" || !Number.isFinite(num)) return 0;
  return Math.max(0, Math.trunc(num));
}

function toPlace(value: unknown): number | undefined {
  const num = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof num !== "number" || !Number.isFinite(num) || num < 1) return undefined;
  return Math.trunc(num);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFKC").trim() : "";
}

/** Identity of a player inside one uploader's games. Empty when there is no name. */
export function marblesPlayerKey(name: unknown, world: unknown): string {
  const n = text(name).toLowerCase();
  if (!n) return "";
  return `${n}@${text(world).toLowerCase()}`;
}

/**
 * One row per player who took part in the game. Returns an empty list when
 * the detail holds no players and no race results.
 */
export function extractMarblesPlayers(detail: unknown): MarblesPlayerGame[] {
  const root = asObject(detail);
  if (!root) return [];

  const bracket = asObject(root.bracket);
  const tournament = root.tournament === true || (root.tournament === undefined && bracket !== undefined);
  const players = new Map<string, MarblesPlayerGame>();

  const playerFor = (row: Obj): MarblesPlayerGame | undefined => {
    const key = marblesPlayerKey(row.name, row.world);
    if (!key) return undefined;

    let player = players.get(key);
    if (!player) {
      const world = text(row.world);
      player = {
        playerKey: key,
        playerName: text(row.name),
        ...(world ? { playerWorld: world } : {}),
        tournament,
        marbles: 0,
        spent: 0,
        winnings: 0,
        racesEntered: 0,
        racesWon: 0,
      };
      players.set(key, player);
    }
    return player;
  };

  for (const row of asObjects(root.players)) {
    const player = playerFor(row);
    if (!player) continue;
    player.marbles += toAmount(row.marbles);
    player.spent += toAmount(row.spent);
    player.winnings += toAmount(row.winnings);
  }

  for (const race of asObjects(root.races)) {
    // A player can run several marbles in one race; it is still one race
    // entered, and one race won if any of them came first.
    const entered = new Set<MarblesPlayerGame>();
    const won = new Set<MarblesPlayerGame>();

    for (const result of asObjects(race.results)) {
      const player = playerFor(result);
      if (!player) continue;
      entered.add(player);

      const place = toPlace(result.place);
      if (place === undefined) continue;
      if (place === 1) won.add(player);
      if (player.bestPlace === undefined || place < player.bestPlace) player.bestPlace = place;
    }

    for (const player of entered) player.racesEntered += 1;
    for (const player of won) player.racesWon += 1;
  }

  if (tournament && bracket) {
    // Standings come ordered best first; `rank` is only filled in by some formats.
    asObjects(bracket.standings).forEach((row, index) => {
      const player = playerFor(row);
      if (!player) return;
      player.tournamentPlace = toPlace(row.rank) ?? index + 1;
      if (typeof row.points === "number" && Number.isFinite(row.points)) player.tournamentPoints = row.points;
    });

    // The prize list is the final word on who placed where it exists.
    for (const row of asObjects(bracket.places)) {
      const player = playerFor(row);
      const place = toPlace(row.place);
      if (player && place !== undefined) player.tournamentPlace = place;
    }
  }

  return Array.from(players.values());
}

/**
 * Replaces the stored player rows of one game with the ones derived from its
 * detail: current players are upserted, players no longer in the detail are
 * removed. Safe to run on every upload.
 */
export async function syncMarblesGamePlayers(opts: {
  db: Db;
  uploaderId: string;
  gameId: string;
  startedAt: number;
  detail: unknown;
  now?: Date;
}) {
  const players = extractMarblesPlayers(opts.detail);
  const collection = opts.db.collection<MarblesPlayerGameDoc>("marbles_players");
  const now = opts.now ?? new Date();
  const scope = { uploaderId: opts.uploaderId, gameId: opts.gameId };

  const existing = await collection.find(scope, { projection: { playerKey: 1 } }).toArray();
  const current = new Set(players.map((p) => p.playerKey));
  const stale = existing.map((doc) => doc.playerKey).filter((key) => !current.has(key));

  if (stale.length > 0) {
    await collection.deleteMany({ ...scope, playerKey: { $in: stale } });
  }

  if (players.length === 0) return { players: 0 };

  const ops: AnyBulkWriteOperation<MarblesPlayerGameDoc>[] = players.map((player) => {
    const { playerKey, bestPlace, tournamentPlace, tournamentPoints, playerWorld, ...rest } = player;
    const optional = { bestPlace, tournamentPlace, tournamentPoints, playerWorld };
    const present = Object.fromEntries(Object.entries(optional).filter(([, v]) => v !== undefined));
    const absent = Object.fromEntries(
      Object.entries(optional)
        .filter(([, v]) => v === undefined)
        .map(([k]) => [k, "" as const])
    ) as Partial<Record<keyof typeof optional, "">>;

    return {
      updateOne: {
        filter: { ...scope, playerKey },
        update: {
          $set: { ...rest, ...present, startedAt: opts.startedAt, updatedAt: now },
          ...(Object.keys(absent).length > 0 ? { $unset: absent } : {}),
          $setOnInsert: { ...scope, playerKey, createdAt: now },
        },
        upsert: true,
      },
    };
  });

  await collection.bulkWrite(ops, { ordered: false });
  return { players: players.length };
}

export type MarblesPlayerStatsRow = Pick<
  MarblesPlayerGameDoc,
  | "gameId"
  | "playerKey"
  | "playerName"
  | "playerWorld"
  | "startedAt"
  | "tournament"
  | "marbles"
  | "spent"
  | "winnings"
  | "racesEntered"
  | "racesWon"
  | "tournamentPlace"
>;

export type MarblesPlayerStats = {
  playerKey: string;
  /** As spelled in the player's most recent game. */
  playerName: string;
  playerWorld?: string;
  games: number;
  races: number;
  racesWon: number;
  tournaments: number;
  tournamentsWon: number;
  marbles: number;
  spent: number;
  won: number;
  /** won - spent, from the player's side. */
  net: number;
  lastPlayedAt: number;
};

/** One line per player across all the given games, biggest winners first. */
export function calculateMarblesPlayerStats(rows: MarblesPlayerStatsRow[]): MarblesPlayerStats[] {
  const byKey = new Map<string, MarblesPlayerStats>();

  for (const row of rows) {
    let stats = byKey.get(row.playerKey);
    if (!stats) {
      stats = {
        playerKey: row.playerKey,
        playerName: row.playerName,
        playerWorld: row.playerWorld,
        games: 0,
        races: 0,
        racesWon: 0,
        tournaments: 0,
        tournamentsWon: 0,
        marbles: 0,
        spent: 0,
        won: 0,
        net: 0,
        lastPlayedAt: 0,
      };
      byKey.set(row.playerKey, stats);
    }

    stats.games += 1;
    stats.races += Number(row.racesEntered) || 0;
    stats.racesWon += Number(row.racesWon) || 0;
    stats.marbles += Number(row.marbles) || 0;
    stats.spent += Number(row.spent) || 0;
    stats.won += Number(row.winnings) || 0;
    if (row.tournament) {
      stats.tournaments += 1;
      if (row.tournamentPlace === 1) stats.tournamentsWon += 1;
    }
    if (row.startedAt >= stats.lastPlayedAt) {
      stats.lastPlayedAt = row.startedAt;
      stats.playerName = row.playerName;
      stats.playerWorld = row.playerWorld;
    }
  }

  for (const stats of byKey.values()) stats.net = stats.won - stats.spent;

  return Array.from(byKey.values()).sort(
    (a, b) => b.won - a.won || b.racesWon - a.racesWon || b.games - a.games || a.playerName.localeCompare(b.playerName)
  );
}
