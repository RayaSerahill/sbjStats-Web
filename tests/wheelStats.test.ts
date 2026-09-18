import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateWheelStats, wheelGameSpins, wheelPrizeValue } from "@/lib/wheelStats";
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

  it("prefers the preset version, then configured values, then the label", () => {
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
