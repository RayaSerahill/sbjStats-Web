import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRoundEntries } from "@/lib/gameIngest";
import { repairGames } from "@/lib/statsRepair";
import { FakeDb } from "@/tests/helpers/fakeDb";
import { EXPECTED_HOST_PROFIT, EXPECTED_ROWS, loadGroundTruth, type GroundTruthRow } from "@/tests/helpers/testCsv";

const UPLOADER = "uploader-a";

/**
 * Seeds the fake db with games the way the PRE-Phase-1 ingest stored them:
 * players without handPayout, paidOut inflated by split double-counting, and
 * profit garbled the way the dot-separator parse bug garbled it. Legacy junk
 * stats docs are seeded too, to prove the rebuild replaces them.
 */
function seedLegacyDb(rows: GroundTruthRow[]) {
  const db = new FakeDb();
  const games = db.col("games");

  rows.forEach((row, i) => {
    const parsed = parseRoundEntries(row.entries);
    const legacyPlayers = parsed.map((entry) => {
      const rest: Record<string, unknown> = { ...entry };
      delete rest.handPayout;
      return rest;
    });
    // Legacy corruption: payload sums double-count splits; every 7th profit
    // additionally simulates the 1000x dot-parse truncation.
    const legacyCollected = row.betSumAllEntries;
    const legacyPaidOut = row.payoutSumAllEntries;
    const legacyProfit = i % 7 === 0 ? Math.trunc(row.profit / 1000) : legacyCollected - legacyPaidOut;

    games.docs.push({
      _id: `legacy-game-${i}`,
      createdAt: new Date(Date.UTC(2026, 3, 14, 0, 0, i)),
      sourceDateTime: row.sourceDateTime,
      uploaderId: UPLOADER,
      hostId: "raiden:angyal_hentes",
      gameType: "cards",
      integrity: { version: 1 },
      collected: legacyCollected,
      paidOut: legacyPaidOut,
      profit: legacyProfit,
      players: legacyPlayers,
      payloadBase64: Buffer.from(JSON.stringify(row.entries), "utf8").toString("base64"),
    });
  });

  db.col("stats_player").docs.push({ _id: "junk-1", uploaderId: UPLOADER, playerId: "ghost:player", games: 999, net: 12345 });
  db.col("stats_host").docs.push({ _id: "junk-2", legacyDocWithoutUploader: true, gamesHosted: 42 });
  return db;
}

