import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRoundEntries } from "@/lib/gameIngest";
import { computeDedupeKey, displayHandPayout, handPayoutExpr, normalizeRoundTimestamp } from "@/lib/roundMath";

describe("cross-channel round dedupe key", () => {
  it("normalizes the same instant across offsets and formats", () => {
    const utc = normalizeRoundTimestamp("09/03/2026 21.03.04 +00:00");
    assert.match(utc, /^\d+$/);
    assert.equal(normalizeRoundTimestamp("09/03/2026 23.03.04 +02:00"), utc);
    assert.equal(normalizeRoundTimestamp("2026-03-09T21:03:04.000Z"), utc);
    // No offset is read as UTC so every machine derives the same value.
    assert.equal(normalizeRoundTimestamp("09/03/2026 21.03.04"), utc);
    assert.equal(normalizeRoundTimestamp("2026-03-09T21:03:04"), utc);
  });

  it("keeps unparseable strings verbatim and empty input empty", () => {
    assert.equal(normalizeRoundTimestamp("not a date"), "not a date");
    assert.equal(normalizeRoundTimestamp(undefined), "");
    assert.equal(normalizeRoundTimestamp(null), "");
  });

  it("produces the same key for a round arriving live and via CSV export", () => {
    const entries = [
      { PlayerName: "Lini Espi@Alpha", Cards: [10, 7], SplitNum: 0, Bet: 500000, Payout: 1000000, IsDoubleDown: false, Result: 1, Dealer: false, Integrity: 0 },
      { PlayerName: "Dealer@Alpha", Cards: [10, 9], SplitNum: 0, Bet: 0, Payout: 0, IsDoubleDown: false, Result: 3, Dealer: true, Integrity: 0 },
    ];
    // Same decoded content, but the two channels serialize the payload bytes
    // differently and render the timestamp in different offsets.
    const live = parseRoundEntries(JSON.parse(JSON.stringify(entries)));
    const csv = parseRoundEntries(JSON.parse(JSON.stringify(entries, null, 2)));
    const liveKey = computeDedupeKey("09/03/2026 23.03.04 +02:00", live);
    const csvKey = computeDedupeKey("09/03/2026 21.03.04 +00:00", csv);
    assert.equal(liveKey, csvKey);

    // A different second or different content is a different round.
    assert.notEqual(computeDedupeKey("09/03/2026 21.03.05 +00:00", csv), csvKey);
    const other = parseRoundEntries([{ ...entries[0], Bet: 600000 }, entries[1]]);
    assert.notEqual(computeDedupeKey("09/03/2026 21.03.04 +00:00", other), csvKey);
  });
});

describe("split-aware payout read helpers", () => {
  it("displayHandPayout prefers stored handPayout", () => {
    assert.equal(displayHandPayout({ handPayout: 2_000_000, splitNum: 0, payout: 4_000_000 }), 2_000_000);
    assert.equal(displayHandPayout({ handPayout: 0, splitNum: 2, payout: 2_000_000 }), 0);
  });

  it("displayHandPayout falls back split-aware on unrepaired entries", () => {
    // Primary entry carries the player's total; split entries contribute 0.
    assert.equal(displayHandPayout({ splitNum: 0, payout: 4_000_000 }), 4_000_000);
    assert.equal(displayHandPayout({ splitNum: 2, payout: 2_000_000 }), 0);
    assert.equal(displayHandPayout({ payout: 300_000 }), 300_000);
    assert.equal(displayHandPayout({} as never), 0);
  });

  it("displayHandPayout sums match the true player total for a legacy split round", () => {
    // Mirrors test.csv line 5: Miri's real total is 4M, raw entries sum to 6M.
    const entries = [
      { splitNum: 0, payout: 4_000_000 },
      { splitNum: 2, payout: 2_000_000 },
    ];
    assert.equal(entries.reduce((sum, e) => sum + displayHandPayout(e), 0), 4_000_000);
  });

  it("handPayoutExpr encodes the same rule for aggregation pipelines", () => {
    assert.deepEqual(handPayoutExpr(), {
      $ifNull: [
        "$players.handPayout",
        {
          $cond: [
            { $eq: [{ $ifNull: ["$players.splitNum", 0] }, 0] },
            { $ifNull: ["$players.payout", 0] },
            0,
          ],
        },
      ],
    });
    assert.equal((handPayoutExpr("$p") as { $ifNull: unknown[] }).$ifNull[0], "$p.handPayout");
  });
});
