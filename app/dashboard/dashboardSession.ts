import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, verifyAuthToken, type JwtUser } from "@/lib/auth";
import { normalizeDashboardAccentColor, normalizeDashboardTheme } from "@/lib/account";
import { ensureAuthCollections, ensureTeamCollections, getDb, type DashboardTheme, type TeamInviteDoc, type UserDoc } from "@/lib/db";

export type DashboardSession = {
  auth: JwtUser;
  user: UserDoc;
  userLabel: string;
  canManageUsers: boolean;
  pendingTeamInviteCount: number;
  dashboardTheme: DashboardTheme;
  dashboardAccentColor: string;
};

export async function getDashboardSession(): Promise<DashboardSession> {
  await ensureAuthCollections();
  await ensureTeamCollections();

  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const auth = token ? await verifyAuthToken(token).catch(() => null) : null;

  if (!auth) redirect("/dashboard/login");
  if (!ObjectId.isValid(auth.id)) redirect("/dashboard/login");

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne({ _id: new ObjectId(auth.id), deleted: { $ne: true } });
  if (!user) redirect("/dashboard/login");

  const canManageUsers = user.role === "owner" || user.role === "admin";
  const pendingTeamInviteCount = await db
    .collection<TeamInviteDoc>("team_invites")
    .countDocuments({ inviteeId: auth.id, status: "pending" });

  return {
    auth,
    user,
    userLabel: user.name ?? user.username ?? auth.email,
    canManageUsers,
    pendingTeamInviteCount,
    dashboardTheme: normalizeDashboardTheme(user.dashboardTheme),
    dashboardAccentColor: normalizeDashboardAccentColor(user.dashboardAccentColor),
  };
}

export async function requireDashboardAdmin() {
  const session = await getDashboardSession();
  if (!session.canManageUsers) redirect("/dashboard");
  return session;
}
