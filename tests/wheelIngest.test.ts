import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeWheelGames,
  ingestWheelGames,
  isWheelGamePayload,
  mergeWheelGames,
  normalizeWheelArchivedAt,
  normalizeWheelPayload,
  parseWheelUploadBody,
  upsertFormattedGilWheelPrizeValues,
} from "@/lib/wheelIngest";
import { FakeDb } from "@/tests/helpers/fakeDb";

// Straight from the SimpleStats upload contract.
const liveRecord = {
  game_uuid: "ab12cd34",
  player_name: "Player Title",
  player_homeworld: "Balmung",
  host_name: "Asuna Pahlo",
  theme: "urban",
  preset: "MyPreset",
  max_spins: 5,
  spins_used: 5,
  spin_cost: 100000,
  prizes_won: ["1M Gil", "Rare Mount"],
  archived_at: 1758196800,
  dealer: "Raya Serahill",
};

const archiveRecord = {
  game_uuid: "ab12cd34",
  player_name: "Player Title",
  player_homeworld: null,
  host_name: "Asuna Pahlo",
  theme: "urban",
  preset: "MyPreset",
  max_spins: 5,
  spins_used: null,
  spin_cost: 100000,
  prizes_won: ["1M Gil", "Rare Mount"],
  archived_at: 1758196800,
};

const otherArchiveRecord = {
  game_uuid: "ef56gh78",
  player_name: "Other Player",
  player_homeworld: null,
  host_name: "Asuna Pahlo",
  theme: "neon",
  preset: "Holiday",
  max_spins: 3,
  spins_used: null,
  spin_cost: 50000,
  prizes_won: [],
  archived_at: 1758110400,
};

describe("wheel payload validation", () => {
  it("accepts the live and archive examples from the contract", () => {
    assert.equal(isWheelGamePayload(liveRecord), true);
    assert.equal(isWheelGamePayload(archiveRecord), true);
    assert.equal(isWheelGamePayload(otherArchiveRecord), true);
  });

  it("only insists on game_uuid and player_name", () => {
    assert.equal(isWheelGamePayload({ game_uuid: "x", player_name: "y" }), true);
    assert.equal(isWheelGamePayload({ player_name: "y" }), false);
    assert.equal(isWheelGamePayload({ game_uuid: "", player_name: "y" }), false);
    assert.equal(isWheelGamePayload({ game_uuid: "x", player_name: "   " }), false);
    assert.equal(isWheelGamePayload(null), false);
    assert.equal(isWheelGamePayload([liveRecord]), false);
  });

  it("ignores fields it has never heard of (SimpleWheel IPC is additive)", () => {
    assert.equal(isWheelGamePayload({ ...liveRecord, some_future_field: { nested: true } }), true);
  });

  it("rejects obviously wrong types for known fields", () => {
    assert.equal(isWheelGamePayload({ ...liveRecord, prizes_won: "1M Gil" }), false);
    assert.equal(isWheelGamePayload({ ...liveRecord, max_spins: "lots" }), false);
    assert.equal(isWheelGamePayload({ ...liveRecord, dealer: 42 }), false);
  });
});

