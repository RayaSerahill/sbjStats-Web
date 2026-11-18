import type { Db } from "mongodb";
import { MARBLES_STATUS_ACTIVE, type MarblesGameDoc } from "@/lib/marblesIngest";
import {
  calculateMarblesPlayerStats,
  type MarblesPlayerGameDoc,
  type MarblesPlayerStats,
  type MarblesPlayerStatsRow,
} from "@/lib/marblesPlayers";

export type MarblesStatsGameRow = Pick<
  MarblesGameDoc,
  | "gameId"
  | "status"
  | "startedAt"
  | "endedAt"
  | "totalRaces"
  | "totalPlayers"
  | "totalTaken"
  | "totalPayouts"
  | "totalVenueCut"
  | "totalBoost"
  | "tournament"
  | "tournamentFormat"
  | "trackThemeName"
  | "theme"
  | "mine"
>;

export type MarblesTotals = {
  games: number;
  tournaments: number;
  races: number;
  /** Sum of each game's player count; the same person in two games counts twice. */
  players: number;
  taken: number;
  payouts: number;
  venueCut: number;
  /** Gil the host added to prize pools on top of what players paid in. */
  boost: number;
  /** taken - payouts. Negative when boosts were paid out. */
  net: number;
  /** Gil players won, paid out yet or not. Only from games whose race results were uploaded. */
  won: number;
  /** Distinct players across games whose race results were uploaded. */
  uniquePlayers: number;
};

export type MarblesStats = {
  totals: MarblesTotals;
  /** The games behind the totals, newest first. */
  games: MarblesStatsGameRow[];
  /** One line per player, biggest winners first. */
  players: MarblesPlayerStats[];
};

/**
 * A game counts once it is the uploader's own, has finished, and somebody
 * actually played: the archive also lists other dealers' games, games still
 * running, and lobbies that auto-closed with nobody in them.
 */
export function countsTowardMarblesStats(game: Pick<MarblesGameDoc, "mine" | "status" | "totalPlayers">) {
  return game.mine === true && game.status !== MARBLES_STATUS_ACTIVE && (Number(game.totalPlayers) || 0) > 0;
}

/**
 * Host totals from game summaries, and per-player figures from the player
 * rows of those same games. Player rows of games that do not count (or that
 * are not in `rows` at all) are ignored.
 */
export function calculateMarblesStats(
  rows: MarblesStatsGameRow[],
  playerRows: MarblesPlayerStatsRow[] = []
): MarblesStats {
  const games = rows.filter(countsTowardMarblesStats).sort((a, b) => b.startedAt - a.startedAt);
  const countedIds = new Set(games.map((game) => game.gameId));
  const players = calculateMarblesPlayerStats(playerRows.filter((row) => countedIds.has(row.gameId)));

  const totals: MarblesTotals = {
    games: games.length,
    tournaments: 0,
    races: 0,
    players: 0,
    taken: 0,
    payouts: 0,
    venueCut: 0,
    boost: 0,
    net: 0,
    won: players.reduce((sum, player) => sum + player.won, 0),
    uniquePlayers: players.length,
  };

  for (const game of games) {
    if (game.tournament) totals.tournaments += 1;
    totals.races += Number(game.totalRaces) || 0;
    totals.players += Number(game.totalPlayers) || 0;
    totals.taken += Number(game.totalTaken) || 0;
    totals.payouts += Number(game.totalPayouts) || 0;
    totals.venueCut += Number(game.totalVenueCut) || 0;
    totals.boost += Number(game.totalBoost) || 0;
  }

  totals.net = totals.taken - totals.payouts;

  return { totals, games, players };
}

export async function loadMarblesStatsForUploader(db: Db, uploaderId: string): Promise<MarblesStats> {
  const playersQuery = db
    .collection<MarblesPlayerGameDoc>("marbles_players")
    .find({ uploaderId }, { projection: { _id: 0, uploaderId: 0, createdAt: 0, updatedAt: 0 } })
    .toArray();

  const gamesQuery = db
    .collection<MarblesGameDoc>("marbles_games")
    .find(
      { uploaderId, mine: true },
      {
        projection: {
          _id: 0,
          gameId: 1,
          status: 1,
          startedAt: 1,
          endedAt: 1,
          totalRaces: 1,
          totalPlayers: 1,
          totalTaken: 1,
          totalPayouts: 1,
          totalVenueCut: 1,
          totalBoost: 1,
          tournament: 1,
          tournamentFormat: 1,
          trackThemeName: 1,
          theme: 1,
          mine: 1,
        },
      }
    )
    .toArray();

  const [rows, playerRows] = await Promise.all([gamesQuery, playersQuery]);

  return calculateMarblesStats(rows as MarblesStatsGameRow[], playerRows as MarblesPlayerStatsRow[]);
}
