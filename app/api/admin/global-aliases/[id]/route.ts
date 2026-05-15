import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireSessionRoles } from "@/lib/auth";
import { GLOBAL_ALIASES_CREATED_BY } from "@/lib/aliases";
import { ensureGameCollections, getDb } from "@/lib/db";

function errorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureGameCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

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
    const result = await aliases.updateOne(
      { _id: new ObjectId(id), createdBy: GLOBAL_ALIASES_CREATED_BY },
      { $set: { primaryTag, aliasTag, updatedAt: new Date(), updatedByAdmin: gate.auth.id } }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id, primaryTag, aliasTag });
  } catch (error: unknown) {
    if (errorCode(error) === 11000) {
      return NextResponse.json({ error: "That alias is already connected globally" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update global alias" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await ensureGameCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const aliases = db.collection("aliases");

  const result = await aliases.deleteOne({ _id: new ObjectId(id), createdBy: GLOBAL_ALIASES_CREATED_BY });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
