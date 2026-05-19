import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureTeamCollections, getDb, type TeamDoc, type TeamMemberDoc } from "@/lib/db";

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id, userId } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  if (!ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const db = await getDb();
  const teamId = new ObjectId(id);
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");

  const team = await teams.findOne({ _id: teamId, ownerId: gate.auth.id }, { projection: { ownerId: 1 } });
  if (!team?._id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (userId === gate.auth.id || userId === team.ownerId) {
    return NextResponse.json({ error: "Team owners cannot be kicked" }, { status: 409 });
  }

  const result = await teamMembers.deleteOne({ teamId, userId, role: "member" });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