describe("repairGames on legacy-corrupted data (local, fake db)", () => {
  const rows = loadGroundTruth();

  it("recomputes money from payloads, backfills dedupeKey/handPayout, and rebuilds stats", async () => {
    const db = seedLegacyDb(rows);
    const report = await repairGames({ db: db as any });

    assert.equal(report.scanned, EXPECTED_ROWS);
    assert.equal(report.repaired, EXPECTED_ROWS);
    assert.equal(report.alreadyCorrect, 0);
    assert.equal(report.payloadFallback, 0);
    assert.equal(report.dedupeCollisions, 0);
    assert.equal(report.anomalies.length, 0);

    const games = db.col("games").docs as any[];
    let profitSum = 0;
    for (const game of games) {
      profitSum += game.profit;
      assert.equal(game.profit, game.collected - game.paidOut);
      assert.match(String(game.dedupeKey), /^[0-9a-f]{64}$/);
      assert.equal(game.integrity?.version, 2);
      assert.ok(game.players.every((p: any) => typeof p.handPayout === "number"));
      // The pre-repair values are preserved.
      assert.ok(game.repair?.at instanceof Date);
      assert.equal(typeof game.repair.prev.profit, "number");
    }
    assert.equal(profitSum, EXPECTED_HOST_PROFIT);

    // Rebuilt host stats mirror the corrected games; junk docs are gone.
    const hosts = db.col("stats_host").docs as any[];
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0].gamesHosted, EXPECTED_ROWS);
    assert.equal(hosts[0].net, -EXPECTED_HOST_PROFIT);
    assert.equal(hosts[0].betTotal, rows.reduce((s, r) => s + r.collected, 0));
    assert.equal(hosts[0].payoutTotal, rows.reduce((s, r) => s + r.paidOut, 0));

    const players = db.col("stats_player").docs as any[];
    assert.ok(!players.some((p) => p.playerId === "ghost:player"), "junk stats doc must be replaced");
    assert.equal(players.reduce((s, p) => s + p.net, 0), -EXPECTED_HOST_PROFIT);

    // The report's before/after mirrors what dealers saw vs. what is stored now.
    assert.equal(report.perUploader.length, 1);
    assert.equal(report.perUploader[0].profitAfter, EXPECTED_HOST_PROFIT);
    assert.ok(report.perUploader[0].profitBefore !== EXPECTED_HOST_PROFIT);
  });

  it("is idempotent: a second run changes nothing and keeps the original repair snapshot", async () => {
    const db = seedLegacyDb(rows);
    await repairGames({ db: db as any, now: new Date("2026-09-01T10:00:00Z") });
    const snapshot = JSON.stringify((db.col("games").docs[0] as any).repair);

    const second = await repairGames({ db: db as any, now: new Date("2026-09-02T10:00:00Z") });
    assert.equal(second.repaired, 0);
    assert.equal(second.alreadyCorrect, EXPECTED_ROWS);
    assert.equal(JSON.stringify((db.col("games").docs[0] as any).repair), snapshot);

    const hosts = db.col("stats_host").docs as any[];
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0].net, -EXPECTED_HOST_PROFIT);
  });

  it("dry-run reports the full repair but writes nothing", async () => {
    const db = seedLegacyDb(rows.slice(0, 50));
    const before = JSON.stringify(db.col("games").docs);

    const report = await repairGames({ db: db as any, dryRun: true });
    assert.equal(report.dryRun, true);
    assert.equal(report.repaired, 50);
    assert.equal(JSON.stringify(db.col("games").docs), before, "games must be untouched");
    assert.ok((db.col("stats_player").docs as any[]).some((p) => p.playerId === "ghost:player"), "stats must be untouched");
  });

  it("removes cross-channel duplicates of the same round and keeps the original", async () => {
    const entries = [
      { PlayerName: "Lini Espi@Alpha", Cards: [10, 7], SplitNum: 0, Bet: 500_000, Payout: 1_000_000, IsDoubleDown: false, Result: 1, Dealer: false, Integrity: 0 },
      { PlayerName: "Angyal Hentes@Raiden", Cards: [10, 9], SplitNum: 0, Bet: 0, Payout: 0, IsDoubleDown: false, Result: 3, Dealer: true, Integrity: 0 },
    ];
    const db = new FakeDb();
    const base = {
      uploaderId: UPLOADER,
      hostId: "raiden:angyal_hentes",
      gameType: "cards",
      integrity: { version: 1 },
      players: parseRoundEntries(entries),
    };
    // The original (live upload, local offset, compact payload bytes)...
    db.col("games").docs.push({
      ...base,
      _id: "live-original",
      createdAt: new Date("2026-03-09T21:03:04Z"),
      sourceDateTime: "09/03/2026 23.03.04 +02:00",
      payloadBase64: Buffer.from(JSON.stringify(entries)).toString("base64"),
    });
    // ...and the same round re-imported from the CSV export (UTC offset,
    // differently serialized payload bytes, later createdAt).
    db.col("games").docs.push({
      ...base,
      _id: "csv-reimport",
      createdAt: new Date("2026-09-02T10:00:00Z"),
      sourceDateTime: "09/03/2026 21.03.04 +00:00",
      payloadBase64: Buffer.from(JSON.stringify(entries, null, 2)).toString("base64"),
    });

    const report = await repairGames({ db: db as any });
    assert.equal(report.duplicatesRemoved, 1);
    assert.equal(report.scanned, 1);

    const remaining = db.col("games").docs as any[];
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]._id, "live-original", "the earliest doc is kept");

    const host = db.col("stats_host").docs[0] as any;
    assert.equal(host.gamesHosted, 1, "stats count the round once");
    assert.equal(host.net, 500_000);

    // Idempotent: nothing left to remove.
    const second = await repairGames({ db: db as any });
    assert.equal(second.duplicatesRemoved, 0);
    assert.equal(second.alreadyCorrect, 1);
  });

  it("repairs live-style docs without payloadBase64 via the fallback grouping", async () => {
    const db = new FakeDb();
    // A split round stored by the legacy live path: no payloadBase64, raw
    // payouts double-counted (4M total on SplitNum 0 + 2M repeated).
    db.col("games").docs.push({
      _id: "live-1",
      createdAt: new Date("2026-04-14T00:11:42Z"),
      sourceDateTime: null,
      uploaderId: UPLOADER,
      hostId: "raiden:angyal_hentes",
      gameType: "cards",
      integrity: { version: 1 },
      players: [
        { playerId: "raiden:miri_swiftspark", playerTag: "Miri Swiftspark@Raiden", name: "Miri Swiftspark", world: "Raiden", dealer: false, splitNum: 0, bet: 1_000_000, payout: 4_000_000, isDoubleDown: false, result: 1, cards: [2, 7, 10], comboKey: "2-7-10", integrity: 0 },
        { playerId: "raiden:miri_swiftspark", playerTag: "Miri Swiftspark@Raiden", name: "Miri Swiftspark", world: "Raiden", dealer: false, splitNum: 2, bet: 1_000_000, payout: 2_000_000, isDoubleDown: false, result: 1, cards: [2, 10, 8], comboKey: "2-10-8", integrity: 0 },
        { playerId: "raiden:angyal_hentes", playerTag: "Angyal Hentes@Raiden", name: "Angyal Hentes", world: "Raiden", dealer: true, splitNum: 0, bet: 0, payout: 0, isDoubleDown: false, result: 0, cards: [5, 13, 9], comboKey: "5-13-9", integrity: 0 },
      ],
    });

    const first = await repairGames({ db: db as any });
    assert.equal(first.payloadFallback, 1);
    assert.equal(first.repaired, 1);

    const game = db.col("games").docs[0] as any;
    assert.equal(game.collected, 2_000_000);
    assert.equal(game.paidOut, 4_000_000);
    assert.equal(game.profit, -2_000_000);
    assert.equal(game.players[0].handPayout, 2_000_000);
    assert.equal(game.players[1].handPayout, 2_000_000);

    // Fallback dedupe keys must be stable so re-runs stay idempotent.
    const keyAfterFirst = game.dedupeKey;
    const second = await repairGames({ db: db as any });
    assert.equal(second.repaired, 0);
    assert.equal(second.alreadyCorrect, 1);
    assert.equal((db.col("games").docs[0] as any).dedupeKey, keyAfterFirst);
  });
});
