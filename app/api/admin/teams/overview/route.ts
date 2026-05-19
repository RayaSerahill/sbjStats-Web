import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireSessionRoles } from "@/lib/auth";
import {
  ensureAuthCollections,
  ensureTeamCollections,
  getDb,
  type TeamDoc,
  type TeamInviteDoc,
  type TeamMemberDoc,
  type UserDoc,
} from "@/lib/db";
import { displayUserName, objectIdToString, serializeTeam } from "@/lib/teams";

function validObjectIds(ids: string[]) {
  return Array.from(new Set(ids)).filter(ObjectId.isValid).map((id) => new ObjectId(id));
}

function isoDate(value: Date | string | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  await ensureTeamCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");
  const teamInvites = db.collection<TeamInviteDoc>("team_invites");
  const users = db.collection<UserDoc>("users");

  const teamRows = await teams.find({}, { sort: { createdAt: -1 } }).toArray();
  const teamIds = teamRows.map((team) => team._id).filter((id): id is ObjectId => id instanceof ObjectId);

  const [memberRows, pendingInvites] = await Promise.all([
    teamIds.length ? teamMembers.find({ teamId: { $in: teamIds } }).sort({ joinedAt: 1 }).toArray() : Promise.resolve([]),
    teamIds.length
      ? teamInvites.find({ teamId: { $in: teamIds }, status: "pending" }).sort({ createdAt: -1 }).toArray()
      : Promise.resolve([]),
  ]);

  const userIds = [
    ...teamRows.map((team) => team.ownerId),
    ...memberRows.map((member) => member.userId),
    ...pendingInvites.map((invite) => invite.inviteeId),
    ...pendingInvites.map((invite) => invite.inviterId),
  ];

  const userRows = userIds.length
    ? await users
        .find(
          { _id: { $in: validObjectIds(userIds) } },
          { projection: { email: 1, username: 1, name: 1, deleted: 1 } }
        )
        .toArray()
    : [];

  const userById = new Map(userRows.map((user) => [user._id?.toHexString() ?? "", user]));

  const membersByTeamId = new Map<string, TeamMemberDoc[]>();
  for (const member of memberRows) {
    const teamId = member.teamId.toHexString();
    const rows = membersByTeamId.get(teamId) ?? [];
    rows.push(member);
    membersByTeamId.set(teamId, rows);
  }

  const invitesByTeamId = new Map<string, TeamInviteDoc[]>();
  for (const invite of pendingInvites) {
    const teamId = invite.teamId.toHexString();
    const rows = invitesByTeamId.get(teamId) ?? [];
    rows.push(invite);
    invitesByTeamId.set(teamId, rows);
  }

  return NextResponse.json({
    ok: true,
    teams: teamRows.map((team) => {
      const teamId = objectIdToString(team._id);
      const owner = userById.get(team.ownerId);
      const members = membersByTeamId.get(teamId) ?? [];
      const invites = invitesByTeamId.get(teamId) ?? [];

      return {
        ...serializeTeam(team, members.length),
        creator: {
          id: team.ownerId,
          name: displayUserName(owner),
          username: owner?.username ?? null,
          email: owner?.email ?? null,
          deleted: owner?.deleted === true,
        },
        members: members.map((member) => {
          const user = userById.get(member.userId);
          return {
            userId: member.userId,
            role: member.role,
            name: displayUserName(user),
            username: user?.username ?? null,
            email: user?.email ?? null,
            deleted: user?.deleted === true,
            joinedAt: isoDate(member.joinedAt),
          };
        }),
        pendingInvites: invites.map((invite) => {
          const invitee = userById.get(invite.inviteeId);
          const inviter = userById.get(invite.inviterId);
          return {
            id: invite._id?.toHexString() ?? "",
            inviteeId: invite.inviteeId,
            inviteeName: displayUserName(invitee),
            inviteeUsername: invitee?.username ?? invite.inviteeUsername ?? null,
            inviterName: displayUserName(inviter),
            createdAt: isoDate(invite.createdAt),
          };
        }),
      };
    }),
  });
}
