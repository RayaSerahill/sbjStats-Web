import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type ScratchPrizeDoc = {
  uploaderId: string;
  prize: string;
  value?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
};

type ScratchGameDoc = {
  uploaderId: string;
  prizesWon?: string[];
};

function normalizePrizeString(value: unknown) {
  const s = String(value ?? "").trim();
  return s;
}

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const scratchGames = db.collection<ScratchGameDoc>("scratch_games");
  const scratchPrizes = db.collection<ScratchPrizeDoc>("scratch_prizes");

  const [uniqueFromGames, saved] = await Promise.all([
    scratchGames
      .aggregate<{ _id: string; count: number }>([
        { $match: { uploaderId: gate.auth.id } },
        { $unwind: "$prizesWon" },
        {
          $group: {
            _id: "$prizesWon",
            count: { $sum: 1 },
          },
        },
      ])
      .toArray(),
    scratchPrizes
      .find({ uploaderId: gate.auth.id }, { projection: { prize: 1, value: 1, updatedAt: 1 } })
      .toArray(),
  ]);

  const counts = new Map<string, number>();
  for (const row of uniqueFromGames) {
    const prize = normalizePrizeString(row?._id);
    if (!prize) continue;
    counts.set(prize, Number(row.count) || 0);
  }

  const values = new Map<string, { value: number | null; updatedAt: string | null }>();
  for (const row of saved) {
    const prize = normalizePrizeString(row?.prize);
    if (!prize) continue;
    const val = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : null;
    const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt ? new Date(row.updatedAt).toISOString() : null;
    values.set(prize, { value: val, updatedAt });
  }

  const allPrizes = new Set<string>([...counts.keys(), ...values.keys()]);

  const prizes = Array.from(allPrizes)
    .sort((a, b) => a.localeCompare(b))
    .map((prize) => {
      const info = values.get(prize);
      return {
        prize,
        count: counts.get(prize) ?? 0,
        value: info ? info.value : null,
        updatedAt: info ? info.updatedAt : null,
      };
    });

  return NextResponse.json({ ok: true, prizes });
}

function parseUpdates(body: any): Array<{ prize: string; value: number | null }> {
  const updates = Array.isArray(body?.updates) ? body.updates : body ? [body] : [];

  return updates
    .map((row: any) => {
      const prize = normalizePrizeString(row?.prize);
      if (!prize) return null;

      const rawVal = row?.value;
      if (rawVal === null || rawVal === undefined || rawVal === "") {
        return { prize, value: null };
      }

      const num = Number(rawVal);
      if (!Number.isFinite(num)) return null;
      return { prize, value: num };
    })
    .filter(Boolean) as Array<{ prize: string; value: number | null }>;
}

export async function PUT(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: any;
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
  const scratchPrizes = db.collection<ScratchPrizeDoc>("scratch_prizes");
  const now = new Date();

  const ops = updates.map((u) => ({
    updateOne: {
      filter: { uploaderId: gate.auth.id, prize: u.prize },
      update: {
        $set: {
          value: u.value,
          updatedAt: now,
        },
        $setOnInsert: {
          uploaderId: gate.auth.id,
          prize: u.prize,
          createdAt: now,
        },
      },
      upsert: true,
    },
  }));

  const result = await scratchPrizes.bulkWrite(ops, { ordered: false });

  return NextResponse.json({
    ok: true,
    updated: result.modifiedCount,
    inserted: result.upsertedCount,
  });
}
