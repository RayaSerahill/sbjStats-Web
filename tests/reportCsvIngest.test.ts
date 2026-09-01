import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { ingestReportCsv } from "@/lib/reportCsvIngest";
import { FakeDb, quiet } from "@/tests/helpers/fakeDb";
import {
  EXPECTED_HOST_PROFIT,
  EXPECTED_ROWS,
  loadGroundTruth,
  loadTestCsvText,
} from "@/tests/helpers/testCsv";

const UPLOADER_A = "uploader-a";
const UPLOADER_B = "uploader-b";

function buildMiniCsv(rows: Array<{ dateTime: string; collected: string; paidOut: string; profit: string; entries: any[] }>) {
  const lines = ["sep=;", "Date and time;Players;Collected;Paid out;Profit;Details"];
  for (const row of rows) {
    const details = Buffer.from(JSON.stringify(row.entries), "utf8").toString("base64");
    lines.push(`${row.dateTime};players;${row.collected};${row.paidOut};${row.profit};${details}`);
  }
  return lines.join("\n");
}

const DEALER_ENTRY = {
  PlayerName: "Dealer Person@Raiden",
  Cards: [10, 9],
  SplitNum: 0,
  Bet: 0,
  Payout: 0,
  IsDoubleDown: false,
  Result: 2,
  Dealer: true,
  Integrity: 0,
};

describe("ingestReportCsv mass import of test.csv (local, fake db)", () => {
  const db = new FakeDb();
  const groundTruth = loadGroundTruth();
  let result: Awaited<ReturnType<typeof ingestReportCsv>>;

  before(async () => {
    result = await quiet(() =>
      ingestReportCsv({ db: db as any, uploaderId: UPLOADER_A, csvText: loadTestCsvText() })
    );
  });

  it("sanity: ground truth reader agrees with the expected report totals", () => {
    assert.equal(groundTruth.length, EXPECTED_ROWS);
    assert.equal(
      groundTruth.reduce((sum, row) => sum + row.profit, 0),
      EXPECTED_HOST_PROFIT
    );
    // The report columns are internally consistent with the payload:
    for (const row of groundTruth) {
      assert.equal(row.collected, row.betSumAllEntries);
      assert.equal(row.paidOut, row.payoutSumSplitZero);
      assert.equal(row.profit, row.collected - row.paidOut);
    }
  });

  it("imports every row of the report", () => {
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.inserted, EXPECTED_ROWS);
    assert.equal(result.ok && result.invalid, 0);
    assert.equal(db.col("games").docs.length, EXPECTED_ROWS);
  });

  it("total stored host profit matches the report (BUG: dot thousand-separators are mis-parsed)", () => {
    // Amount cells like "1.200.000" are not handled by parseAmount:
    //  - two-dot values -> NaN -> silently replaced by payload sums
    //  - one-dot values ("700.000") -> parsed as 700 (1000x too small)
    // The observed result of this sum today is about -287,204,707 instead of
    // the report's actual +726,945,436.
    const totalProfit = db.col("games").docs.reduce((sum, game: any) => sum + (Number(game.profit) || 0), 0);
    assert.equal(totalProfit, EXPECTED_HOST_PROFIT);
  });

  it("every stored game satisfies profit === collected - paidOut", () => {
    const violations = db
      .col("games")
      .docs.filter((game: any) => game.profit !== game.collected - game.paidOut);
    assert.equal(violations.length, 0, `${violations.length} games violate the identity`);
  });

  it("stored collected/paidOut match the report columns per game", () => {
    const truthByDateTime = new Map(groundTruth.map((row) => [row.sourceDateTime, row]));
    let badCollected = 0;
    let badPaidOut = 0;
    for (const game of db.col("games").docs as any[]) {
      const truth = truthByDateTime.get(game.sourceDateTime);
      assert.ok(truth, `no ground-truth row for ${game.sourceDateTime}`);
      if (game.collected !== truth.collected) badCollected++;
      if (game.paidOut !== truth.paidOut) badPaidOut++;
    }
    assert.equal(badCollected, 0, `${badCollected} games store a wrong collected amount`);
    assert.equal(badPaidOut, 0, `${badPaidOut} games store a wrong paidOut amount`);
  });

  it("host stats mirror the report: players' net is the negative of house profit (BUG: split payouts double-counted)", () => {
    // A splitting player's SplitNum 0 entry already carries their TOTAL
    // payout; the ingest sums every entry's Payout, double-counting all
    // SplitNum >= 2 hands (about 1.08B gil across this report).
    const hosts = db.col("stats_host").docs as any[];
    assert.equal(hosts.length, 1);
    const host = hosts[0];
    assert.equal(host.gamesHosted, EXPECTED_ROWS);
    assert.equal(host.betTotal, groundTruth.reduce((sum, row) => sum + row.collected, 0));
    assert.equal(host.payoutTotal, groundTruth.reduce((sum, row) => sum + row.paidOut, 0));
    assert.equal(host.net, -EXPECTED_HOST_PROFIT);
  });

  it("player stats do not double-count split payouts (BUG)", () => {
    const players = db.col("stats_player").docs as any[];
    const totalPlayerBet = players.reduce((sum, p) => sum + (Number(p.betTotal) || 0), 0);
    const totalPlayerPayout = players.reduce((sum, p) => sum + (Number(p.payoutTotal) || 0), 0);
    assert.equal(totalPlayerBet, groundTruth.reduce((sum, row) => sum + row.betSumAllEntries, 0));
    assert.equal(totalPlayerPayout, groundTruth.reduce((sum, row) => sum + row.payoutSumSplitZero, 0));
    const totalPlayerNet = players.reduce((sum, p) => sum + (Number(p.net) || 0), 0);
    assert.equal(totalPlayerNet, -EXPECTED_HOST_PROFIT);
  });

  it("re-importing the same report is idempotent", async () => {
    const hostNetBefore = (db.col("stats_host").docs[0] as any).net;
    const second = await quiet(() =>
      ingestReportCsv({ db: db as any, uploaderId: UPLOADER_A, csvText: loadTestCsvText() })
    );
    assert.equal(second.ok, true);
    assert.equal(second.ok && second.inserted, 0);
    assert.equal(second.ok && second.skipped, EXPECTED_ROWS);
    assert.equal(db.col("games").docs.length, EXPECTED_ROWS);
    assert.equal((db.col("stats_host").docs[0] as any).net, hostNetBefore);
  });
});

