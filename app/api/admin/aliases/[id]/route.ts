import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/admin/aliases/[id]">) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const db = await getDb();
  const aliases = db.collection("aliases");

  const result = await aliases.deleteOne({ _id: new ObjectId(id) });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
