"use client";
import { useAdminNav } from "../dashboard/AdminSectionsClient";

export function Home() {
  const navigate = useAdminNav();
  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Home</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Heya! Welcome sbj stats! This website allows you to store your simple blackjack games and make some fun statistics available to the public. You can import games, manage your account, and customize how your stats are displayed. Use the navigation on the left to explore the different sections of your dashboard. If you have any questions or need assistance, feel free to reach out to me! Happy exploring!
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
        <p className="font-medium text-zinc-900">How to use?</p>
        <p className="mt-2">
          To start with, you need to import some games! You can do this with the small tutorial below :3
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">sbjStats Plugin</h3>
            <p className={"mt-2"}>
            </p>
            <ol className="mt-2 list-inside list-decimal">
              <li>
                Add a new custom repository in the experimental tab of dalamud with the following URL: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800">https://status.serahill.net/repo.json</code>
              </li>
              <li>
                Install the sbjStats plugin from the repository, and open it up in the plugin list
              </li>
              <li>
                Navigate to the <span className={"internal-link"} onClick={() => navigate("api-keys")}>API Keys</span> tab on this dashboard, and generate a new API key
              </li>
              <li>
                Paste the generated API key in the plugin, and enable automatic upload!
              </li>
              <li>
                If you have existing games you want to upload, you can click the "Upload existing stats" button in the plugin, which will upload all games that are not yet uploaded to the dashboard!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
