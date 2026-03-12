import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type BlacklistDoc = {
  _id?: ObjectId;
  playerTag: string;
  createdAt: Date;
  createdBy: string;
};

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const blacklist = db.collection<BlacklistDoc>("blacklist");

  const rows = await blacklist
    .find({}, { projection: { playerTag: 1, createdAt: 1, createdBy: 1 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    ok: true,
    blacklist: rows.map((b) => ({
      id: b._id ? b._id.toHexString() : "",
      playerTag: b.playerTag,
      createdAt: b.createdAt,
      createdBy: b.createdBy,
    })),
  });
}

export async function POST(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: { playerTag?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const playerTag = (body.playerTag ?? "").trim();
  if (!playerTag) {
    return NextResponse.json({ error: "playerTag is required" }, { status: 400 });
  }

  const db = await getDb();
  const blacklist = db.collection("blacklist");

  try {
    const createdAt = new Date();
    const createdBy = gate.auth.id;
    const result = await blacklist.insertOne({ playerTag, createdAt, createdBy });
    return NextResponse.json({ ok: true, id: result.insertedId.toString(), playerTag, createdAt, createdBy });
  } catch (e: any) {
    const code = e?.code;
    if (code === 11000) {
      return NextResponse.json({ error: "That player is already hidden" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to add to blacklist" }, { status: 500 });
  }
}
