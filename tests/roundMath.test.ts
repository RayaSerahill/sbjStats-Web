import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { displayHandPayout, handPayoutExpr } from "@/lib/roundMath";

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
