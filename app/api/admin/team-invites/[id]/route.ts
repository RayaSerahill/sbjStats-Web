import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureTeamCollections, getDb, type TeamDoc, type TeamInviteDoc, type TeamMemberDoc } from "@/lib/db";
import { mongoErrorCode } from "@/lib/teams";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid invite id" }, { status: 400 });
  }

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "accept" ? "accept" : body.action === "decline" ? "decline" : null;
  if (!action) {
    return NextResponse.json({ error: "Action must be accept or decline" }, { status: 400 });
  }

  const db = await getDb();
  const teamInvites = db.collection<TeamInviteDoc>("team_invites");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");
  const teams = db.collection<TeamDoc>("teams");

  const inviteId = new ObjectId(id);
  const invite = await teamInvites.findOne({ _id: inviteId, inviteeId: gate.auth.id, status: "pending" });
  if (!invite?._id) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const now = new Date();

  if (action === "accept") {
    const team = await teams.findOne({ _id: invite.teamId }, { projection: { _id: 1 } });
    if (!team?._id) {
      return NextResponse.json({ error: "Team no longer exists" }, { status: 404 });
    }

    const existingMember = await teamMembers.findOne(
      { teamId: invite.teamId, userId: gate.auth.id },
      { projection: { _id: 1 } }
    );

    if (!existingMember?._id) {
      try {
        await teamMembers.insertOne({
          teamId: invite.teamId,
          userId: gate.auth.id,
          role: "member",
          joinedAt: now,
        });
      } catch (error: unknown) {
        if (mongoErrorCode(error) !== 11000) {
          return NextResponse.json({ error: "Failed to join team" }, { status: 500 });
        }
      }
    }
  }

  await teamInvites.updateOne(
    { _id: inviteId, inviteeId: gate.auth.id, status: "pending" },
    {
      $set: {
        status: action === "accept" ? "accepted" : "declined",
        respondedAt: now,
      },
    }
  );

  return NextResponse.json({ ok: true, status: action === "accept" ? "accepted" : "declined" });
}
