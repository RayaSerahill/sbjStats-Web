import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarblesPlayerStatsRow } from "@/lib/marblesPlayers";
import {
  marblesHostName,
  normalizeHiddenMarblesHosts,
  normalizeMarblesHostName,
  withoutHiddenMarblesHosts,
} from "@/lib/marblesSettings";
import { calculateMarblesStats, summarizeMarblesHosts, type MarblesStatsGameRow } from "@/lib/marblesStats";

const RAYA = "Raya' Serahill@Alpha";
const LINI = "Lini Espi@Alpha";

function game(gameId: string, over: Partial<MarblesStatsGameRow> = {}): MarblesStatsGameRow {
  return {
    gameId,
    status: "completed",
    startedAt: 1_000,
    totalRaces: 1,
    totalPlayers: 2,
    totalTaken: 2_000,
    totalPayouts: 1_500,
    totalVenueCut: 0,
    totalBoost: 0,
    tournament: false,
    creatorName: "Raya' Serahill",
    creatorWorld: "Alpha",
    mine: true,
    ...over,
  };
}

function entry(gameId: string, playerName: string, over: Partial<MarblesPlayerStatsRow> = {}): MarblesPlayerStatsRow {
  return {
    gameId,
    playerKey: `${playerName.toLowerCase()}@`,
    playerName,
    startedAt: 1_000,
    tournament: false,
    marbles: 1,
    spent: 1_000,
    winnings: 0,
    racesEntered: 1,
    racesWon: 0,
    ...over,
  };
}

describe("marblesHostName", () => {
  it("joins the character and her world", () => {
    assert.equal(marblesHostName("Raya' Serahill", "Alpha"), "Raya' Serahill@Alpha");
  });

  it("trims both halves", () => {
    assert.equal(marblesHostName("  Lini Espi ", " Alpha  "), "Lini Espi@Alpha");
  });

  it("is the bare name when the world is missing or blank", () => {
    assert.equal(marblesHostName("Console", ""), "Console");
    assert.equal(marblesHostName("Console", undefined), "Console");
    assert.equal(marblesHostName("Console", null), "Console");
  });

  it("is empty when there is no name, world or not", () => {
    assert.equal(marblesHostName("", "Alpha"), "");
    assert.equal(marblesHostName("   ", "Alpha"), "");
    assert.equal(marblesHostName(undefined, "Alpha"), "");
    assert.equal(marblesHostName(42, "Alpha"), "");
  });
});

describe("normalizeHiddenMarblesHosts", () => {
  it("trims, drops blanks and non-strings, dedupes and sorts", () => {
    assert.deepEqual(
      normalizeHiddenMarblesHosts([" Raya' Serahill@Alpha ", "Lini Espi@Alpha", "", "   ", 7, null, "Lini Espi@Alpha"]),
      ["Lini Espi@Alpha", "Raya' Serahill@Alpha"]
    );
  });

  it("is an empty list for anything that is not an array", () => {
    assert.deepEqual(normalizeHiddenMarblesHosts(undefined), []);
    assert.deepEqual(normalizeHiddenMarblesHosts(null), []);
    assert.deepEqual(normalizeHiddenMarblesHosts("Raya' Serahill@Alpha"), []);
    assert.deepEqual(normalizeHiddenMarblesHosts({ 0: "Raya' Serahill@Alpha" }), []);
  });

  it("keeps a host name exactly as trimmed", () => {
    assert.equal(normalizeMarblesHostName("  Raya' Serahill@Alpha "), "Raya' Serahill@Alpha");
    assert.equal(normalizeMarblesHostName(undefined), "");
  });
});

describe("withoutHiddenMarblesHosts", () => {
  const games = [
    { gameId: "a", creatorName: "Raya' Serahill", creatorWorld: "Alpha" },
    { gameId: "b", creatorName: "Lini Espi", creatorWorld: "Alpha" },
    { gameId: "c", creatorName: "Raya' Serahill", creatorWorld: "Lich" },
    { gameId: "d", creatorName: "Console" },
    { gameId: "e" },
  ];

  it("hands back the very same list when nobody is hidden", () => {
    assert.equal(withoutHiddenMarblesHosts(games, []), games);
  });

  it("takes out every game of a hidden host and nobody else's", () => {
    const left = withoutHiddenMarblesHosts(games, ["Raya' Serahill@Alpha"]);
    assert.deepEqual(left.map((game) => game.gameId), ["b", "c", "d", "e"]);
  });

  it("tells the same name on two worlds apart", () => {
    const left = withoutHiddenMarblesHosts(games, ["Raya' Serahill@Lich"]);
    assert.deepEqual(left.map((game) => game.gameId), ["a", "b", "d", "e"]);
  });

  it("matches a host with no world by her bare name", () => {
    const left = withoutHiddenMarblesHosts(games, ["Console"]);
    assert.deepEqual(left.map((game) => game.gameId), ["a", "b", "c", "e"]);
  });

  it("never hides a game that has no host name", () => {
    const left = withoutHiddenMarblesHosts(games, ["", "Raya' Serahill@Alpha", "Lini Espi@Alpha", "Raya' Serahill@Lich", "Console"]);
    assert.deepEqual(left.map((game) => game.gameId), ["e"]);
  });

  it("ignores a hidden host that has no games", () => {
    assert.equal(withoutHiddenMarblesHosts(games, ["Nobody Here@Omega"]).length, games.length);
  });
});

