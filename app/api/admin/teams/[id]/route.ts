import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureTeamCollections, getDb, type TeamDoc } from "@/lib/db";
import { normalizeEnabledGames, serializeTeam } from "@/lib/teams";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  let body: { enabledGames?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const enabledGames = normalizeEnabledGames(body.enabledGames);
  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const now = new Date();

  const result = await teams.findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: gate.auth.id },
    {
      $set: {
        enabledGames,
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, team: serializeTeam(result) });
}
