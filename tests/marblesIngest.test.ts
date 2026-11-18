import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeMarblesGames,
  ingestMarblesGames,
  isMarblesGamePayload,
  MARBLES_DETAIL_MAX_BYTES,
  normalizeMarblesPayload,
  parseMarblesTimestamp,
  parseMarblesUploadBody,
} from "@/lib/marblesIngest";
import { calculateMarblesStats, type MarblesStatsGameRow } from "@/lib/marblesStats";
import { FakeDb } from "@/tests/helpers/fakeDb";

// A real GetArchiveIPC payload, as logged by the SimpleStats plugin.
const realArchive = JSON.parse(
  `[{"game_id":"a46498","theme":"Espi","created_at":"2026-11-18T18:00:07.572105","final_status":"active","total_races":0,"total_players":0,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":false,"tournament_format":null,"creator_name":"Raya' Serahill","creator_world":"Alpha","mine":true,"track_theme_name":"Espi","ended_at":null},{"game_id":"4d5861","theme":"Espi","created_at":"2026-11-18T17:38:37.837693","final_status":"completed","total_races":3,"total_players":5,"total_taken":5000,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":true,"tournament_format":"points","creator_name":"Raya' Serahill","creator_world":"Alpha","mine":true,"track_theme_name":"Espi","ended_at":"2026-11-18T17:45:29.395578"},{"game_id":"532827","theme":"Espi","created_at":"2026-11-16T22:02:54.480855","final_status":"completed","total_races":3,"total_players":4,"total_taken":4000,"total_payouts":5004000,"total_venue_cut":0,"total_boost":5000000,"tournament":true,"tournament_format":"points","creator_name":"Raya' Serahill","creator_world":"Alpha","mine":true,"track_theme_name":"Espi","ended_at":"2026-11-16T22:11:07.852587"},{"game_id":"a02dc7","theme":"Espi","created_at":"2026-11-16T19:54:51.381209","final_status":"auto_closed","total_races":1,"total_players":0,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":false,"tournament_format":null,"creator_name":"Lini Espi","creator_world":"Alpha","mine":false,"track_theme_name":"Espi","ended_at":"2026-11-17T07:39:08.427347"},{"game_id":"78a48a","theme":"Espi","created_at":"2026-11-16T18:18:00.946636","final_status":"completed","total_races":1,"total_players":2,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":false,"tournament_format":null,"creator_name":"Lini Espi","creator_world":"Alpha","mine":false,"track_theme_name":"Espi","ended_at":"2026-11-16T23:10:07.15503"},{"game_id":"d045a7","theme":"Espi","created_at":"2026-11-15T19:20:12.86597","final_status":"completed","total_races":1,"total_players":2,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":true,"tournament_format":"elimination","creator_name":"Lini Espi","creator_world":"Alpha","mine":false,"track_theme_name":"Espi","ended_at":"2026-11-15T19:23:26.365914"},{"game_id":"bd997b","theme":"Espi","created_at":"2026-11-15T19:07:31.187601","final_status":"completed","total_races":1,"total_players":2,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":true,"tournament_format":"elimination","creator_name":"Lini Espi","creator_world":"Alpha","mine":false,"track_theme_name":"Espi","ended_at":"2026-11-15T19:18:32.491538"},{"game_id":"a765c6","theme":"Espi","created_at":"2026-11-15T00:39:07.312434","final_status":"auto_closed","total_races":1,"total_players":0,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":false,"tournament_format":null,"creator_name":"Lini Espi","creator_world":"Alpha","mine":false,"track_theme_name":"Espi","ended_at":"2026-11-15T11:36:29.976667"},{"game_id":"4870b5","theme":"Espi","created_at":"2026-11-14T01:32:30.158325","final_status":"auto_closed","total_races":1,"total_players":0,"total_taken":0,"total_payouts":0,"total_venue_cut":0,"total_boost":0,"tournament":false,"tournament_format":null,"creator_name":"Console","creator_world":"","mine":false,"track_theme_name":"Cats","ended_at":"2026-11-14T10:08:19.944407"}]`
) as Array<Record<string, unknown>>;

const byId = (id: string) => realArchive.find((row) => row.game_id === id)!;

