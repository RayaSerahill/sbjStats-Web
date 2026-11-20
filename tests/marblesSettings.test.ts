import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  marblesHostName,
  normalizeHiddenMarblesHosts,
  normalizeMarblesHostName,
  withoutHiddenMarblesHosts,
} from "@/lib/marblesSettings";

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
