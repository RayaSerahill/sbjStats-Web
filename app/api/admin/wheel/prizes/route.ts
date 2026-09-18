import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { normalizeWheelPrizeName, wheelPrizeAutoValue, type WheelPrizeDoc, type WheelPrizePresetSource } from "@/lib/wheelPrizes";

type WheelGameDoc = {
  uploaderId: string;
  prizesWon?: string[];
};

/**
 * Lists the prize labels that need a hand: anything no uploaded preset
 * values in gil (multipliers, mounts, free spins, labels from presets that
 * were never uploaded). Labels a preset already prices are left out, except
 * when a manual override exists for them, so an override is never invisible.
 */
export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const wheelGames = db.collection<WheelGameDoc>("wheel_games");
  const wheelPrizes = db.collection<WheelPrizeDoc>("wheel_prizes");
  const wheelPresets = db.collection<WheelPrizePresetSource & { uploaderId: string }>("wheel_presets");

  const [countRows, saved, presets] = await Promise.all([
    wheelGames
      .aggregate<{ _id: string; count: number }>([
        { $match: { uploaderId: gate.auth.id } },
        { $unwind: "$prizesWon" },
        { $group: { _id: "$prizesWon", count: { $sum: 1 } } },
      ])
      .toArray(),
    wheelPrizes.find({ uploaderId: gate.auth.id }, { projection: { prize: 1, value: 1, updatedAt: 1 } }).toArray(),
    wheelPresets.find({ uploaderId: gate.auth.id }, { projection: { name: 1, version: 1, lastSeenAt: 1, segments: 1 } }).toArray(),
  ]);

  const counts = new Map<string, number>();
  for (const row of countRows) {
    const prize = normalizeWheelPrizeName(row?._id);
    if (!prize) continue;
    counts.set(prize, Number(row.count) || 0);
  }

  const overrides = new Map<string, { value: number | null; updatedAt: string | null }>();
  for (const row of saved) {
    const prize = normalizeWheelPrizeName(row?.prize);
    if (!prize) continue;
    const value = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null;
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ? new Date(row.updatedAt).toISOString() : null;
    overrides.set(prize, { value, updatedAt });
  }

  // Segment labels count as prizes too, so a wheel that has never landed
  // on its mount still lists it.
  const fromSegments = new Set<string>();
  for (const preset of presets) {
    for (const seg of Array.isArray(preset.segments) ? preset.segments : []) {
      const label = normalizeWheelPrizeName(seg?.label);
      if (label) fromSegments.add(label);
    }
  }

  const allPrizes = new Set<string>([...counts.keys(), ...overrides.keys(), ...fromSegments]);

  const prizes = Array.from(allPrizes)
    .sort((a, b) => a.localeCompare(b))
    .map((prize) => {
      const override = overrides.get(prize);
      const auto = wheelPrizeAutoValue(prize, presets);
      return {
        prize,
        count: counts.get(prize) ?? 0,
        value: override?.value ?? null,
        autoValue: auto?.value ?? null,
        autoSource: auto?.source ?? null,
        autoPreset: auto?.preset ?? null,
        effectiveValue: override?.value ?? auto?.value ?? 0,
        updatedAt: override?.updatedAt ?? null,
      };
    })
    .filter((row) => row.autoSource !== "preset" || row.value !== null);

  return NextResponse.json({ ok: true, prizes });
}

function parseUpdates(body: unknown): Array<{ prize: string; value: number | null }> {
  const input = body && typeof body === "object" ? (body as { updates?: unknown }) : null;
  const updates = Array.isArray(input?.updates) ? input.updates : body ? [body] : [];

  return updates
    .map((row) => {
      const update = row && typeof row === "object" ? (row as { prize?: unknown; value?: unknown }) : null;
      const prize = normalizeWheelPrizeName(update?.prize);
      if (!prize) return null;

      const rawVal = update?.value;
      if (rawVal === null || rawVal === undefined || rawVal === "") {
        return { prize, value: null };
      }

      const num = Number(rawVal);
      if (!Number.isFinite(num)) return null;
      return { prize, value: num };
    })
    .filter((row): row is { prize: string; value: number | null } => row !== null);
}

export async function PUT(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates = parseUpdates(body);
  if (!updates.length) {
    return NextResponse.json({ error: "No valid updates" }, { status: 400 });
  }

  const db = await getDb();
  const wheelPrizes = db.collection<WheelPrizeDoc>("wheel_prizes");
  const now = new Date();

  // Clearing an override removes the row entirely; presets take over again.
  const toClear = updates.filter((u) => u.value === null).map((u) => u.prize);
  const toSet = updates.filter((u): u is { prize: string; value: number } => u.value !== null);

  let removed = 0;
  if (toClear.length) {
    const result = await wheelPrizes.deleteMany({ uploaderId: gate.auth.id, prize: { $in: toClear } });
    removed = result.deletedCount ?? 0;
  }

  let updated = 0;
  let inserted = 0;
  if (toSet.length) {
    const result = await wheelPrizes.bulkWrite(
      toSet.map((u) => ({
        updateOne: {
          filter: { uploaderId: gate.auth.id, prize: u.prize },
          update: {
            $set: { value: u.value, updatedAt: now },
            $setOnInsert: { uploaderId: gate.auth.id, prize: u.prize, createdAt: now },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    updated = result.modifiedCount;
    inserted = result.upsertedCount;
  }

  return NextResponse.json({ ok: true, updated, inserted, removed });
}