describe("calculateMarblesStats with hidden hosts", () => {
  // Two of the dealer's characters host; Asuna races under both, Lyn only under the alt.
  const games = [
    game("raya1", { startedAt: 3_000 }),
    game("raya2", { startedAt: 2_000, tournament: true, totalRaces: 3 }),
    game("lini1", { startedAt: 1_000, creatorName: "Lini Espi", totalTaken: 5_000, totalPayouts: 4_000 }),
  ];
  const players = [
    entry("raya1", "Asuna", { winnings: 1_500, racesWon: 1 }),
    entry("raya1", "Kirito"),
    entry("raya2", "Asuna", { tournament: true, racesEntered: 3, racesWon: 2, tournamentPlace: 1, winnings: 1_500 }),
    entry("lini1", "Asuna", { winnings: 4_000, racesWon: 1 }),
    entry("lini1", "Lyn"),
  ];

  it("counts every own game when nobody is hidden, with or without the argument", () => {
    const stats = calculateMarblesStats(games, players);
    assert.deepEqual(stats.games.map((g) => g.gameId), ["raya1", "raya2", "lini1"]);
    assert.equal(stats.totals.games, 3);
    assert.equal(stats.totals.taken, 9_000);
    assert.equal(stats.totals.won, 7_000);
    assert.equal(stats.totals.uniquePlayers, 3);
    assert.deepEqual(calculateMarblesStats(games, players, []), stats);
  });

  it("drops a hidden host's games from the list and every total", () => {
    const { totals, games: counted } = calculateMarblesStats(games, players, [LINI]);
    assert.deepEqual(counted.map((g) => g.gameId), ["raya1", "raya2"]);
    assert.equal(totals.games, 2);
    assert.equal(totals.tournaments, 1);
    assert.equal(totals.races, 4);
    assert.equal(totals.taken, 4_000);
    assert.equal(totals.payouts, 3_000);
    assert.equal(totals.net, 1_000);
  });

  it("takes the hidden host's players down with her games", () => {
    const stats = calculateMarblesStats(games, players, [LINI]);
    assert.deepEqual(stats.players.map((p) => p.playerName).sort(), ["Asuna", "Kirito"]);
    assert.equal(stats.totals.uniquePlayers, 2);
    assert.equal(stats.totals.won, 3_000);

    // Asuna keeps what she did under the visible host and nothing else.
    const asuna = stats.players.find((p) => p.playerName === "Asuna")!;
    assert.equal(asuna.games, 2);
    assert.equal(asuna.won, 3_000);
    assert.equal(asuna.racesWon, 3);
    assert.equal(asuna.tournamentsWon, 1);
  });

  it("is all zeroes once every host is hidden", () => {
    const stats = calculateMarblesStats(games, players, [RAYA, LINI]);
    assert.equal(stats.games.length, 0);
    assert.equal(stats.players.length, 0);
    assert.equal(stats.totals.games, 0);
    assert.equal(stats.totals.won, 0);
  });

  it("changes nothing when the hidden host has no games here", () => {
    assert.deepEqual(calculateMarblesStats(games, players, ["Nobody Here@Omega"]), calculateMarblesStats(games, players));
  });

  it("does not reorder or shrink the rows it was handed", () => {
    const input = [...games].reverse();
    const before = input.map((g) => g.gameId);
    calculateMarblesStats(input, players, [LINI]);
    assert.deepEqual(input.map((g) => g.gameId), before);
  });
});

describe("summarizeMarblesHosts", () => {
  const rows = [
    game("raya1"),
    game("raya2"),
    game("raya-running", { status: "active", totalPlayers: 0 }),
    game("raya-empty", { status: "auto_closed", totalPlayers: 0 }),
    game("lini1", { creatorName: "Lini Espi" }),
    game("alt-running", { creatorName: "Raya' Serahill", creatorWorld: "Lich", status: "active", totalPlayers: 0 }),
    game("other1", { creatorName: "Someone Else", mine: false }),
    game("console", { creatorName: "Console", creatorWorld: undefined, mine: false }),
    game("nameless", { creatorName: undefined, creatorWorld: undefined }),
  ];

  it("lists the dealer's own hosts alphabetically, counting only games the public page counts", () => {
    assert.deepEqual(summarizeMarblesHosts(rows), [
      { name: LINI, games: 1, enabled: true },
      { name: RAYA, games: 2, enabled: true },
      { name: "Raya' Serahill@Lich", games: 0, enabled: true },
    ]);
  });

  it("keeps other dealers and nameless games off the list", () => {
    const names = summarizeMarblesHosts(rows).map((host) => host.name);
    assert.ok(!names.includes("Someone Else@Alpha"));
    assert.ok(!names.includes("Console"));
    assert.ok(!names.includes(""));
  });

  it("unticks exactly the hidden hosts", () => {
    const hosts = summarizeMarblesHosts(rows, [RAYA, "Nobody Here@Omega"]);
    assert.deepEqual(
      hosts.map((host) => [host.name, host.enabled]),
      [
        [LINI, true],
        [RAYA, false],
        ["Raya' Serahill@Lich", true],
      ]
    );
  });

  it("agrees with the stats on how many games each visible host brings", () => {
    const hidden = [LINI];
    const visibleGames = summarizeMarblesHosts(rows, hidden)
      .filter((host) => host.enabled)
      .reduce((sum, host) => sum + host.games, 0);
    // The nameless game cannot be hidden, so the stats count it on top.
    assert.equal(calculateMarblesStats(rows, [], hidden).totals.games, visibleGames + 1);
  });

  it("is empty with no games", () => {
    assert.deepEqual(summarizeMarblesHosts([]), []);
  });
});
