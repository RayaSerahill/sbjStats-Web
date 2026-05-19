import { NextResponse, type NextRequest } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdminRequest } from "@/lib/auth";
import { ensureTeamCollections, getDb, type TeamDoc, type TeamMemberDoc } from "@/lib/db";
import {
  normalizeEnabledGames,
  normalizeTeamAccentColor,
  normalizeTeamDescription,
  normalizeTeamTheme,
  serializeTeam,
  teamAccentColorValidationMessage,
  teamDescriptionValidationMessage,
} from "@/lib/teams";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  let body: { enabledGames?: unknown; description?: unknown; theme?: unknown; accentColor?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const set: Partial<TeamDoc> & Record<string, unknown> = {};
  if ("enabledGames" in body) {
    set.enabledGames = normalizeEnabledGames(body.enabledGames);
  }
  if ("description" in body) {
    const descriptionError = teamDescriptionValidationMessage(body.description);
    if (descriptionError) {
      return NextResponse.json({ error: descriptionError }, { status: 400 });
    }
    set.description = normalizeTeamDescription(body.description);
  }
  if ("theme" in body) {
    set.theme = normalizeTeamTheme(body.theme);
  }
  if ("accentColor" in body) {
    const accentColorError = teamAccentColorValidationMessage(body.accentColor);
    if (accentColorError) {
      return NextResponse.json({ error: accentColorError }, { status: 400 });
    }
    set.accentColor = normalizeTeamAccentColor(body.accentColor);
  }
  if (!Object.keys(set).length) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const now = new Date();
  set.updatedAt = now;

  const result = await teams.findOneAndUpdate(
    { _id: new ObjectId(id), ownerId: gate.auth.id },
    { $set: set },
    { returnDocument: "after" }
  );

  if (!result) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, team: serializeTeam(result) });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid team id" }, { status: 400 });
  }

  const db = await getDb();
  const teamId = new ObjectId(id);
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");

  const team = await teams.findOne({ _id: teamId }, { projection: { ownerId: 1 } });
  if (!team?._id) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  if (team.ownerId === gate.auth.id) {
    return NextResponse.json({ error: "Team owners cannot leave their own team" }, { status: 409 });
  }

  const result = await teamMembers.deleteOne({ teamId, userId: gate.auth.id, role: "member" });
  if (!result.deletedCount) {
    return NextResponse.json({ error: "You are not a member of this team" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
