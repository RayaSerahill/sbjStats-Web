import { createHash } from "node:crypto";
import type { Db, AnyBulkWriteOperation } from "mongodb";

/**
 * SimpleWheel preset upload (see the SimpleStats plugin docs).
 *
 * Always one envelope object. Presets are saved per uploader and never
 * deleted: a preset missing from a later upload simply stops being
 * re-uploaded. When a preset with a known name arrives with different
 * segments, a new version is stored and the old one is closed off, so
 * games can be tied to the version that was current when they were played.
 */
export type WheelSegmentType = "string" | "image" | "imageurl";
export type WheelSegmentEffect = "fireworks" | "bigwin" | "coins";

export type WheelSegmentPayload = {
  type?: string;
  value?: string;
  value_type_gil?: boolean;
  gil_value?: number;
  preset_url?: string;
  url?: string;
  win?: boolean;
  bankrupt?: boolean;
  probability?: number;
  color?: string;
  pattern_url?: string;
  free_spins?: number;
  reverse_spin?: boolean;
  effects?: unknown[];
};

export type WheelPresetPayload = {
  name: string;
  segments?: unknown[];
};

export type WheelPresetUploadPayload = {
  dealer?: string;
  uploaded_at?: number | string | null;
  presets: WheelPresetPayload[];
};

export type NormalizedWheelSegment = {
  type: WheelSegmentType;
  /** What the wheel shows / what prizes_won records: value, preset_url or url depending on type. */
  label: string;
  value: string;
  valueTypeGil: boolean;
  gilValue: number;
  presetUrl: string;
  url: string;
  win: boolean;
  bankrupt: boolean;
  probability: number;
  color: string;
  patternUrl: string;
  freeSpins: number;
  reverseSpin: boolean;
  effects: WheelSegmentEffect[];
};

export type NormalizedWheelPreset = {
  name: string;
  segments: NormalizedWheelSegment[];
  contentHash: string;
};

export type NormalizedWheelPresetUpload = {
  dealer?: string;
  uploadedAt: number;
  presets: NormalizedWheelPreset[];
};

export type WheelPresetDoc = {
  _id?: unknown;
  uploaderId: string;
  name: string;
  version: number;
  contentHash: string;
  segments: NormalizedWheelSegment[];
  /** Unix seconds. Games archived at or after this belong to this version. */
  activeFrom: number;
  /** Unix seconds. Set when a newer version arrives. */
  activeUntil?: number;
  /** Who uploaded it, informational only. */
  dealer?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

const SEGMENT_TYPES = new Set<WheelSegmentType>(["string", "image", "imageurl"]);
const SEGMENT_EFFECTS = new Set<WheelSegmentEffect>(["fireworks", "bigwin", "coins"]);

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

function normalizeUploadedAt(value: unknown, now: () => number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1_000_000_000_000 ? Math.trunc(value / 1000) : Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
      return numeric >= 1_000_000_000_000 ? Math.trunc(numeric / 1000) : Math.trunc(numeric);
    }
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) return Math.trunc(parsed.getTime() / 1000);
  }
  return Math.trunc(now() / 1000);
}

export function isWheelPresetUploadPayload(value: unknown): value is WheelPresetUploadPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.presets)) return false;
  if (v.dealer !== undefined && v.dealer !== null && typeof v.dealer !== "string") return false;
  return true;
}

export function isWheelPresetPayload(value: unknown): value is WheelPresetPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return str(v.name).length > 0 && (v.segments === undefined || v.segments === null || Array.isArray(v.segments));
}

const GIL_VALUE_TEXT_RE = /^\s*(\d+(?:[.,]\d+)?)\s*([km])?/i;

/**
 * SimpleWheel often leaves gil_value at 0 on gil segments and encodes the
 * amount in `value` as millions instead ("0.5" is 500,000 gil). A k/m
 * suffix is honoured if present; bare numbers are millions.
 */
export function gilValueFromSegmentText(value: string): number {
  const match = value.match(GIL_VALUE_TEXT_RE);
  if (!match) return 0;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount)) return 0;
  const multiplier = match[2]?.toLowerCase() === "k" ? 1_000 : 1_000_000;
  const gil = Math.round(amount * multiplier);
  return Number.isSafeInteger(gil) && gil > 0 ? gil : 0;
}

