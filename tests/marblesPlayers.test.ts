import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { ingestMarblesGames, parseMarblesUploadBody } from "@/lib/marblesIngest";
import { calculateMarblesPlayerStats, extractMarblesPlayers, marblesPlayerKey } from "@/lib/marblesPlayers";
import { calculateMarblesStats } from "@/lib/marblesStats";
import { FakeDb } from "@/tests/helpers/fakeDb";

// A real GetGameArchiveIPC answer: a 3-race points tournament with 5 players.
const tournamentDetail = JSON.parse(
  readFileSync(new URL("./fixtures/marblesTournamentDetail.json", import.meta.url), "utf8")
);

const tournamentRow = {
  game_id: "4d5861",
  theme: "Espi",
  created_at: "2026-11-18T17:38:37.837693",
  final_status: "completed",
  total_races: 3,
  total_players: 5,
  total_taken: 5000,
  total_payouts: 0,
  total_venue_cut: 0,
  total_boost: 0,
  tournament: true,
  tournament_format: "points",
  creator_name: "Raya' Serahill",
  creator_world: "Alpha",
  mine: true,
  track_theme_name: "Espi",
  ended_at: "2026-11-18T17:45:29.395578",
};

// A plain (non-tournament) game in the same shape: two races, one player running two marbles.
const plainDetail = {
  game_id: "plain1",
  tournament: false,
  players: [
    { name: "Asuna", world: "", marbles: 3, spent: 3000, winnings: 4000 },
    { name: "Lyn", world: "", marbles: 2, spent: 2000, winnings: 0 },
  ],
  races: [
    {
      race_number: 1,
      results: [
        { place: 1, name: "Asuna", world: "", marble_id: 0 },
        { place: 2, name: "Asuna", world: "", marble_id: 1 },
        { place: 3, name: "Lyn", world: "", marble_id: 2 },
      ],
    },
    {
      race_number: 2,
      results: [
        { place: 1, name: "Lyn", world: "", marble_id: 0 },
        { place: 2, name: "Asuna", world: "", marble_id: 1 },
      ],
    },
  ],
};

const plainRow = { ...tournamentRow, game_id: "plain1", created_at: "2026-11-19T10:00:00", tournament: false, tournament_format: null, total_races: 2, total_players: 2 };

const named = <T extends { playerName: string }>(rows: T[], name: string) => rows.find((r) => r.playerName === name)!;

describe("extractMarblesPlayers", () => {
  it("reads every player of the real tournament", () => {
    const players = extractMarblesPlayers(tournamentDetail);
    assert.equal(players.length, 5);

    assert.deepEqual(named(players, "Asuna"), {
      playerKey: "asuna@",
      playerName: "Asuna",
      tournament: true,
      marbles: 1,
      spent: 1000,
      winnings: 5000,
      racesEntered: 3,
      racesWon: 2,
      bestPlace: 1,
      tournamentPlace: 1,
      tournamentPoints: 65,
    });

    assert.deepEqual(named(players, "Raya' Serahill"), {
      playerKey: "raya' serahill@alpha",
      playerName: "Raya' Serahill",
      playerWorld: "Alpha",
      tournament: true,
      marbles: 1,
      spent: 1000,
      winnings: 0,
      racesEntered: 3,
      racesWon: 0,
      bestPlace: 2,
      tournamentPlace: 4,
      tournamentPoints: 40,
    });
  });

  it("separates winning a leg from winning the tournament", () => {
    const players = extractMarblesPlayers(tournamentDetail);
    // Lilly won race 1 but finished second overall.
    assert.equal(named(players, "Lilly").racesWon, 1);
    assert.equal(named(players, "Lilly").tournamentPlace, 2);
    assert.equal(players.filter((p) => p.tournamentPlace === 1).length, 1);
  });

  it("counts a race once for a player running several marbles", () => {
    const players = extractMarblesPlayers(plainDetail);
    const asuna = named(players, "Asuna");
    assert.equal(asuna.racesEntered, 2);
    assert.equal(asuna.racesWon, 1);
    assert.equal(asuna.marbles, 3);
    assert.equal(asuna.tournament, false);
    assert.equal("tournamentPlace" in asuna, false);
    assert.equal(named(players, "Lyn").racesWon, 1);
  });

  it("tells same-named players on different worlds apart, ignoring case and spacing", () => {
    assert.equal(marblesPlayerKey(" Asuna ", ""), marblesPlayerKey("asuna", null));
    assert.notEqual(marblesPlayerKey("Asuna", "Alpha"), marblesPlayerKey("Asuna", "Omega"));
    assert.equal(marblesPlayerKey("", "Alpha"), "");
  });

  it("survives junk", () => {
    for (const junk of [null, undefined, "x", 3, [], {}, { players: "no", races: [null, { results: [{}, 5] }] }]) {
      assert.deepEqual(extractMarblesPlayers(junk), []);
    }
  });
});

