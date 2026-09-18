import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { normalizeWheelDealerName, normalizeVisibleWheelDealers, type WheelSettingsDoc } from "@/lib/wheelSettings";

type WheelGameDoc = {
  uploaderId: string;
  dealer?: string;
};

type DealerAggregateRow = {
  _id: string;
  games: number;
};

function readVisibleDealers(body: unknown): unknown[] | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).visibleDealers;
  return Array.isArray(value) ? value : null;
}

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const wheelGames = db.collection<WheelGameDoc>("wheel_games");
  const wheelSettings = db.collection<WheelSettingsDoc>("wheel_settings");

  const [dealerRows, settings] = await Promise.all([
    wheelGames
      .aggregate<DealerAggregateRow>([
        { $match: { uploaderId: gate.auth.id, dealer: { $type: "string" } } },
        { $project: { dealer: { $trim: { input: "$dealer" } } } },
        { $match: { dealer: { $ne: "" } } },
        { $group: { _id: "$dealer", games: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    wheelSettings.findOne({ uploaderId: gate.auth.id }, { projection: { visibleDealers: 1, updatedAt: 1 } }),
  ]);

  const visibleDealers = normalizeVisibleWheelDealers(settings?.visibleDealers);
  const visibleDealerSet = new Set(visibleDealers);

  return NextResponse.json({
    ok: true,
    visibleDealers,
    updatedAt: settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
    dealers: dealerRows.map((row) => {
      const name = normalizeWheelDealerName(row._id);
      return {
        name,
        games: Number(row.games) || 0,
        enabled: visibleDealerSet.has(name),
      };
    }),
  });
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

  const input = readVisibleDealers(body);
  if (!input) {
    return NextResponse.json({ error: "visibleDealers must be an array" }, { status: 400 });
  }

  const visibleDealers = normalizeVisibleWheelDealers(input);
  const db = await getDb();
  const wheelSettings = db.collection<WheelSettingsDoc>("wheel_settings");
  const now = new Date();

  await wheelSettings.updateOne(
    { uploaderId: gate.auth.id },
    {
      $set: { visibleDealers, updatedAt: now },
      $setOnInsert: { uploaderId: gate.auth.id, createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, visibleDealers, updatedAt: now.toISOString() });
}