describe("ingestReportCsv dedupe scoping (local, fake db)", () => {
  // Deferred to Phase 3: the legacy global { sourceDateTime: 1 } unique index
  // still exists alongside the new per-uploader { uploaderId, dedupeKey }
  // index; once old docs are backfilled and the legacy index is dropped, this
  // starts passing — then remove the todo flag.
  it("a second uploader importing the same report still gets their own games (BUG: sourceDateTime unique index is global)", { todo: "Phase 3 index swap" }, async () => {
    // The { sourceDateTime: 1 } unique index is not scoped by uploaderId, so
    // dealer B's rows are silently dropped whenever dealer A imported games
    // with the same timestamps. This is the "games missing" symptom.
    const db = new FakeDb();
    const csvText = loadTestCsvText();
    await quiet(() => ingestReportCsv({ db: db as any, uploaderId: UPLOADER_A, csvText }));
    const second = await quiet(() => ingestReportCsv({ db: db as any, uploaderId: UPLOADER_B, csvText }));

    assert.equal(second.ok, true);
    assert.equal(second.ok && second.inserted, EXPECTED_ROWS);
    const gamesForB = (db.col("games").docs as any[]).filter((game) => game.uploaderId === UPLOADER_B);
    assert.equal(gamesForB.length, EXPECTED_ROWS);
  });
});

describe("ingestReportCsv amount handling (local, fake db)", () => {
  it("stores payload-derived money and reports columns that disagree", async () => {
    // The payload is the authoritative record; CSV columns are only a
    // cross-check. Here the columns (600.000 collected / 500.000 profit)
    // disagree with the payload (500000 bet), so the payload values are
    // stored and the disagreements are counted.
    const csvText = buildMiniCsv([
      {
        dateTime: "14/04/2026 12:00:00 +02:00",
        collected: "600.000",
        paidOut: "100.000",
        profit: "500.000",
        entries: [
          {
            PlayerName: "Mini Player@Lich",
            Cards: [10, 5],
            SplitNum: 0,
            Bet: 500000,
            Payout: 100000,
            IsDoubleDown: false,
            Result: 3,
            Dealer: false,
            Integrity: 0,
          },
          DEALER_ENTRY,
        ],
      },
    ]);

    const db = new FakeDb();
    const result = await quiet(() => ingestReportCsv({ db: db as any, uploaderId: UPLOADER_A, csvText }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.columnMismatches, 2, "collected and profit cells disagree with the payload");

    const game = db.col("games").docs[0] as any;
    assert.equal(game.collected, 500_000);
    assert.equal(game.paidOut, 100_000);
    assert.equal(game.profit, 400_000);
  });

  it("parses dot-thousand-separator columns so consistent reports cross-check cleanly", async () => {
    const csvText = buildMiniCsv([
      {
        dateTime: "14/04/2026 12:01:00 +02:00",
        collected: "1.200.000",
        paidOut: "2.400.000",
        profit: "-1.200.000",
        entries: [
          {
            PlayerName: "Mini Player@Lich",
            Cards: [11, 4],
            SplitNum: 0,
            Bet: 1200000,
            Payout: 2400000,
            IsDoubleDown: false,
            Result: 1,
            Dealer: false,
            Integrity: 0,
          },
          DEALER_ENTRY,
        ],
      },
    ]);

    const db = new FakeDb();
    const result = await quiet(() => ingestReportCsv({ db: db as any, uploaderId: UPLOADER_A, csvText }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.columnMismatches, 0);

    const game = db.col("games").docs[0] as any;
    assert.equal(game.collected, 1_200_000);
    assert.equal(game.paidOut, 2_400_000);
    assert.equal(game.profit, -1_200_000);
  });
});
