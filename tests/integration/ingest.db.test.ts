import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MongoClient, type Db } from "mongodb";
import { ingestReportCsv } from "@/lib/reportCsvIngest";
import { quiet } from "@/tests/helpers/fakeDb";
import { EXPECTED_HOST_PROFIT, EXPECTED_ROWS, loadGroundTruth, loadTestCsvText } from "@/tests/helpers/testCsv";

/**
 * Opt-in integration test against a REAL MongoDB — always the `gamba_test`
 * database, never `gamba`.
 *
 * Run with:  npm run test:db
 * (requires RUN_DB_TESTS=1 and MONGODB_URI; the script loads .env)
 *
 * Take a backup first, e.g.:
 *   mongodump --uri "$MONGODB_URI" --db gamba --out backups/$(date +%Y%m%d-%H%M%S)
 */

const TEST_DB_NAME = "gamba_test";
const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.MONGODB_URI);

describe("ingestReportCsv against gamba_test (integration)", { skip: !enabled ? "set RUN_DB_TESTS=1 and MONGODB_URI to enable" : false }, () => {
  let client: MongoClient;
  let db: Db;

  before(async () => {
    client = new MongoClient(process.env.MONGODB_URI as string);
    await client.connect();
    db = client.db(TEST_DB_NAME);
    assert.equal(db.databaseName, TEST_DB_NAME, "integration tests must only ever touch gamba_test");

    // Fresh slate + the unique index that governs import dedupe (lib/db.ts).
    for (const name of ["games", "players", "stats_player", "stats_host", "stats_combo"]) {
      await db.collection(name).drop().catch(() => {});
    }
    await db.collection("games").createIndex({ sourceDateTime: 1 }, { unique: true, sparse: true });
  });

  after(async () => {
    await client?.close();
  });

  it("imports test.csv and stores the report's host profit", async () => {
    const result = await quiet(() =>
      ingestReportCsv({ db, uploaderId: "integration-test-uploader", csvText: loadTestCsvText() })
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.inserted, EXPECTED_ROWS);

    const [row] = await db
      .collection("games")
      .aggregate([
        { $match: { uploaderId: "integration-test-uploader" } },
        { $group: { _id: null, profit: { $sum: { $ifNull: ["$profit", 0] } }, games: { $sum: 1 } } },
      ])
      .toArray();

    assert.equal(row?.games, EXPECTED_ROWS);
    assert.equal(row?.profit, EXPECTED_HOST_PROFIT);
  });

  it("host stats net mirrors the report", async () => {
    const groundTruth = loadGroundTruth();
    const host = await db.collection("stats_host").findOne({ uploaderId: "integration-test-uploader" });
    assert.ok(host, "expected a stats_host doc");
    assert.equal(host.gamesHosted, EXPECTED_ROWS);
    assert.equal(host.betTotal, groundTruth.reduce((sum, r) => sum + r.collected, 0));
    assert.equal(host.payoutTotal, groundTruth.reduce((sum, r) => sum + r.paidOut, 0));
    assert.equal(host.net, -EXPECTED_HOST_PROFIT);
  });
});
