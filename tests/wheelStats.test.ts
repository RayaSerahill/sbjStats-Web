import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateWheelStats, wheelGameSpins, wheelHallOfFame, wheelOutcomeSlices, wheelPrizeValue } from "@/lib/wheelStats";
import { normalizeWheelSegment } from "@/lib/wheelPresets";

const DAY = 86_400;
const T0 = 1_700_000_000; // 2023-11-14 22:13 UTC

const gilSeg = (value: string, millions: number) =>
  normalizeWheelSegment({ type: "string", value, value_type_gil: true, gil_value: millions, win: true });
const textSeg = (value: string) => normalizeWheelSegment({ type: "string", value, value_type_gil: false });

const presetV1 = { _id: "p1", name: "Small", version: 1, segments: [gilSeg("1M gil", 1), gilSeg("Half", 0.5), textSeg("5 FREE SPINS")] };
const presetV2 = { _id: "p2", name: "Small", version: 2, segments: [gilSeg("1M gil", 2)] };

describe("wheelGameSpins", () => {
  it("trusts spinsUsed when present and counts prizes otherwise", () => {
    assert.equal(wheelGameSpins({ spinsUsed: 4, prizesWon: ["a"] }), 4);
    assert.equal(wheelGameSpins({ prizesWon: ["a", "b", "c"] }), 3);
    assert.equal(wheelGameSpins({}), 0);
  });
});

describe("wheelPrizeValue", () => {
  const configured = new Map([["Rare Mount", 3_000_000]]);

  it("prefers a manual override, then the preset version, then the label", () => {
    assert.equal(wheelPrizeValue("1M gil", presetV2.segments, new Map([["1M gil", 7]])), 7);
    assert.equal(wheelPrizeValue("1M gil", presetV2.segments, configured), 2_000_000);
    assert.equal(wheelPrizeValue("Half", presetV1.segments, configured), 500_000);
    assert.equal(wheelPrizeValue("Rare Mount", presetV1.segments, configured), 3_000_000);
    assert.equal(wheelPrizeValue("250K gil", undefined, configured), 250_000);
  });

  it("values multipliers, free spins and unknown labels at zero", () => {
    assert.equal(wheelPrizeValue("x5", presetV1.segments, configured), 0);
    assert.equal(wheelPrizeValue("5 FREE SPINS", presetV1.segments, configured), 0);
    assert.equal(wheelPrizeValue("Mystery", undefined, new Map()), 0);
    assert.equal(wheelPrizeValue("", presetV1.segments, configured), 0);
  });
});