describe("wheel payload normalisation", () => {
  it("marks live records as live and keeps their extras", () => {
    const game = normalizeWheelPayload(liveRecord);
    assert.equal(game.live, true);
    assert.equal(game.dealer, "Raya Serahill");
    assert.equal(game.playerHomeworld, "Balmung");
    assert.equal(game.spinsUsed, 5);
    assert.equal(game.hostName, "Asuna Pahlo");
    assert.deepEqual(game.prizesWon, ["1M Gil", "Rare Mount"]);
    assert.equal(game.archivedAt, 1758196800);
  });

  it("marks archive rows as not live, drops their nulls and borrows host_name as dealer", () => {
    const game = normalizeWheelPayload(archiveRecord);
    assert.equal(game.live, false);
    assert.equal(game.playerHomeworld, undefined);
    assert.equal(game.spinsUsed, undefined);
    assert.equal(game.dealer, "Asuna Pahlo");
  });

  it("coerces numeric strings and clamps negatives", () => {
    const game = normalizeWheelPayload({
      ...archiveRecord,
      max_spins: "4" as any,
      spin_cost: "-100" as any,
      spins_used: "2.9" as any,
    });
    assert.equal(game.maxSpins, 4);
    assert.equal(game.spinCost, 0);
    assert.equal(game.spinsUsed, 2);
  });

  it("trims and drops empty prize labels", () => {
    const game = normalizeWheelPayload({ ...archiveRecord, prizes_won: [" 1M Gil ", "", null, 7] });
    assert.deepEqual(game.prizesWon, ["1M Gil", "7"]);
  });

  it("understands seconds, milliseconds, numeric strings and ISO timestamps", () => {
    assert.equal(normalizeWheelArchivedAt(1758196800), 1758196800);
    assert.equal(normalizeWheelArchivedAt(1758196800123), 1758196800);
    assert.equal(normalizeWheelArchivedAt("1758196800"), 1758196800);
    assert.equal(normalizeWheelArchivedAt("2025-09-18T12:00:00Z"), 1758196800);
  });

  it("falls back to now when archived_at is null or garbage", () => {
    const now = () => 1_700_000_000_000;
    assert.equal(normalizeWheelArchivedAt(null, now), 1_700_000_000);
    assert.equal(normalizeWheelArchivedAt("last tuesday", now), 1_700_000_000);
    assert.equal(normalizeWheelPayload({ ...archiveRecord, archived_at: null }, { now }).archivedAt, 1_700_000_000);
  });
});

describe("parseWheelUploadBody", () => {
  it("treats a bare object as a one-game upload", () => {
    const parsed = parseWheelUploadBody(liveRecord);
    assert.equal(parsed.total, 1);
    assert.equal(parsed.skipped, 0);
    assert.equal(parsed.games.length, 1);
    assert.equal(parsed.games[0].gameUuid, "ab12cd34");
  });

  it("skips and counts rows that are not wheel games instead of failing the batch", () => {
    const parsed = parseWheelUploadBody([archiveRecord, { nope: true }, otherArchiveRecord, null]);
    assert.equal(parsed.total, 4);
    assert.equal(parsed.skipped, 2);
    assert.deepEqual(
      parsed.games.map((g) => g.gameUuid),
      ["ab12cd34", "ef56gh78"]
    );
  });
});

describe("merging live and archive records", () => {
  it("lets the live record win regardless of order", () => {
    const live = normalizeWheelPayload({ ...liveRecord, theme: "live-theme" });
    const archive = normalizeWheelPayload({ ...archiveRecord, theme: "archive-theme" });

    for (const merged of [mergeWheelGames(archive, live), mergeWheelGames(live, archive)]) {
      assert.equal(merged.live, true);
      assert.equal(merged.theme, "live-theme");
      assert.equal(merged.dealer, "Raya Serahill");
      assert.equal(merged.playerHomeworld, "Balmung");
      assert.equal(merged.spinsUsed, 5);
    }
  });

  it("fills gaps from the weaker record", () => {
    const live = normalizeWheelPayload({ ...liveRecord, preset: undefined, prizes_won: [] });
    const archive = normalizeWheelPayload(archiveRecord);
    const merged = mergeWheelGames(archive, live);
    assert.equal(merged.preset, "MyPreset");
    assert.deepEqual(merged.prizesWon, ["1M Gil", "Rare Mount"]);
  });

  it("collapses duplicate game_uuids inside one upload", () => {
    const games = dedupeWheelGames([
      normalizeWheelPayload(archiveRecord),
      normalizeWheelPayload(otherArchiveRecord),
      normalizeWheelPayload(liveRecord),
    ]);
    assert.equal(games.length, 2);
    const first = games.find((g) => g.gameUuid === "ab12cd34");
    assert.equal(first?.live, true);
    assert.equal(first?.spinsUsed, 5);
  });
});

