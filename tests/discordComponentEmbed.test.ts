import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DISCORD_COMPONENT_EMBED_ACCENT_COLOR,
  DISCORD_COMPONENT_EMBED_DESCRIPTION,
  DISCORD_COMPONENT_EMBED_IMAGE_URL,
  buildHostStatsComponentEmbed,
  hostStatsComponentEmbedButtons,
  serializeDiscordComponentEmbed,
} from "@/lib/discordComponentEmbed";

const base = {
  displayName: "Raya Serahill",
  username: "raya",
  origin: "https://stats.serahill.net",
};

describe("discord component embed", () => {
  it("uses the requested accent color, title, description and image", () => {
    const payload = buildHostStatsComponentEmbed({
      ...base,
      rootGame: "blackjack",
      games: [{ game: "blackjack", enabled: true }, { game: "scratch", enabled: true }],
    });

    assert.equal(payload.component.type, 17);
    assert.equal(payload.component.accent_color, 0xff9fc6);
    assert.equal(DISCORD_COMPONENT_EMBED_ACCENT_COLOR, 16752582);

    const section = payload.component.components[0] as {
      type: number;
      components: { type: number; content: string }[];
      accessory: { type: number; media: { url: string } };
    };
    assert.equal(section.type, 9);
    assert.equal(section.components[0].type, 10);
    assert.equal(section.components[0].content, `# Raya Serahill hosting stats\n${DISCORD_COMPONENT_EMBED_DESCRIPTION}`);
    assert.equal(section.accessory.type, 11);
    assert.equal(section.accessory.media.url, DISCORD_COMPONENT_EMBED_IMAGE_URL);
    assert.equal(DISCORD_COMPONENT_EMBED_IMAGE_URL, "https://stats.serahill.net/simplestats.png");
  });

  it("adds a Wheel button when the wheel nav link is enabled, at /<name> when it is the root game", () => {
    const wheelExtra = hostStatsComponentEmbedButtons({
      ...base,
      rootGame: "blackjack",
      games: [
        { game: "blackjack", enabled: true },
        { game: "scratch", enabled: true },
        { game: "wheel", enabled: true },
      ],
    });
    assert.deepEqual(
      wheelExtra.map((b) => [b.label, b.url]),
      [
        ["Blackjack", "https://stats.serahill.net/raya"],
        ["Scratch", "https://stats.serahill.net/raya/scratch"],
        ["Wheel", "https://stats.serahill.net/raya/wheel"],
      ]
    );

    const wheelRoot = hostStatsComponentEmbedButtons({
      ...base,
      rootGame: "wheel",
      games: [{ game: "scratch", enabled: false }, { game: "wheel", enabled: true }],
    });
    assert.deepEqual(wheelRoot.map((b) => [b.label, b.url]), [["Wheel", "https://stats.serahill.net/raya"]]);
  });

  it("links the root game at /<name> and the other game at /<name>/<game>", () => {
    const blackjackRoot = hostStatsComponentEmbedButtons({
      ...base,
      rootGame: "blackjack",
      games: [{ game: "blackjack", enabled: true }, { game: "scratch", enabled: true }],
    });
    assert.deepEqual(
      blackjackRoot.map((b) => [b.label, b.url]),
      [
        ["Blackjack", "https://stats.serahill.net/raya"],
        ["Scratch", "https://stats.serahill.net/raya/scratch"],
      ]
    );
    assert.ok(blackjackRoot.every((b) => b.type === 2 && b.style === 5));

    const scratchRoot = hostStatsComponentEmbedButtons({
      ...base,
      rootGame: "scratch",
      games: [{ game: "blackjack", enabled: true }, { game: "scratch", enabled: true }],
    });
    assert.deepEqual(
      scratchRoot.map((b) => [b.label, b.url]),
      [
        ["Blackjack", "https://stats.serahill.net/raya/blackjack"],
        ["Scratch", "https://stats.serahill.net/raya"],
      ]
    );
  });

  it("omits disabled games and drops the action row when nothing is enabled", () => {
    const onlyBlackjack = buildHostStatsComponentEmbed({
      ...base,
      rootGame: "blackjack",
      games: [{ game: "blackjack", enabled: true }, { game: "scratch", enabled: false }],
    });
    const row = onlyBlackjack.component.components[1] as { type: number; components: { label: string }[] };
    assert.equal(row.type, 1);
    assert.deepEqual(row.components.map((b) => b.label), ["Blackjack"]);

    const none = buildHostStatsComponentEmbed({
      ...base,
      rootGame: "blackjack",
      games: [{ game: "blackjack", enabled: false }, { game: "scratch", enabled: false }],
    });
    assert.equal(none.component.components.length, 1);
  });

  it("url-encodes the public name and falls back to the display name", () => {
    const buttons = hostStatsComponentEmbedButtons({
      displayName: "Some Host",
      username: "",
      origin: "https://stats.gamba.pro/",
      rootGame: "blackjack",
      games: [{ game: "scratch", enabled: true }],
    });
    assert.deepEqual(buttons.map((b) => b.url), ["https://stats.gamba.pro/Some%20Host/scratch"]);
  });

  it("serializes JSON that cannot close the script element", () => {
    const payload = buildHostStatsComponentEmbed({
      ...base,
      displayName: "</script><b>&",
      rootGame: "blackjack",
      games: [],
    });
    const json = serializeDiscordComponentEmbed(payload);
    assert.doesNotMatch(json, /[<>&]/);
    assert.deepEqual(JSON.parse(json), payload);
  });
});