export function normalizeWheelSegment(raw: unknown): NormalizedWheelSegment {
  const s = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as WheelSegmentPayload;

  const rawType = str(s.type).toLowerCase();
  const type: WheelSegmentType = SEGMENT_TYPES.has(rawType as WheelSegmentType) ? (rawType as WheelSegmentType) : "string";
  const value = str(s.value);
  const presetUrl = str(s.preset_url);
  const url = str(s.url);
  const label = type === "image" ? presetUrl : type === "imageurl" ? url : value;
  const valueTypeGil = bool(s.value_type_gil);
  const explicitGil = Math.max(0, Math.trunc(num(s.gil_value)));
  const gilValue = valueTypeGil && explicitGil === 0 ? gilValueFromSegmentText(value) : explicitGil;

  const effects = Array.isArray(s.effects)
    ? Array.from(
        new Set(
          s.effects
            .map((e) => str(e).toLowerCase())
            .filter((e): e is WheelSegmentEffect => SEGMENT_EFFECTS.has(e as WheelSegmentEffect))
        )
      )
    : [];

  return {
    type,
    label,
    value,
    valueTypeGil,
    gilValue,
    presetUrl,
    url,
    win: bool(s.win),
    bankrupt: bool(s.bankrupt),
    probability: Math.max(0, num(s.probability)),
    color: str(s.color),
    patternUrl: str(s.pattern_url),
    freeSpins: Math.max(0, Math.trunc(num(s.free_spins))),
    reverseSpin: bool(s.reverse_spin),
    effects,
  };
}

/** Stable fingerprint of a segment list; key order and whitespace do not matter. */
export function hashWheelSegments(segments: NormalizedWheelSegment[]): string {
  const canonical = segments.map((seg) =>
    Object.keys(seg)
      .sort()
      .map((key) => [key, (seg as Record<string, unknown>)[key]])
  );
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function normalizeWheelPreset(raw: WheelPresetPayload): NormalizedWheelPreset {
  const segments = (Array.isArray(raw.segments) ? raw.segments : []).map(normalizeWheelSegment);
  return {
    name: str(raw.name),
    segments,
    contentHash: hashWheelSegments(segments),
  };
}

/**
 * Parses the envelope. Presets without a usable name are skipped and
 * counted; duplicate names inside one upload keep the last occurrence.
 */
export function parseWheelPresetUpload(
  body: unknown,
  opts?: { now?: () => number }
): { ok: true; upload: NormalizedWheelPresetUpload; skipped: number } | { ok: false; error: string } {
  if (!isWheelPresetUploadPayload(body)) {
    return { ok: false, error: "Expected an object with a presets array" };
  }

  const byName = new Map<string, NormalizedWheelPreset>();
  let skipped = 0;

  for (const raw of body.presets) {
    if (!isWheelPresetPayload(raw)) {
      skipped += 1;
      continue;
    }
    const preset = normalizeWheelPreset(raw);
    byName.set(preset.name, preset);
  }

  const dealer = str(body.dealer) || undefined;

  return {
    ok: true,
    skipped,
    upload: {
      dealer,
      uploadedAt: normalizeUploadedAt(body.uploaded_at, opts?.now ?? (() => Date.now())),
      presets: Array.from(byName.values()),
    },
  };
}

/**
 * Picks the version that was current at `archivedAt`: the newest version
 * whose activeFrom is not after the game. A game older than every known
 * version gets the oldest one, since that is the best guess we have.
 */
export function resolveWheelPresetVersion<T extends { activeFrom: number; version: number }>(
  versions: T[],
  archivedAt: number
): T | undefined {
  if (versions.length === 0) return undefined;
  const sorted = [...versions].sort((a, b) => a.activeFrom - b.activeFrom || a.version - b.version);
  let match: T | undefined;
  for (const v of sorted) {
    if (v.activeFrom <= archivedAt) match = v;
    else break;
  }
  return match ?? sorted[0];
}

/** Gil value of a prize label according to one preset version, or null if it is not a flat gil segment. */
export function wheelPrizeValueFromSegments(segments: NormalizedWheelSegment[], label: string): number | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;
  const seg = segments.find((s) => s.label.trim().toLowerCase() === wanted);
  if (!seg || !seg.valueTypeGil) return null;
  return seg.gilValue;
}

export type WheelPresetVersionRef = { presetId: unknown; presetVersion: number };

/** Loads every stored version of the named presets for one uploader, grouped by name. */
export async function loadWheelPresetVersions(opts: {
  db: Db;
  uploaderId: string;
  names: string[];
}): Promise<Map<string, WheelPresetDoc[]>> {
  const byName = new Map<string, WheelPresetDoc[]>();
  const names = Array.from(new Set(opts.names.filter((n) => n.trim())));
  if (names.length === 0) return byName;

  const presets = opts.db.collection<WheelPresetDoc>("wheel_presets");
  const docs = await presets.find({ uploaderId: opts.uploaderId, name: { $in: names } }).toArray();

  for (const doc of docs) {
    const list = byName.get(doc.name) ?? [];
    list.push(doc);
    byName.set(doc.name, list);
  }
  return byName;
}

