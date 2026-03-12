import { NextResponse } from "next/server";
import type { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type AliasDoc = {
  _id?: ObjectId;
  primaryTag: string;
  aliasTag: string;
  createdAt: Date;
  createdBy: string;
};

export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const aliases = db.collection<AliasDoc>("aliases");

  const rows = await aliases
    .find({}, { projection: { primaryTag: 1, aliasTag: 1, createdAt: 1, createdBy: 1 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    ok: true,
    aliases: rows.map((a) => ({
      id: a._id ? a._id.toHexString() : "",
      primaryTag: a.primaryTag,
      aliasTag: a.aliasTag,
      createdAt: a.createdAt,
      createdBy: a.createdBy,
    })),
  });
}

export async function POST(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: { primaryTag?: string; aliasTag?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const primaryTag = (body.primaryTag ?? "").trim();
  const aliasTag = (body.aliasTag ?? "").trim();

  if (!primaryTag || !aliasTag) {
    return NextResponse.json({ error: "primaryTag and aliasTag are required" }, { status: 400 });
  }
  if (primaryTag === aliasTag) {
    return NextResponse.json({ error: "primaryTag and aliasTag must be different" }, { status: 400 });
  }

  const db = await getDb();
  const aliases = db.collection("aliases");

  try {
    const createdAt = new Date();
    const createdBy = gate.auth.id;
    const result = await aliases.insertOne({ primaryTag, aliasTag, createdAt, createdBy });
    return NextResponse.json({ ok: true, id: result.insertedId.toString(), primaryTag, aliasTag, createdAt, createdBy });
  } catch (e: any) {
    const code = e?.code;
    if (code === 11000) {
      return NextResponse.json({ error: "That alias is already connected" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create alias" }, { status: 500 });
  }
}
