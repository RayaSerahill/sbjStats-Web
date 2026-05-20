import { Aliases } from "@/app/components/Aliases";

export default function DashboardGlobalAliasesPage() {
  return (
    <Aliases
      title="Global aliases"
      description="Aliases managed by admins and applied to public pages before each user's own aliases."
      endpoint="/api/admin/global-aliases"
    />
  );
}