describe("ingestWheelGames (local, fake db)", () => {
  it("inserts new games and reports counts", async () => {
    const db = new FakeDb();
    const result = await ingestWheelGames({
      db: db as any,
      uploaderId: "uploader-a",
      games: parseWheelUploadBody([archiveRecord, otherArchiveRecord]).games,
    });
    assert.equal(result.inserted, 2);
    assert.equal(result.updated, 0);

    const docs = db.col("wheel_games").docs;
    assert.equal(docs.length, 2);
    const first = docs.find((d) => d.gameUuid === "ab12cd34");
    assert.equal(first?.uploaderId, "uploader-a");
    assert.equal(first?.live, false);
    assert.equal(first?.dealer, "Asuna Pahlo");
    assert.equal("playerHomeworld" in (first ?? {}), false);
    assert.ok(first?.createdAt instanceof Date);
  });

  it("archive after live keeps the live-only fields", async () => {
    const db = new FakeDb();
    await ingestWheelGames({ db: db as any, uploaderId: "u", games: parseWheelUploadBody(liveRecord).games });
    const second = await ingestWheelGames({
      db: db as any,
      uploaderId: "u",
      games: parseWheelUploadBody([archiveRecord, otherArchiveRecord]).games,
    });
    assert.equal(second.inserted, 1);
    assert.equal(second.updated, 1);

    const docs = db.col("wheel_games").docs;
    assert.equal(docs.length, 2);
    const first = docs.find((d) => d.gameUuid === "ab12cd34");
    assert.equal(first?.live, true);
    assert.equal(first?.dealer, "Raya Serahill");
    assert.equal(first?.playerHomeworld, "Balmung");
    assert.equal(first?.spinsUsed, 5);
  });

  it("live after archive upgrades the document", async () => {
    const db = new FakeDb();
    await ingestWheelGames({ db: db as any, uploaderId: "u", games: parseWheelUploadBody([archiveRecord]).games });
    await ingestWheelGames({ db: db as any, uploaderId: "u", games: parseWheelUploadBody(liveRecord).games });

    const docs = db.col("wheel_games").docs;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].live, true);
    assert.equal(docs[0].dealer, "Raya Serahill");
    assert.equal(docs[0].playerHomeworld, "Balmung");
    assert.equal(docs[0].spinsUsed, 5);
  });

  it("keeps the same game separate per uploader", async () => {
    const db = new FakeDb();
    await ingestWheelGames({ db: db as any, uploaderId: "a", games: parseWheelUploadBody(liveRecord).games });
    await ingestWheelGames({ db: db as any, uploaderId: "b", games: parseWheelUploadBody(liveRecord).games });
    assert.equal(db.col("wheel_games").docs.length, 2);
  });
});

describe("wheel prize auto-valuation (local, fake db)", () => {
  it("infers gil values from prize labels and ignores the rest", async () => {
    const db = new FakeDb();
    const games = parseWheelUploadBody([
      { ...liveRecord, prizes_won: ["1M Gil", "Rare Mount", "250k gil"] },
    ]).games;
    const result = await upsertFormattedGilWheelPrizeValues({ db: db as any, uploaderId: "u", games });
    assert.equal(result.inserted, 2);

    const prizes = db.col("wheel_prizes").docs;
    assert.deepEqual(
      prizes.map((p) => [p.prize, p.value]).sort(),
      [
        ["1M Gil", 1_000_000],
        ["250k gil", 250_000],
      ]
    );
  });

  it("fills a blank value but never overwrites one a dealer set", async () => {
    const db = new FakeDb();
    const prizes = db.col("wheel_prizes");
    await prizes.insertOne({ uploaderId: "u", prize: "1M Gil", value: 999 });
    await prizes.insertOne({ uploaderId: "u", prize: "250k Gil", value: null });

    const games = parseWheelUploadBody([{ ...liveRecord, prizes_won: ["1M Gil", "250k Gil"] }]).games;
    const result = await upsertFormattedGilWheelPrizeValues({ db: db as any, uploaderId: "u", games });
    assert.equal(result.inserted, 0);
    assert.equal(result.updated, 1);

    assert.equal(prizes.findOneSync({ uploaderId: "u", prize: "1M Gil" })?.value, 999);
    assert.equal(prizes.findOneSync({ uploaderId: "u", prize: "250k Gil" })?.value, 250_000);
  });
});