describe("parseMarblesTimestamp", () => {
  it("reads offset-less ISO strings as UTC, whatever the server's timezone", () => {
    assert.equal(parseMarblesTimestamp("2026-11-18T18:00:07.572105"), Date.UTC(2026, 10, 18, 18, 0, 7) / 1000);
  });

  it("honours an explicit offset", () => {
    assert.equal(parseMarblesTimestamp("2026-11-18T20:00:07+02:00"), Date.UTC(2026, 10, 18, 18, 0, 7) / 1000);
    assert.equal(parseMarblesTimestamp("2026-11-18T18:00:07Z"), Date.UTC(2026, 10, 18, 18, 0, 7) / 1000);
  });

  it("accepts unix seconds and milliseconds", () => {
    assert.equal(parseMarblesTimestamp(1758196800), 1758196800);
    assert.equal(parseMarblesTimestamp(1758196800123), 1758196800);
    assert.equal(parseMarblesTimestamp("1758196800"), 1758196800);
  });

  it("returns undefined for nothing readable", () => {
    assert.equal(parseMarblesTimestamp(null), undefined);
    assert.equal(parseMarblesTimestamp(""), undefined);
    assert.equal(parseMarblesTimestamp("soon"), undefined);
  });
});

describe("marbles payload parsing", () => {
  it("accepts every row of the real archive", () => {
    const { games, skipped, total } = parseMarblesUploadBody(realArchive);
    assert.equal(total, 9);
    assert.equal(skipped, 0);
    assert.equal(games.length, 9);
  });

  it("normalizes a finished tournament", () => {
    const game = normalizeMarblesPayload(byId("532827") as any);
    assert.deepEqual(game, {
      gameId: "532827",
      theme: "Espi",
      trackThemeName: "Espi",
      status: "completed",
      startedAt: Math.trunc(Date.UTC(2026, 10, 16, 22, 2, 54) / 1000),
      endedAt: Math.trunc(Date.UTC(2026, 10, 16, 22, 11, 7) / 1000),
      totalRaces: 3,
      totalPlayers: 4,
      totalTaken: 4000,
      totalPayouts: 5004000,
      totalVenueCut: 0,
      totalBoost: 5000000,
      tournament: true,
      tournamentFormat: "points",
      creatorName: "Raya' Serahill",
      creatorWorld: "Alpha",
      mine: true,
      detail: undefined,
    });
  });

  it("keeps a usable detail as received and drops empty or oversized ones", () => {
    const detail = { races: [{ race_number: 1, results: [{ name: "A B", place: 1, payout: 5000 }] }] };
    assert.deepEqual(normalizeMarblesPayload({ ...byId("532827"), detail } as any).detail, detail);

    for (const empty of [null, {}, [], "", "{}", 7]) {
      assert.equal(normalizeMarblesPayload({ ...byId("532827"), detail: empty } as any).detail, undefined);
    }

    const huge = { blob: "x".repeat(MARBLES_DETAIL_MAX_BYTES) };
    assert.equal(normalizeMarblesPayload({ ...byId("532827"), detail: huge } as any).detail, undefined);
  });

  it("leaves absent optionals undefined instead of null or empty", () => {
    const active = normalizeMarblesPayload(byId("a46498") as any);
    assert.equal(active.endedAt, undefined);
    assert.equal(active.tournamentFormat, undefined);
    assert.equal(normalizeMarblesPayload(byId("4870b5") as any).creatorWorld, undefined);
  });

  it("skips rows without an id or a readable start time and counts them", () => {
    const { games, skipped, total } = parseMarblesUploadBody([
      byId("4d5861"),
      { ...byId("4d5861"), game_id: "" },
      { ...byId("4d5861"), created_at: null },
      "nope",
      null,
    ]);
    assert.equal(total, 5);
    assert.equal(games.length, 1);
    assert.equal(skipped, 4);
  });

  it("ignores unknown fields and tolerates missing totals", () => {
    const row = { game_id: 42, created_at: "2026-11-18T18:00:07", brand_new_field: { a: 1 } };
    assert.equal(isMarblesGamePayload(row), true);
    const game = normalizeMarblesPayload(row as any);
    assert.equal(game.gameId, "42");
    assert.equal(game.status, "unknown");
    assert.equal(game.totalTaken, 0);
    assert.equal(game.mine, false);
  });

  it("accepts a single object as an archive of one", () => {
    assert.equal(parseMarblesUploadBody(byId("4d5861")).games.length, 1);
  });

  it("collapses duplicate ids, later row wins", () => {
    const games = dedupeMarblesGames(
      parseMarblesUploadBody([byId("4d5861"), { ...byId("4d5861"), total_taken: 9000 }]).games
    );
    assert.equal(games.length, 1);
    assert.equal(games[0].totalTaken, 9000);
  });
});

