import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  gilValueFromSegmentText,
  hashWheelSegments,
  ingestWheelPresets,
  normalizeWheelSegment,
  parseWheelPresetUpload,
  resolveWheelPresetVersion,
  wheelPrizeValueFromSegments,
} from "@/lib/wheelPresets";
import { ingestWheelGames, parseWheelUploadBody } from "@/lib/wheelIngest";
import { FakeDb } from "@/tests/helpers/fakeDb";

const bankrupt = {
  type: "string",
  value: "Bankrupt",
  value_type_gil: false,
  gil_value: 0,
  preset_url: "",
  url: "",
  win: false,
  bankrupt: true,
  probability: 2,
  color: "#333333",
  pattern_url: "",
  free_spins: 0,
  reverse_spin: false,
  effects: [],
};

const oneMil = {
  ...bankrupt,
  value: "1M gil",
  value_type_gil: true,
  gil_value: 1,
  win: true,
  bankrupt: false,
  probability: 1,
  effects: ["bigwin", "coins"],
};

function envelope(presets: unknown[], uploaded_at: number, dealer = "Raya Serahill") {
  return { dealer, uploaded_at, presets };
}

const T1 = 1_700_000_000;
const T2 = 1_700_100_000;
const T3 = 1_700_200_000;

describe("wheel preset parsing", () => {
  it("accepts the documented envelope", () => {
    const parsed = parseWheelPresetUpload(envelope([{ name: "MyPreset", segments: [bankrupt, oneMil] }], T1));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.upload.dealer, "Raya Serahill");
    assert.equal(parsed.upload.uploadedAt, T1);
    assert.equal(parsed.upload.presets.length, 1);
    assert.equal(parsed.upload.presets[0].name, "MyPreset");
    assert.equal(parsed.upload.presets[0].segments.length, 2);
    assert.equal(parsed.skipped, 0);
  });

  it("rejects bodies that are not an envelope", () => {
    assert.equal(parseWheelPresetUpload([]).ok, false);
    assert.equal(parseWheelPresetUpload({ presets: "nope" }).ok, false);
    assert.equal(parseWheelPresetUpload(null).ok, false);
  });

  it("skips nameless presets and keeps the last of duplicate names", () => {
    const parsed = parseWheelPresetUpload(
      envelope(
        [
          { name: "A", segments: [bankrupt] },
          { name: "", segments: [bankrupt] },
          { segments: [bankrupt] },
          { name: "A", segments: [oneMil] },
        ],
        T1
      )
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.skipped, 2);
    assert.equal(parsed.upload.presets.length, 1);
    assert.equal(parsed.upload.presets[0].segments[0].label, "1M gil");
  });

  it("falls back to now when uploaded_at is missing", () => {
    const parsed = parseWheelPresetUpload({ presets: [] }, { now: () => 5_000_000 });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.upload.uploadedAt, 5_000);
  });
});

describe("wheel segment normalisation", () => {
  it("picks the label from the field the type says to read", () => {
    assert.equal(normalizeWheelSegment({ ...bankrupt, type: "string", value: "Hi" }).label, "Hi");
    assert.equal(normalizeWheelSegment({ ...bankrupt, type: "image", preset_url: "p.png" }).label, "p.png");
    assert.equal(normalizeWheelSegment({ ...bankrupt, type: "imageurl", url: "https://x/y.png" }).label, "https://x/y.png");
    assert.equal(normalizeWheelSegment({ ...bankrupt, type: "hologram", value: "?" }).type, "string");
  });

  it("keeps only known effects, deduplicated", () => {
    const seg = normalizeWheelSegment({ ...oneMil, effects: ["coins", "COINS", "lasers", "fireworks"] });
    assert.deepEqual(seg.effects, ["coins", "fireworks"]);
  });

  it("reads value as millions of gil when gil_value is left at 0", () => {
    const seg = normalizeWheelSegment({ ...oneMil, value: "0.5", gil_value: 0 });
    assert.equal(seg.gilValue, 500_000);
    assert.equal(seg.label, "0.5");
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "2", gil_value: 0 }).gilValue, 2_000_000);
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "250k gil", gil_value: 0 }).gilValue, 250_000);
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "1,5", gil_value: 0 }).gilValue, 1_500_000);
  });

  it("treats gil_value as millions and prefers it over the value text", () => {
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "0.5", gil_value: 0.75 }).gilValue, 750_000);
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "x", gil_value: 1 }).gilValue, 1_000_000);
    assert.equal(normalizeWheelSegment({ ...oneMil, value: "x", gil_value: 2.5 }).gilValue, 2_500_000);
    assert.equal(normalizeWheelSegment({ ...bankrupt, gil_value: 3 }).gilValue, 3_000_000);
    assert.equal(normalizeWheelSegment({ ...bankrupt, value: "0.5", value_type_gil: false }).gilValue, 0);
    assert.equal(gilValueFromSegmentText("Bankrupt"), 0);
    assert.equal(gilValueFromSegmentText("x5"), 0);
  });

  it("fills defaults for a bare segment", () => {
    const seg = normalizeWheelSegment({});
    assert.equal(seg.type, "string");
    assert.equal(seg.label, "");
    assert.equal(seg.gilValue, 0);
    assert.equal(seg.probability, 0);
    assert.deepEqual(seg.effects, []);
  });

  it("hashes independent of key order and whitespace", () => {
    const a = [normalizeWheelSegment(oneMil)];
    const reordered = Object.fromEntries(Object.entries(oneMil).reverse());
    const b = [normalizeWheelSegment({ ...reordered, value: "  1M gil " })];
    assert.equal(hashWheelSegments(a), hashWheelSegments(b));
    assert.notEqual(hashWheelSegments(a), hashWheelSegments([normalizeWheelSegment({ ...oneMil, gil_value: 2 })]));
  });

  it("values a prize label from the segments, but only for flat gil segments", () => {
    const segs = [normalizeWheelSegment(bankrupt), normalizeWheelSegment(oneMil)];
    assert.equal(wheelPrizeValueFromSegments(segs, "1m GIL"), 1_000_000);
    assert.equal(wheelPrizeValueFromSegments(segs, "Bankrupt"), null);
    assert.equal(wheelPrizeValueFromSegments(segs, "x5"), null);
  });
});

