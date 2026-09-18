import { parseFormattedGilPrizeValue } from "@/lib/scratchPrizes";
import { wheelPrizeValueFromSegments, type NormalizedWheelSegment } from "@/lib/wheelPresets";

/**
 * wheel_prizes holds manual overrides only. A prize label's automatic
 * value comes from the preset segments (per version) or, failing that,
 * from labels that spell out their own value like "1M gil".
 */
export type WheelPrizeDoc = {
  uploaderId: string;
  prize: string;
  value?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WheelPrizePresetSource = {
  name?: string;
  version?: number;
  lastSeenAt?: Date | string | null;
  segments?: NormalizedWheelSegment[];
};

export function normalizeWheelPrizeName(value: unknown) {
  return String(value ?? "").trim();
}

function presetRecency(preset: WheelPrizePresetSource): number {
  const seen = preset.lastSeenAt instanceof Date ? preset.lastSeenAt.getTime() : preset.lastSeenAt ? new Date(preset.lastSeenAt).getTime() : 0;
  return Number.isFinite(seen) ? seen : 0;
}

/**
 * Best automatic value for a label across all known presets: the most
 * recently seen, highest version that has a gil segment with that label,
 * else the label text. Null when nothing can value it (multipliers, mounts).
 */
export function wheelPrizeAutoValue(label: string, presets: WheelPrizePresetSource[]): { value: number; source: "preset" | "label"; preset?: string } | null {
  const name = normalizeWheelPrizeName(label);
  if (!name) return null;

  const ordered = presets
    .slice()
    .sort((a, b) => presetRecency(b) - presetRecency(a) || (b.version ?? 0) - (a.version ?? 0));

  for (const preset of ordered) {
    const value = wheelPrizeValueFromSegments(Array.isArray(preset.segments) ? preset.segments : [], name);
    if (value !== null) return { value, source: "preset", preset: preset.name };
  }

  const fromLabel = parseFormattedGilPrizeValue(name);
  return fromLabel === null ? null : { value: fromLabel, source: "label" };
}
