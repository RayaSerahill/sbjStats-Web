import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireSessionRoles } from "@/lib/auth";
import { ensureAuthCollections, getDb } from "@/lib/db";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureAuthCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const whitelist = db.collection("whitelist");

  const result = await whitelist.deleteOne({ _id: new ObjectId(id) });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
