import { NextResponse } from "next/server";
import { ensureGameCollections, getDb } from "@/lib/db";
import { requireAdminRequest } from "@/lib/auth";
import { getStatsStyleForUploader, normalizeStatsStyle, type StatsStyleDoc, type StatsStyleInput } from "@/lib/statsStyle";

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const style = await getStatsStyleForUploader(gate.auth.id, db);
  return NextResponse.json({ ok: true, style });
}

export async function PUT(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: StatsStyleInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const style = normalizeStatsStyle(body);
  const now = new Date();
  const db = await getDb();
  const styles = db.collection<StatsStyleDoc>("stats_styles");

  await styles.updateOne(
    { uploaderId: gate.auth.id },
    {
      $set: { ...style, uploaderId: gate.auth.id, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, style });
}

/**
 * Partial update: merges the given fields onto the stored style so a
 * caller (the live editor) can save one group without resending the rest.
 */
export async function PATCH(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: StatsStyleInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Expected an object" }, { status: 400 });
  }

  const db = await getDb();
  const current = await getStatsStyleForUploader(gate.auth.id, db);
  const style = normalizeStatsStyle({ ...current, ...body });
  const now = new Date();
  const styles = db.collection<StatsStyleDoc>("stats_styles");

  await styles.updateOne(
    { uploaderId: gate.auth.id },
    {
      $set: { ...style, uploaderId: gate.auth.id, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, style });
}
