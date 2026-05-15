import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureAuthCollections, ensureGameCollections, getDb, type UserDoc } from "@/lib/db";
import { usesGlobalAliases } from "@/lib/aliases";

type AliasDoc = {
  _id?: ObjectId;
  primaryTag: string;
  aliasTag: string;
  createdAt: Date;
  createdBy: string;
};

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const aliases = db.collection<AliasDoc>("aliases");
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne(
    { _id: new ObjectId(gate.auth.id) },
    { projection: { useGlobalAliases: 1 } }
  );

  const rows = await aliases
    .find({ createdBy: gate.auth.id }, { projection: { primaryTag: 1, aliasTag: 1, createdAt: 1, createdBy: 1 } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();

  return NextResponse.json({
    ok: true,
    useGlobalAliases: usesGlobalAliases(user),
    aliases: rows.map((a) => ({
      id: a._id ? a._id.toHexString() : "",
      primaryTag: a.primaryTag,
      aliasTag: a.aliasTag,
      createdAt: a.createdAt,
      createdBy: a.createdBy,
    })),
  });
}

export async function PATCH(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: { useGlobalAliases?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.useGlobalAliases !== "boolean") {
    return NextResponse.json({ error: "useGlobalAliases must be a boolean" }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const result = await users.updateOne(
    { _id: new ObjectId(gate.auth.id), deleted: { $ne: true } },
    {
      $set: {
        useGlobalAliases: body.useGlobalAliases,
        updatedAt: new Date(),
      },
    }
  );

  if (!result.matchedCount) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, useGlobalAliases: body.useGlobalAliases });
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
  } catch (error: unknown) {
    if (errorCode(error) === 11000) {
      return NextResponse.json({ error: "That alias is already connected in your account" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create alias" }, { status: 500 });
  }
}
