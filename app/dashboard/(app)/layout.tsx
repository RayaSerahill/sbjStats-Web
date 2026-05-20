import { DashboardShell } from "@/app/dashboard/DashboardShell";
import { getDashboardSession } from "@/app/dashboard/dashboardSession";

export default async function DashboardAppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getDashboardSession();

  return (
    <DashboardShell
      userLabel={session.userLabel}
      canManageUsers={session.canManageUsers}
      teamInviteCount={session.pendingTeamInviteCount}
    >
      {children}
    </DashboardShell>
  );
}
