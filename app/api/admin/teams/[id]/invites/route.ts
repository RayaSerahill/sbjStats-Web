import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import {
  ensureAuthCollections,
  ensureTeamCollections,
  getDb,
  type TeamDoc,
  type TeamInviteDoc,
  type TeamMemberDoc,
  type UserDoc,
} from "@/lib/db";
import { normalizeUsername, usernameValidationMessage } from "@/lib/account";
import { displayUserName, mongoErrorCode } from "@/lib/teams";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureAuthCollections();
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = normalizeUsername(String(body.username ?? ""));
  const usernameError = usernameValidationMessage(username);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");
  const teamInvites = db.collection<TeamInviteDoc>("team_invites");
  const users = db.collection<UserDoc>("users");

  const teamId = new ObjectId(id);
  const team = await teams.findOne({ _id: teamId, ownerId: gate.auth.id });
  if (!team?._id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const invitee = await users.findOne(
    { username, deleted: { $ne: true } },
    { projection: { _id: 1, email: 1, username: 1, name: 1 } }
  );
  if (!invitee?._id) {
    return NextResponse.json({ error: "No dashboard user found with that username" }, { status: 404 });
  }

  const inviteeId = invitee._id.toHexString();
  const existingMember = await teamMembers.findOne({ teamId, userId: inviteeId }, { projection: { _id: 1 } });
  if (existingMember?._id) {
    return NextResponse.json({ error: "That user is already in this team" }, { status: 409 });
  }

  const now = new Date();
  try {
    const result = await teamInvites.insertOne({
      teamId,
      inviterId: gate.auth.id,
      inviteeId,
      inviteeUsername: username,
      status: "pending",
      createdAt: now,
    });

    return NextResponse.json(
      {
        ok: true,
        invite: {
          id: result.insertedId.toHexString(),
          teamId: id,
          teamName: team.name,
          teamSlug: team.slug,
          inviteeName: displayUserName(invitee),
          inviteeUsername: invitee.username ?? username,
          createdAt: now.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (mongoErrorCode(error) === 11000) {
      return NextResponse.json({ error: "That user already has a pending invite to this team" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 });
  }
}