describe("marbles player ingest (local, fake db)", () => {
  const ingest = (db: FakeDb, body: unknown) =>
    ingestMarblesGames({ db: db as any, uploaderId: "u", games: parseMarblesUploadBody(body).games });

  it("derives one row per player from an uploaded detail", async () => {
    const db = new FakeDb();
    const result = await ingest(db, [{ ...tournamentRow, detail: tournamentDetail }]);
    assert.equal(result.players, 5);

    const rows = db.col("marbles_players").docs;
    assert.equal(rows.length, 5);
    const asuna = rows.find((r) => r.playerKey === "asuna@");
    assert.equal(asuna?.uploaderId, "u");
    assert.equal(asuna?.gameId, "4d5861");
    assert.equal(asuna?.winnings, 5000);
    assert.equal(asuna?.startedAt, Math.trunc(Date.UTC(2026, 10, 18, 17, 38, 37) / 1000));
  });

  it("re-uploading replaces rather than doubles", async () => {
    const db = new FakeDb();
    await ingest(db, [{ ...tournamentRow, detail: tournamentDetail }]);
    await ingest(db, [{ ...tournamentRow, detail: tournamentDetail }]);
    assert.equal(db.col("marbles_players").docs.length, 5);
  });

  it("drops a player who is no longer in the detail and updates the rest", async () => {
    const db = new FakeDb();
    await ingest(db, [{ ...plainRow, detail: plainDetail }]);
    assert.equal(db.col("marbles_players").docs.length, 2);

    const corrected = {
      ...plainDetail,
      players: [{ name: "Asuna", world: "", marbles: 3, spent: 3000, winnings: 9000 }],
      races: [{ race_number: 1, results: [{ place: 1, name: "Asuna", world: "" }] }],
    };
    await ingest(db, [{ ...plainRow, detail: corrected }]);

    const rows = db.col("marbles_players").docs;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].playerName, "Asuna");
    assert.equal(rows[0].winnings, 9000);
    assert.equal(rows[0].racesEntered, 1);
  });

  it("a summary-only upload leaves player rows alone", async () => {
    const db = new FakeDb();
    await ingest(db, [{ ...tournamentRow, detail: tournamentDetail }]);
    const result = await ingest(db, [tournamentRow]);
    assert.equal(result.players, 0);
    assert.equal(db.col("marbles_players").docs.length, 5);
  });
});

describe("marbles player stats", () => {
  const load = async () => {
    const db = new FakeDb();
    await ingestMarblesGames({
      db: db as any,
      uploaderId: "u",
      games: parseMarblesUploadBody([
        { ...tournamentRow, detail: tournamentDetail },
        { ...plainRow, detail: plainDetail },
      ]).games,
    });
    return { games: db.col("marbles_games").docs as any[], players: db.col("marbles_players").docs as any[] };
  };

  it("adds a player up across games", async () => {
    const { players } = await load();
    const stats = calculateMarblesPlayerStats(players);

    assert.equal(stats[0].playerName, "Asuna");
    assert.deepEqual(
      { ...stats[0] },
      {
        playerKey: "asuna@",
        playerName: "Asuna",
        playerWorld: undefined,
        games: 2,
        races: 5,
        racesWon: 3,
        tournaments: 1,
        tournamentsWon: 1,
        marbles: 4,
        spent: 4000,
        won: 9000,
        net: 5000,
        lastPlayedAt: Date.UTC(2026, 10, 19, 10, 0, 0) / 1000,
      }
    );

    const lyn = named(stats, "Lyn");
    assert.equal(lyn.games, 2);
    assert.equal(lyn.racesWon, 1);
    assert.equal(lyn.tournamentsWon, 0);
    assert.equal(lyn.net, -3000);
  });

  it("feeds the page totals", async () => {
    const { games, players } = await load();
    const stats = calculateMarblesStats(games, players);
    assert.equal(stats.totals.games, 2);
    assert.equal(stats.totals.won, 9000);
    assert.equal(stats.totals.uniquePlayers, 5);
    assert.equal(stats.players.length, 5);
  });

  it("ignores players of games that do not count", async () => {
    const { games, players } = await load();
    const disowned = games.map((g) => (g.gameId === "plain1" ? { ...g, mine: false } : g));
    const stats = calculateMarblesStats(disowned, players);
    assert.equal(stats.totals.games, 1);
    assert.equal(stats.totals.won, 5000);
    assert.equal(named(stats.players, "Asuna").games, 1);
  });
});
