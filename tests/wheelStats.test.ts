import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateWheelStats,
  wheelGameSpins,
  wheelHallOfFame,
  wheelOutcomeSlices,
  wheelPrizeIsBankrupt,
  wheelPrizeValue,
  wheelRecentDays,
} from "@/lib/wheelStats";
import { normalizeWheelSegment } from "@/lib/wheelPresets";

const DAY = 86_400;
const T0 = 1_700_000_000; // 2023-11-14 22:13 UTC

const gilSeg = (value: string, millions: number) =>
  normalizeWheelSegment({ type: "string", value, value_type_gil: true, gil_value: millions, win: true });
const textSeg = (value: string) => normalizeWheelSegment({ type: "string", value, value_type_gil: false });

const bustSeg = (value: string) => normalizeWheelSegment({ type: "string", value, bankrupt: true });

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

describe("wheelPrizeIsBankrupt", () => {
  const segments = [gilSeg("1M gil", 1), bustSeg("Oops")];

  it("trusts the preset segment when the game has one", () => {
    assert.equal(wheelPrizeIsBankrupt("Oops", segments), true);
    assert.equal(wheelPrizeIsBankrupt("oops ", segments), true);
    assert.equal(wheelPrizeIsBankrupt("1M gil", segments), false);
  });

  it("falls back to the label when the segment is unknown", () => {
    assert.equal(wheelPrizeIsBankrupt("BANKRUPT", segments), true);
    assert.equal(wheelPrizeIsBankrupt("Bankrupt!", undefined), true);
    assert.equal(wheelPrizeIsBankrupt("2M gil", undefined), false);
    assert.equal(wheelPrizeIsBankrupt("", undefined), false);
  });
});

describe("calculateWheelStats with bankrupts", () => {
  const preset = { _id: "b1", name: "Bust", version: 1, segments: [gilSeg("2M gil", 2), gilSeg("1M gil", 1), bustSeg("BANKRUPT")] };

  it("wipes the pot on a bankrupt and remembers what was lost", () => {
    const stats = calculateWheelStats({
      games: [{ _id: 1, playerName: "Lini", archivedAt: T0, presetId: "b1", prizesWon: ["2M gil", "1M gil", "BANKRUPT", "1M gil"] }],
      presets: [preset],
      prizes: [],
      aliases: [],
    });
    assert.equal(stats.totalWinValue, 1_000_000);
    assert.equal(stats.bankrupts, 1);
    assert.equal(stats.lostToBankrupt, 3_000_000);
    assert.equal(stats.players[0].totalWinValue, 1_000_000);
    assert.equal(stats.players[0].bankrupts, 1);
    assert.equal(stats.players[0].lostToBankrupt, 3_000_000);
    assert.equal(stats.new.totalWinValue, 1_000_000);
  });

  it("counts a bankrupt as a landed prize worth nothing", () => {
    const stats = calculateWheelStats({
      games: [{ _id: 1, playerName: "Lini", archivedAt: T0, presetId: "b1", prizesWon: ["BANKRUPT", "BANKRUPT"] }],
      presets: [preset],
      prizes: [],
      aliases: [],
    });
    assert.equal(stats.totalWinValue, 0);
    assert.equal(stats.bankrupts, 2);
    assert.equal(stats.lostToBankrupt, 0);
    assert.deepEqual(stats.prizes, [{ name: "BANKRUPT", value: 2, prizeValue: 0, totalWinValue: 0 }]);
  });

  it("spots a bankrupt by label when the game has no preset", () => {
    const stats = calculateWheelStats({
      games: [{ _id: 1, playerName: "Lini", archivedAt: T0, prizesWon: ["500K gil", "Bankrupt"] }],
      presets: [],
      prizes: [],
      aliases: [],
    });
    assert.equal(stats.totalWinValue, 0);
    assert.equal(stats.lostToBankrupt, 500_000);
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
  const player = (name: string, totalGames: number, totalSpins: number, totalWinValue: number, bankrupts = 0) => ({
    name,
    totalGames,
    totalSpins,
    totalWinValue,
    bankrupts,
    lostToBankrupt: 0,
    prizes: [],
  });

  it("crowns the biggest winner, busiest spinner, most frequent player and most bankrupt", () => {
    const fame = wheelHallOfFame([player("Lini", 3, 10, 5_000_000, 2), player("Rini", 9, 40, 1_000_000, 7), player("Nini", 1, 1, 0)]);
    assert.deepEqual(fame.biggestWinner, { name: "Lini", value: 5_000_000 });
    assert.deepEqual(fame.mostSpins, { name: "Rini", value: 40 });
    assert.deepEqual(fame.mostGames, { name: "Rini", value: 9 });
    assert.deepEqual(fame.mostBankrupt, { name: "Rini", value: 7 });
  });

  it("only lets seasoned spinners be the luckiest, unless nobody is seasoned", () => {
    const seasoned = wheelHallOfFame([player("Lucky", 1, 1, 10_000_000), player("Steady", 4, 10, 5_000_000)]);
    assert.deepEqual(seasoned.luckiestSpinner, { name: "Steady", value: 500_000 });

    const fresh = wheelHallOfFame([player("Lucky", 1, 1, 10_000_000), player("Meh", 1, 2, 1_000_000)]);
    assert.deepEqual(fresh.luckiestSpinner, { name: "Lucky", value: 10_000_000 });
  });

  it("leaves the podium empty when nobody has played", () => {
    assert.deepEqual(wheelHallOfFame([]), {
      biggestWinner: null,
      mostSpins: null,
      mostGames: null,
      mostBankrupt: null,
      luckiestSpinner: null,
    });
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

describe("wheelRecentDays", () => {
  it("pads quiet days with zeros and ends on the newest hosting day", () => {
    const daily = [
      { date: "2024-01-01", totalGames: 1, totalSpins: 2, totalWinValue: 3 },
      { date: "2024-01-03", totalGames: 4, totalSpins: 5, totalWinValue: 6 },
    ];
    assert.deepEqual(wheelRecentDays(daily, 4), [
      { date: "2023-12-31", totalGames: 0, totalSpins: 0, totalWinValue: 0 },
      daily[0],
      { date: "2024-01-02", totalGames: 0, totalSpins: 0, totalWinValue: 0 },
      daily[1],
    ]);
  });

  it("returns nothing for an empty series", () => {
    assert.deepEqual(wheelRecentDays([], 30), []);
  });
});
