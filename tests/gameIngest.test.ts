import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decodeRoundPayload,
  ingestRound,
  parseRoundEntries,
  playerTagToParts,
  toComboKey,
} from "@/lib/gameIngest";
import { FakeDb } from "@/tests/helpers/fakeDb";

describe("payload parsing", () => {
  it("splits player tags into name/world", () => {
    assert.deepEqual(playerTagToParts("Miri Swiftspark@Raiden"), {
      name: "Miri Swiftspark",
      world: "Raiden",
      playerTag: "Miri Swiftspark@Raiden",
    });
  });

  it("strips trailing instance markers like ' [1]' so stats aggregate on one identity", () => {
    assert.equal(playerTagToParts("Miri Swiftspark@Raiden [1]").playerTag, "Miri Swiftspark@Raiden");
  });

  it("keeps combo keys order-sensitive", () => {
    assert.equal(toComboKey([10, 2]), "10-2");
    assert.equal(toComboKey([2, 10]), "2-10");
  });

  it("decodes base64 payloads and direct JSON alike", () => {
    const entries = [{ PlayerName: "A@W", Cards: [2, 3], Bet: 1, Payout: 2, Result: 1, Dealer: false }];
    const json = JSON.stringify(entries);
    const b64 = Buffer.from(json, "utf8").toString("base64");
    assert.deepEqual(decodeRoundPayload(json).entries, entries);
    assert.deepEqual(decodeRoundPayload(b64).entries, entries);
    assert.equal(decodeRoundPayload(b64).payloadBase64, b64);
  });

  it("coerces numeric fields defensively", () => {
    const [entry] = parseRoundEntries([
      { PlayerName: "A@W", Cards: [10, "4" as any], Bet: "100" as any, Payout: undefined, Result: 1 },
    ]);
    assert.equal(entry.bet, 100);
    assert.equal(entry.payout, 0);
    assert.deepEqual(entry.cards, [10, 4]);
  });
});

describe("ingestRound split-hand accounting (local, fake db)", () => {
  // Mirrors a real row from test.csv (line 5): when a player splits, their
  // SplitNum 0 entry carries the TOTAL payout for all of their hands, and the
  // SplitNum >= 2 entries repeat each split hand individually.
  //
  // Miri: two hands, 1M bet each, each paid 2M -> total payout 4M.
  //   entry SplitNum 0: Bet 1M, Payout 4M (total)
  //   entry SplitNum 2: Bet 1M, Payout 2M (the split hand alone)
  // Garlond: one hand, 100k bet, paid 200k.
  const entries = [
    { PlayerName: "Miri Swiftspark@Raiden [1]", Cards: [2, 7, 10], SplitNum: 0, Bet: 1_000_000, Payout: 4_000_000, IsDoubleDown: false, Result: 1, Dealer: false, Integrity: 0 },
    { PlayerName: "Miri Swiftspark@Raiden [1]", Cards: [2, 10, 8], SplitNum: 2, Bet: 1_000_000, Payout: 2_000_000, IsDoubleDown: false, Result: 1, Dealer: false, Integrity: 0 },
    { PlayerName: "Garlond Phyllis@Lich", Cards: [10, 9], SplitNum: 0, Bet: 100_000, Payout: 200_000, IsDoubleDown: false, Result: 1, Dealer: false, Integrity: 0 },
    { PlayerName: "Angyal Hentes@Raiden", Cards: [5, 13, 9], SplitNum: 0, Bet: 0, Payout: 0, IsDoubleDown: false, Result: 0, Dealer: true, Integrity: 0 },
  ];

  it("does not double-count a splitting player's payout (BUG)", async () => {
    const db = new FakeDb();
    const result = await ingestRound({
      db: db as any,
      uploaderId: "uploader-a",
      payload: JSON.stringify(entries),
      sourceDateTime: "14/04/2026 00:11:42 +02:00",
    });
    assert.equal(result.ok, true);

    const miri = db.col("stats_player").findOneSync({ playerId: "raiden:miri_swiftspark" }) as any;
    assert.ok(miri, "expected stats for Miri");
    assert.equal(miri.betTotal, 2_000_000, "both split hands bet");
    // Total payout is 4M (already aggregated on the SplitNum 0 entry).
    // Current code sums 4M + 2M = 6M.
    assert.equal(miri.payoutTotal, 4_000_000);
    assert.equal(miri.net, 2_000_000);

    const host = db.col("stats_host").findOneSync({ hostId: "raiden:angyal_hentes" }) as any;
    assert.ok(host, "expected host stats");
    assert.equal(host.betTotal, 2_100_000);
    assert.equal(host.payoutTotal, 4_200_000);
    // House lost exactly what the players won.
    assert.equal(host.net, 2_100_000);
  });
});
