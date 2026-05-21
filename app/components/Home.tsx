import Link from "next/link";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

export function Home() {
  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Home"
        description="Heya! Welcome sbj stats! This website allows you to store your simple blackjack games and make some fun statistics available to the public. You can import games, manage your account, and customize how your stats are displayed. Use the navigation on the left to explore the different sections of your dashboard. If you have any questions or need assistance, feel free to reach out to me! Happy exploring!"
      />

      <div className="mt-6 space-y-6">
        <DashboardSection title="How to use">
          <p className="mt-2">
            To start with, you need to import some games! You can do this with the small tutorial below :3
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">SimpleStats Plugin</h3>
              <ol className="mt-2 list-inside list-decimal">
                <li>
                  Add a new custom repository in the experimental tab of dalamud with the following URL: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800">https://serahill.net/plugins.json</code>
                </li>
                <li>
                  Install the SimpleStats plugin from the repository, and open it up in the plugin list
                </li>
                <li>
                  Navigate to the <Link href="/dashboard/api-keys" className="internal-link">API Keys</Link> tab on this dashboard, and generate a new API key
                </li>
                <li>
                  Paste the generated API key in the plugin, and enable automatic upload!
                </li>
                <li>
                  If you have existing games you want to upload, you can click the &quot;Upload existing stats&quot; button in the plugin, which will upload all games that are not yet uploaded to the dashboard!
                </li>
              </ol>
            </div>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
