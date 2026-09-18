import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type WheelGameDoc = {
  _id?: ObjectId;
  uploaderId: string;
};

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/wheel/games/[id]">) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const db = await getDb();
  const wheelGames = db.collection<WheelGameDoc>("wheel_games");

  const result = await wheelGames.deleteOne({ _id: new ObjectId(id), uploaderId: gate.auth.id });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
