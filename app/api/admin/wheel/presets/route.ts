import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import type { WheelPresetDoc } from "@/lib/wheelPresets";

type GameCountRow = { _id: { preset: string; presetVersion: number | null }; games: number };

function iso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (!value) return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const versionKey = (name: string, version: number) => `${name}::v${version}`;

/** Every stored preset with all of its versions, plus how many games point at each version. */
export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const wheelPresets = db.collection<WheelPresetDoc>("wheel_presets");
  const wheelGames = db.collection("wheel_games");

  const [versions, gameCounts] = await Promise.all([
    wheelPresets.find({ uploaderId: gate.auth.id }).sort({ name: 1, version: -1 }).toArray(),
    wheelGames
      .aggregate<GameCountRow>([
        { $match: { uploaderId: gate.auth.id, preset: { $type: "string" } } },
        { $group: { _id: { preset: "$preset", presetVersion: { $ifNull: ["$presetVersion", null] } }, games: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const countByKey = new Map<string, number>();
  const unlinkedByName = new Map<string, number>();
  for (const row of gameCounts) {
    const name = String(row._id?.preset ?? "");
    if (!name) continue;
    if (row._id.presetVersion === null || row._id.presetVersion === undefined) {
      unlinkedByName.set(name, (unlinkedByName.get(name) ?? 0) + (Number(row.games) || 0));
    } else {
      countByKey.set(versionKey(name, row._id.presetVersion), Number(row.games) || 0);
    }
  }

  const byName = new Map<string, WheelPresetDoc[]>();
  for (const v of versions) {
    const list = byName.get(v.name) ?? [];
    list.push(v);
    byName.set(v.name, list);
  }

  const presets = Array.from(byName.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, list]) => ({
      name,
      unlinkedGames: unlinkedByName.get(name) ?? 0,
      versions: list
        .sort((a, b) => b.version - a.version)
        .map((v) => ({
          id: String(v._id ?? ""),
          version: v.version,
          activeFrom: new Date(v.activeFrom * 1000).toISOString(),
          activeUntil: typeof v.activeUntil === "number" ? new Date(v.activeUntil * 1000).toISOString() : null,
          firstSeenAt: iso(v.firstSeenAt),
          lastSeenAt: iso(v.lastSeenAt),
          dealer: v.dealer ?? null,
          games: countByKey.get(versionKey(name, v.version)) ?? 0,
          segments: Array.isArray(v.segments) ? v.segments : [],
        })),
    }));

  // Presets that games mention but nobody has uploaded yet.
  const knownNames = new Set(byName.keys());
  const missing = Array.from(unlinkedByName.entries())
    .filter(([name]) => !knownNames.has(name))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, games]) => ({ name, games }));

  return NextResponse.json({ ok: true, presets, missing });
}