describe("ingestMarblesGames (local, fake db)", () => {
  const ingest = (db: FakeDb, uploaderId: string, body: unknown) =>
    ingestMarblesGames({ db: db as any, uploaderId, games: parseMarblesUploadBody(body).games });

  it("inserts the archive and reports counts", async () => {
    const db = new FakeDb();
    const result = await ingest(db, "u", realArchive);
    assert.equal(result.inserted, 9);
    assert.equal(result.updated, 0);

    const docs = db.col("marbles_games").docs;
    assert.equal(docs.length, 9);
    const doc = docs.find((d) => d.gameId === "532827");
    assert.equal(doc?.uploaderId, "u");
    assert.equal(doc?.totalBoost, 5000000);
    assert.equal(doc?.mine, true);
    assert.ok(doc?.createdAt instanceof Date);
    assert.equal(docs.find((d) => d.gameId === "a02dc7")?.mine, false);
  });

  it("re-uploading the same archive changes nothing and adds nothing", async () => {
    const db = new FakeDb();
    await ingest(db, "u", realArchive);
    const second = await ingest(db, "u", realArchive);
    assert.equal(second.inserted, 0);
    assert.equal(second.updated, 9);
    assert.equal(db.col("marbles_games").docs.length, 9);
  });

  it("a later snapshot finishes a game that was uploaded while active", async () => {
    const db = new FakeDb();
    await ingest(db, "u", [byId("a46498")]);
    assert.equal(db.col("marbles_games").docs[0].status, "active");
    assert.equal("endedAt" in db.col("marbles_games").docs[0], false);

    await ingest(db, "u", [
      {
        ...byId("a46498"),
        final_status: "completed",
        ended_at: "2026-11-18T18:30:00",
        total_races: 2,
        total_players: 6,
        total_taken: 60000,
        total_payouts: 54000,
      },
    ]);

    const docs = db.col("marbles_games").docs;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].status, "completed");
    assert.equal(docs[0].totalTaken, 60000);
    assert.equal(docs[0].endedAt, Date.UTC(2026, 10, 18, 18, 30, 0) / 1000);
  });

  it("a game claimed once stays claimed when re-uploaded from another character", async () => {
    const db = new FakeDb();
    await ingest(db, "u", [byId("4d5861")]);
    await ingest(db, "u", [{ ...byId("4d5861"), mine: false }]);
    assert.equal(db.col("marbles_games").docs[0].mine, true);
  });

  it("a game seen as someone else's becomes mine when its creator uploads", async () => {
    const db = new FakeDb();
    await ingest(db, "u", [byId("78a48a")]);
    assert.equal(db.col("marbles_games").docs[0].mine, false);
    await ingest(db, "u", [{ ...byId("78a48a"), mine: true }]);
    assert.equal(db.col("marbles_games").docs[0].mine, true);
  });

  it("stores detail and a later summary-only upload does not erase it", async () => {
    const db = new FakeDb();
    const detail = { races: [{ race_number: 1 }] };
    await ingest(db, "u", [{ ...byId("4d5861"), detail }]);
    const doc = db.col("marbles_games").docs[0];
    assert.deepEqual(doc.detail, detail);
    assert.ok(doc.detailUpdatedAt instanceof Date);

    await ingest(db, "u", [byId("4d5861")]);
    assert.deepEqual(db.col("marbles_games").docs[0].detail, detail);
  });

  it("a summary without detail stores no detail fields", async () => {
    const db = new FakeDb();
    await ingest(db, "u", [byId("4d5861")]);
    const doc = db.col("marbles_games").docs[0];
    assert.equal("detail" in doc, false);
    assert.equal("detailUpdatedAt" in doc, false);
  });

  it("keeps the same game separate per uploader", async () => {
    const db = new FakeDb();
    await ingest(db, "a", [byId("4d5861")]);
    await ingest(db, "b", [byId("4d5861")]);
    assert.equal(db.col("marbles_games").docs.length, 2);
  });
});

describe("calculateMarblesStats", () => {
  const rows = () => parseMarblesUploadBody(realArchive).games as MarblesStatsGameRow[];

  it("counts only the uploader's own finished games that had players", () => {
    const { totals, games } = calculateMarblesStats(rows());
    // Of nine rows: one is still active, six belong to other dealers.
    assert.deepEqual(
      games.map((g) => g.gameId),
      ["4d5861", "532827"]
    );
    assert.deepEqual(totals, {
      games: 2,
      tournaments: 2,
      races: 6,
      players: 9,
      taken: 9000,
      payouts: 5004000,
      venueCut: 0,
      boost: 5000000,
      net: -4995000,
      won: 0,
      uniquePlayers: 0,
    });
  });

  it("leaves out an own lobby that auto-closed empty", () => {
    const { totals } = calculateMarblesStats([{ ...rows().find((g) => g.gameId === "a02dc7")!, mine: true }]);
    assert.equal(totals.games, 0);
  });

  it("is all zeroes with no games", () => {
    const { totals, games } = calculateMarblesStats([]);
    assert.equal(games.length, 0);
    assert.equal(totals.games, 0);
    assert.equal(totals.net, 0);
  });
});
