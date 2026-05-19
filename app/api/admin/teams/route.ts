import { NextResponse } from "next/server";
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
import {
  DEFAULT_TEAM_ACCENT_COLOR,
  displayUserName,
  mongoErrorCode,
  normalizeTeamSlug,
  objectIdToString,
  serializeTeam,
  slugFromTeamName,
  teamNameValidationMessage,
  teamSlugValidationMessage,
} from "@/lib/teams";

function validObjectIds(ids: string[]) {
  return Array.from(new Set(ids)).filter(ObjectId.isValid).map((id) => new ObjectId(id));
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");
  const teamInvites = db.collection<TeamInviteDoc>("team_invites");
  const users = db.collection<UserDoc>("users");

  const [ownedTeam, memberships, pendingInvites] = await Promise.all([
    teams.findOne({ ownerId: gate.auth.id }),
    teamMembers.find({ userId: gate.auth.id }).sort({ joinedAt: -1 }).toArray(),
    teamInvites.find({ inviteeId: gate.auth.id, status: "pending" }).sort({ createdAt: -1 }).toArray(),
  ]);

  const teamIds = [
    ...(ownedTeam?._id ? [ownedTeam._id] : []),
    ...memberships.map((member) => member.teamId),
    ...pendingInvites.map((invite) => invite.teamId),
  ];
  const uniqueTeamIds = Array.from(new Map(teamIds.map((id) => [id.toHexString(), id])).values());

  const [teamDocs, memberCounts] = await Promise.all([
    uniqueTeamIds.length
      ? teams.find({ _id: { $in: uniqueTeamIds } }, { projection: { name: 1, slug: 1, description: 1, theme: 1, accentColor: 1, ownerId: 1, enabledGames: 1, createdAt: 1, updatedAt: 1 } }).toArray()
      : Promise.resolve([]),
    uniqueTeamIds.length
      ? teamMembers
          .aggregate<{ _id: ObjectId; count: number }>([
            { $match: { teamId: { $in: uniqueTeamIds } } },
            { $group: { _id: "$teamId", count: { $sum: 1 } } },
          ])
          .toArray()
      : Promise.resolve([]),
  ]);

  const teamById = new Map(teamDocs.map((team) => [objectIdToString(team._id), team]));
  const memberCountByTeamId = new Map(memberCounts.map((row) => [row._id.toHexString(), Number(row.count) || 0]));

  const ownedTeamId = ownedTeam?._id?.toHexString() ?? "";
  const ownedMemberRows = ownedTeam?._id ? await teamMembers.find({ teamId: ownedTeam._id }).sort({ joinedAt: 1 }).toArray() : [];
  const userIds = [
    ...ownedMemberRows.map((member) => member.userId),
    ...pendingInvites.map((invite) => invite.inviterId),
  ];
  const userDocs = userIds.length
    ? await users
        .find(
          { _id: { $in: validObjectIds(userIds) } },
          { projection: { email: 1, username: 1, name: 1 } }
        )
        .toArray()
    : [];
  const userById = new Map(userDocs.map((user) => [user._id?.toHexString() ?? "", user]));

  const ownedTeamDoc = ownedTeamId ? teamById.get(ownedTeamId) : null;

  return NextResponse.json({
    ok: true,
    pendingInviteCount: pendingInvites.length,
    ownedTeam: ownedTeamDoc
      ? {
          ...serializeTeam(ownedTeamDoc, memberCountByTeamId.get(ownedTeamId) ?? 0),
          members: ownedMemberRows.map((member) => {
            const user = userById.get(member.userId);
            return {
              userId: member.userId,
              role: member.role,
              name: displayUserName(user),
              username: user?.username ?? null,
              joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : new Date(member.joinedAt).toISOString(),
            };
          }),
        }
      : null,
    teams: memberships
      .map((member) => {
        const teamId = member.teamId.toHexString();
        const team = teamById.get(teamId);
        if (!team) return null;
        return {
          ...serializeTeam(team, memberCountByTeamId.get(teamId) ?? 0),
          role: member.role,
          joinedAt: member.joinedAt instanceof Date ? member.joinedAt.toISOString() : new Date(member.joinedAt).toISOString(),
        };
      })
      .filter(Boolean),
    invites: pendingInvites.map((invite) => {
      const teamId = invite.teamId.toHexString();
      const team = teamById.get(teamId);
      const inviter = userById.get(invite.inviterId);
      return {
        id: invite._id?.toHexString() ?? "",
        teamId,
        teamName: team?.name ?? "Unknown team",
        teamSlug: team?.slug ?? "",
        teamUrl: team?.slug ? `/t/${team.slug}` : "",
        inviterName: displayUserName(inviter),
        createdAt: invite.createdAt instanceof Date ? invite.createdAt.toISOString() : new Date(invite.createdAt).toISOString(),
      };
    }),
  });
}

export async function POST(req: Request) {
  await ensureAuthCollections();
  await ensureTeamCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: { name?: string; slug?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const nameError = teamNameValidationMessage(name);
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  const slug = normalizeTeamSlug(typeof body.slug === "string" && body.slug.trim() ? body.slug : slugFromTeamName(name));
  const slugError = teamSlugValidationMessage(slug);
  if (slugError) {
    return NextResponse.json({ error: slugError }, { status: 400 });
  }

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");

  const existingOwnedTeam = await teams.findOne({ ownerId: gate.auth.id }, { projection: { _id: 1 } });
  if (existingOwnedTeam?._id) {
    return NextResponse.json({ error: "You can only own one team" }, { status: 409 });
  }

  const now = new Date();
  const team: TeamDoc = {
    name,
    slug,
    description: "",
    theme: "dark",
    accentColor: DEFAULT_TEAM_ACCENT_COLOR,
    ownerId: gate.auth.id,
    enabledGames: ["blackjack"],
    createdAt: now,
    updatedAt: now,
  };

  try {
    const result = await teams.insertOne(team);
    await teamMembers.insertOne({
      teamId: result.insertedId,
      userId: gate.auth.id,
      role: "owner",
      joinedAt: now,
    });

    return NextResponse.json(
      {
        ok: true,
        ownedTeam: {
          ...serializeTeam({ ...team, _id: result.insertedId }, 1),
          members: [
            {
              userId: gate.auth.id,
              role: "owner",
              name: gate.auth.email,
              username: null,
              joinedAt: now.toISOString(),
            },
          ],
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (mongoErrorCode(error) === 11000) {
      return NextResponse.json({ error: "That team URL is already taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
