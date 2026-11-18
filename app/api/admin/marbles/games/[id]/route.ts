import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";

type MarblesGameDoc = {
  _id?: ObjectId;
  uploaderId: string;
  gameId: string;
};

export async function DELETE(req: Request, ctx: RouteContext<"/api/admin/marbles/games/[id]">) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await ctx.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid game id" }, { status: 400 });
  }

  const db = await getDb();
  const marblesGames = db.collection<MarblesGameDoc>("marbles_games");

  const game = await marblesGames.findOneAndDelete(
    { _id: new ObjectId(id), uploaderId: gate.auth.id },
    { projection: { gameId: 1 } }
  );
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // The game's per-player results go with it.
  await db.collection("marbles_players").deleteMany({ uploaderId: gate.auth.id, gameId: game.gameId });

  return NextResponse.json({ ok: true });
}
