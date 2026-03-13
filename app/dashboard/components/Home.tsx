export function Home() {
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
          To start with, you need to import some games! There are two ways of doing this, either manually through the game import section, or automatically by downloading a dalamud plugin and generating an API key!
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Manual way</h3>
            <p className={"mt-2"}>
              There are a couple steps to this, but don't worry, it's not that bad!
            </p>
            <ol className="mt-2 list-inside list-decimal">
              <li>
                Open up simpleBlackjack plugin in FFXIV and navigate to "Stats" section
              </li>
              <li>
                Open up "Archive" and scroll to the bottom
              </li>
              <li>
                Open up the "Export all records in all Archives as CSV" section, and press "Export data"
              </li>
              <li>
                Upload the generated file in the game import section of this dashboard, and wait for the import to finish!
              </li>
              <li>
                Aand done! You can now explore your stats, and optionally customize how they are displayed in the "Stats style" section of the dashboard!
              </li>
            </ol>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Automatic upload</h3>
            <p className={"mt-2"}>
              Best paired with the manual import, as automatic upload only uploads new games, not ones you have already had.
            </p>
            <ol className="mt-2 list-inside list-decimal">
              <li>
                Add a new custom repository in the experimental tab of dalamud with the following URL: <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800">https://serahill.net/stats/repo.json</code>
              </li>
              <li>
                Install the sbjStats plugin from the repository, and open it up in the plugin list
              </li>
              <li>
                Navigate to the "API" tab on this dashboard, and generate a new API key
              </li>
              <li>
                Paste the generated API key in the plugin, and enable automatic upload!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