export function pickWheelPresetRef(
  versionsByName: Map<string, WheelPresetDoc[]>,
  presetName: string | undefined,
  archivedAt: number
): WheelPresetVersionRef | undefined {
  if (!presetName) return undefined;
  const version = resolveWheelPresetVersion(versionsByName.get(presetName) ?? [], archivedAt);
  return version ? { presetId: version._id, presetVersion: version.version } : undefined;
}

type WheelGameLinkDoc = {
  _id?: unknown;
  uploaderId: string;
  preset?: string;
  archivedAt: number;
  presetId?: unknown;
  presetVersion?: number;
};

/**
 * Re-points every game of the given presets at the version that was
 * current when it was played. Used after a preset first appears or changes.
 */
export async function linkWheelGamesToPresets(opts: { db: Db; uploaderId: string; names: string[] }) {
  const names = Array.from(new Set(opts.names.filter((n) => n.trim())));
  if (names.length === 0) return { ok: true as const, linked: 0 };

  const versionsByName = await loadWheelPresetVersions({ db: opts.db, uploaderId: opts.uploaderId, names });
  const games = opts.db.collection<WheelGameLinkDoc>("wheel_games");
  const rows = await games.find({ uploaderId: opts.uploaderId, preset: { $in: names } }).toArray();

  const ops: AnyBulkWriteOperation<WheelGameLinkDoc>[] = [];
  for (const row of rows) {
    const ref = pickWheelPresetRef(versionsByName, row.preset, row.archivedAt);
    if (!ref) continue;
    if (row.presetVersion === ref.presetVersion && String(row.presetId) === String(ref.presetId)) continue;
    ops.push({
      updateOne: {
        filter: { _id: row._id as any, uploaderId: opts.uploaderId },
        update: { $set: { presetId: ref.presetId, presetVersion: ref.presetVersion } },
      },
    });
  }

  if (ops.length === 0) return { ok: true as const, linked: 0 };
  await games.bulkWrite(ops, { ordered: false });
  return { ok: true as const, linked: ops.length };
}

/**
 * Stores the upload. For each preset: unchanged content just bumps
 * lastSeenAt; changed content closes the current version at uploadedAt and
 * opens the next one. Nothing is ever deleted.
 */
export async function ingestWheelPresets(opts: {
  db: Db;
  uploaderId: string;
  upload: NormalizedWheelPresetUpload;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const presets = opts.db.collection<WheelPresetDoc>("wheel_presets");
  const names = opts.upload.presets.map((p) => p.name);
  const existingByName = await loadWheelPresetVersions({ db: opts.db, uploaderId: opts.uploaderId, names });

  let created = 0;
  let versioned = 0;
  let unchanged = 0;
  const changedNames: string[] = [];

  for (const preset of opts.upload.presets) {
    const versions = (existingByName.get(preset.name) ?? []).sort((a, b) => b.version - a.version);
    const latest = versions[0];

    if (latest && latest.contentHash === preset.contentHash) {
      unchanged += 1;
      await presets.updateOne(
        { uploaderId: opts.uploaderId, name: preset.name, version: latest.version },
        { $set: { lastSeenAt: now, ...(opts.upload.dealer ? { dealer: opts.upload.dealer } : {}) } }
      );
      continue;
    }

    // Never let a replayed old snapshot open a version that starts before the current one.
    const activeFrom = latest ? Math.max(opts.upload.uploadedAt, latest.activeFrom + 1) : opts.upload.uploadedAt;

    if (latest) {
      await presets.updateOne(
        { uploaderId: opts.uploaderId, name: preset.name, version: latest.version },
        { $set: { activeUntil: activeFrom } }
      );
      versioned += 1;
    } else {
      created += 1;
    }

    await presets.insertOne({
      uploaderId: opts.uploaderId,
      name: preset.name,
      version: latest ? latest.version + 1 : 1,
      contentHash: preset.contentHash,
      segments: preset.segments,
      activeFrom,
      ...(opts.upload.dealer ? { dealer: opts.upload.dealer } : {}),
      firstSeenAt: now,
      lastSeenAt: now,
    });
    changedNames.push(preset.name);
  }

  const link = await linkWheelGamesToPresets({ db: opts.db, uploaderId: opts.uploaderId, names: changedNames });

  return { ok: true as const, created, versioned, unchanged, linkedGames: link.linked };
}