describe("calculateWheelStats", () => {
  const games = [
    { _id: 1, playerName: "Lini Espi", archivedAt: T0, preset: "Small", presetId: "p1", prizesWon: ["1M gil", "Half"] },
    { _id: 2, playerName: "lini espi", archivedAt: T0 + DAY, preset: "Small", presetId: "p2", prizesWon: ["1M gil"] },
    { _id: 3, playerName: "Rini", archivedAt: T0 + DAY, preset: "Small", presetId: "p2", spinsUsed: 5, prizesWon: ["x5", "x0.5"] },
    { _id: 4, playerName: "Someone Else", archivedAt: T0, preset: "Big", prizesWon: ["250K gil", "Rare Mount"] },
  ];
  const input = {
    games,
    presets: [presetV1, presetV2],
    prizes: [{ prize: "Rare Mount", value: 3_000_000 }],
    aliases: [{ primaryTag: "Lini Espi", aliasTag: "Rini" }],
  };

  it("totals games, spins and gil using each game's own preset version", () => {
    const stats = calculateWheelStats(input);
    assert.equal(stats.totalGames, 4);
    assert.equal(stats.totalSpins, 2 + 1 + 5 + 2);
    // 1.5M (v1) + 2M (v2) + 0 (multipliers) + 250K + 3M
    assert.equal(stats.totalWinValue, 1_500_000 + 2_000_000 + 250_000 + 3_000_000);
  });

  it("reports the last hosting day separately", () => {
    const stats = calculateWheelStats(input);
    assert.equal(stats.new.totalGames, 2);
    assert.equal(stats.new.totalSpins, 6);
    assert.equal(stats.new.totalWinValue, 2_000_000);
  });

  it("builds a sorted daily series", () => {
    const stats = calculateWheelStats(input);
    assert.deepEqual(
      stats.dailyProfits.map((d) => [d.date, d.totalGames, d.totalSpins, d.totalWinValue]),
      [
        ["2023-11-14", 2, 4, 1_500_000 + 250_000 + 3_000_000],
        ["2023-11-15", 2, 6, 2_000_000],
      ]
    );
  });

  it("merges aliases and case variants into one player, sorted by gil won", () => {
    const stats = calculateWheelStats(input);
    assert.deepEqual(
      stats.players.map((p) => [p.name, p.totalGames, p.totalSpins, p.totalWinValue]),
      [
        ["Lini Espi", 3, 8, 3_500_000],
        ["Someone Else", 1, 2, 3_250_000],
      ]
    );
    assert.deepEqual(
      stats.players[0].prizes.map((p) => [p.name, p.value, p.totalWinValue]),
      [
        ["1M gil", 2, 3_000_000],
        ["Half", 1, 500_000],
        ["x0.5", 1, 0],
        ["x5", 1, 0],
      ]
    );
  });

  it("lists prizes with counts and an average value across versions", () => {
    const stats = calculateWheelStats(input);
    const oneMil = stats.prizes.find((p) => p.name === "1M gil");
    assert.deepEqual(oneMil, { name: "1M gil", value: 2, prizeValue: 1_500_000, totalWinValue: 3_000_000 });
  });

  it("handles no games at all", () => {
    const stats = calculateWheelStats({ games: [], presets: [], prizes: [], aliases: [] });
    assert.equal(stats.totalGames, 0);
    assert.deepEqual(stats.dailyProfits, []);
    assert.deepEqual(stats.players, []);
    assert.deepEqual(stats.prizes, []);
  });
});

describe("wheelHallOfFame", () => {
  const player = (name: string, totalGames: number, totalSpins: number, totalWinValue: number) => ({
    name,
    totalGames,
    totalSpins,
    totalWinValue,
    prizes: [],
  });

  it("crowns the biggest winner, busiest spinner and most frequent player", () => {
    const fame = wheelHallOfFame([player("Lini", 3, 10, 5_000_000), player("Rini", 9, 40, 1_000_000), player("Nini", 1, 1, 0)]);
    assert.deepEqual(fame.biggestWinner, { name: "Lini", value: 5_000_000 });
    assert.deepEqual(fame.mostSpins, { name: "Rini", value: 40 });
    assert.deepEqual(fame.mostGames, { name: "Rini", value: 9 });
  });

  it("only lets seasoned spinners be the luckiest, unless nobody is seasoned", () => {
    const seasoned = wheelHallOfFame([player("Lucky", 1, 1, 10_000_000), player("Steady", 4, 10, 5_000_000)]);
    assert.deepEqual(seasoned.luckiestSpinner, { name: "Steady", value: 500_000 });

    const fresh = wheelHallOfFame([player("Lucky", 1, 1, 10_000_000), player("Meh", 1, 2, 1_000_000)]);
    assert.deepEqual(fresh.luckiestSpinner, { name: "Lucky", value: 10_000_000 });
  });

  it("leaves the podium empty when nobody has played", () => {
    assert.deepEqual(wheelHallOfFame([]), { biggestWinner: null, mostSpins: null, mostGames: null, luckiestSpinner: null });
  });
});

describe("wheelOutcomeSlices", () => {
  const prize = (name: string, value: number) => ({ name, value, prizeValue: 0, totalWinValue: 0 });

  it("keeps the top prizes and folds the tail into Other", () => {
    const slices = wheelOutcomeSlices([prize("a", 10), prize("b", 8), prize("c", 3), prize("d", 2), prize("e", 1), prize("f", 1)], 4);
    assert.deepEqual(slices, [
      { name: "a", count: 10 },
      { name: "b", count: 8 },
      { name: "c", count: 3 },
      { name: "Other", count: 4 },
    ]);
  });

  it("does not bother with Other when everything fits", () => {
    assert.deepEqual(wheelOutcomeSlices([prize("a", 2), prize("zero", 0)]), [{ name: "a", count: 2 }]);
  });
});