describe("resolveWheelPresetVersion", () => {
  const versions = [
    { version: 1, activeFrom: T1 },
    { version: 2, activeFrom: T2 },
    { version: 3, activeFrom: T3 },
  ];

  it("picks the newest version that had started by the time of the game", () => {
    assert.equal(resolveWheelPresetVersion(versions, T2 - 1)?.version, 1);
    assert.equal(resolveWheelPresetVersion(versions, T2)?.version, 2);
    assert.equal(resolveWheelPresetVersion(versions, T3 + 999)?.version, 3);
  });

  it("leaves games older than every version presetless", () => {
    assert.equal(resolveWheelPresetVersion(versions, T1 - 1), undefined);
    assert.equal(resolveWheelPresetVersion([], T1), undefined);
  });
});

describe("ingestWheelPresets (local, fake db)", () => {
  async function upload(db: FakeDb, presets: unknown[], at: number) {
    const parsed = parseWheelPresetUpload(envelope(presets, at));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) throw new Error("unreachable");
    return ingestWheelPresets({ db: db as any, uploaderId: "u", upload: parsed.upload });
  }

  it("creates version 1, then leaves an identical re-upload alone", async () => {
    const db = new FakeDb();
    const first = await upload(db, [{ name: "MyPreset", segments: [bankrupt, oneMil] }], T1);
    assert.deepEqual([first.created, first.versioned, first.unchanged], [1, 0, 0]);

    const second = await upload(db, [{ name: "MyPreset", segments: [oneMil, bankrupt].reverse() }], T2);
    assert.deepEqual([second.created, second.versioned, second.unchanged], [0, 0, 1]);

    const docs = db.col("wheel_presets").docs;
    assert.equal(docs.length, 1);
    assert.equal(docs[0].version, 1);
    assert.equal(docs[0].activeFrom, T1);
    assert.equal(docs[0].activeUntil, undefined);
  });

  it("opens a new version when the segments change and closes the old one", async () => {
    const db = new FakeDb();
    await upload(db, [{ name: "MyPreset", segments: [bankrupt, oneMil] }], T1);
    const result = await upload(db, [{ name: "MyPreset", segments: [bankrupt, { ...oneMil, gil_value: 2 }] }], T2);
    assert.deepEqual([result.created, result.versioned, result.unchanged], [0, 1, 0]);

    const docs = db.col("wheel_presets").docs.sort((a, b) => a.version - b.version);
    assert.equal(docs.length, 2);
    assert.equal(docs[0].activeUntil, T2);
    assert.equal(docs[1].version, 2);
    assert.equal(docs[1].activeFrom, T2);
    assert.equal(docs[1].segments[1].gilValue, 2_000_000);
  });

  it("never deletes a preset that stops being uploaded", async () => {
    const db = new FakeDb();
    await upload(db, [{ name: "Keep", segments: [bankrupt] }, { name: "Gone", segments: [oneMil] }], T1);
    await upload(db, [{ name: "Keep", segments: [bankrupt] }], T2);
    const names = db.col("wheel_presets").docs.map((d) => d.name).sort();
    assert.deepEqual(names, ["Gone", "Keep"]);
  });

  it("does not let a replayed old snapshot start a version before the current one", async () => {
    const db = new FakeDb();
    await upload(db, [{ name: "P", segments: [bankrupt] }], T2);
    await upload(db, [{ name: "P", segments: [oneMil] }], T1);
    const docs = db.col("wheel_presets").docs.sort((a, b) => a.version - b.version);
    assert.equal(docs[1].activeFrom, T2 + 1);
    assert.equal(docs[0].activeUntil, T2 + 1);
  });
});

