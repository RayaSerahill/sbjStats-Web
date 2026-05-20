import { requireDashboardAdmin } from "@/app/dashboard/dashboardSession";

export default async function DashboardAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireDashboardAdmin();

  return children;
}