describe("games and preset versions (local, fake db)", () => {
  const gameAt = (uuid: number, archived_at: number) => ({
    game_uuid: uuid,
    player_name: "Someone",
    host_name: "Raya",
    theme: "espi",
    preset: "MyPreset",
    max_spins: 3,
    spin_cost: 0,
    prizes_won: ["1M gil"],
    archived_at,
  });

  async function uploadPresets(db: FakeDb, presets: unknown[], at: number) {
    const parsed = parseWheelPresetUpload(envelope(presets, at));
    if (!parsed.ok) throw new Error(parsed.error);
    return ingestWheelPresets({ db: db as any, uploaderId: "u", upload: parsed.upload });
  }

  async function uploadGames(db: FakeDb, games: unknown[]) {
    return ingestWheelGames({ db: db as any, uploaderId: "u", games: parseWheelUploadBody(games).games });
  }

  it("stamps games with the version current at their archivedAt when presets came first", async () => {
    const db = new FakeDb();
    await uploadPresets(db, [{ name: "MyPreset", segments: [oneMil] }], T1);
    await uploadPresets(db, [{ name: "MyPreset", segments: [{ ...oneMil, gil_value: 2 }] }], T2);
    await uploadGames(db, [gameAt(1, T1 + 10), gameAt(2, T2 + 10)]);

    const games = db.col("wheel_games").docs;
    const byUuid = Object.fromEntries(games.map((g) => [g.gameUuid, g]));
    assert.equal(byUuid["1"].presetVersion, 1);
    assert.equal(byUuid["2"].presetVersion, 2);
    const presets = db.col("wheel_presets").docs;
    assert.equal(byUuid["1"].presetId, presets.find((p) => p.version === 1)?._id);
  });

  it("back-links games that arrived before their preset, and re-links on a new version", async () => {
    const db = new FakeDb();
    await uploadGames(db, [gameAt(1, T1 + 10), gameAt(2, T2 + 10)]);
    assert.equal(db.col("wheel_games").docs.every((g) => g.presetVersion === undefined), true);

    const first = await uploadPresets(db, [{ name: "MyPreset", segments: [oneMil] }], T1);
    assert.equal(first.linkedGames, 2);
    assert.equal(db.col("wheel_games").docs.every((g) => g.presetVersion === 1), true);

    const second = await uploadPresets(db, [{ name: "MyPreset", segments: [{ ...oneMil, gil_value: 2 }] }], T2);
    assert.equal(second.linkedGames, 1);
    const byUuid = Object.fromEntries(db.col("wheel_games").docs.map((g) => [g.gameUuid, g]));
    assert.equal(byUuid["1"].presetVersion, 1);
    assert.equal(byUuid["2"].presetVersion, 2);

    const third = await uploadPresets(db, [{ name: "MyPreset", segments: [{ ...oneMil, gil_value: 2 }] }], T3);
    assert.equal(third.linkedGames, 0);
  });

  it("does not guess a preset for games played before the first known version", async () => {
    const db = new FakeDb();
    await uploadGames(db, [gameAt(1, T1 - 10), gameAt(2, T1 + 10)]);
    const result = await uploadPresets(db, [{ name: "MyPreset", segments: [oneMil] }], T1);
    assert.equal(result.linkedGames, 1);

    const byUuid = Object.fromEntries(db.col("wheel_games").docs.map((g) => [g.gameUuid, g]));
    assert.equal(byUuid["1"].presetVersion, undefined);
    assert.equal(byUuid["1"].presetId, undefined);
    assert.equal(byUuid["2"].presetVersion, 1);

    // Games arriving later that predate every version stay presetless too.
    await uploadGames(db, [gameAt(3, T1 - 5)]);
    assert.equal(db.col("wheel_games").docs.find((g) => g.gameUuid === "3")?.presetVersion, undefined);
  });

  it("clears a link that no longer resolves", async () => {
    const db = new FakeDb();
    await uploadGames(db, [gameAt(1, T1 - 10)]);
    const game = db.col("wheel_games").docs[0];
    game.presetId = "stale";
    game.presetVersion = 99;

    const result = await uploadPresets(db, [{ name: "MyPreset", segments: [oneMil] }], T1);
    assert.equal(result.linkedGames, 1);
    assert.equal("presetId" in db.col("wheel_games").docs[0], false);
    assert.equal("presetVersion" in db.col("wheel_games").docs[0], false);
  });

  it("leaves games of other uploaders alone", async () => {
    const db = new FakeDb();
    await ingestWheelGames({ db: db as any, uploaderId: "someone-else", games: parseWheelUploadBody([gameAt(1, T1)]).games });
    await uploadPresets(db, [{ name: "MyPreset", segments: [oneMil] }], T1);
    assert.equal(db.col("wheel_games").docs[0].presetVersion, undefined);
  });
});
