import type { Metadata } from "next";
import { cache } from "react";
import { ensureAuthCollections, ensureGameCollections, getDb } from "@/lib/db";
import { loadMarblesStatsForUploader } from "@/lib/marblesStats";
import { findPublicStatsUser } from "@/lib/publicStatsUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PublicMarblesPageProps = {
  params: Promise<{ displayName: string }>;
};

const loadPage = cache(async (displayName: string) => {
  await ensureAuthCollections();
  await ensureGameCollections();

  const db = await getDb();
  const { user, displayName: dn } = await findPublicStatsUser(db, displayName);
  if (!dn || !user?._id) return null;

  void db.collection("traffic").insertOne({ userId: user._id, at: new Date() });

  return {
    displayName: user.name ?? user.username ?? dn,
    stats: await loadMarblesStatsForUploader(db, user._id.toHexString()),
  };
});

export async function generateMetadata({ params }: PublicMarblesPageProps): Promise<Metadata> {
  const { displayName } = await params;
  const page = await loadPage(displayName);
  return { title: page ? `${page.displayName} | Marbles Stats` : "Stats" };
}

const gil = (value: number) => value.toLocaleString("en-US");

const day = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

/** Bare public marbles page: host totals and the games behind them. */
export default async function PublicMarblesPage({ params }: PublicMarblesPageProps) {
  const { displayName } = await params;
  const page = await loadPage(displayName);

  if (!page) {
    return <main className="mx-auto w-full max-w-4xl px-4 py-10">Not found</main>;
  }

  const { totals, games, players } = page.stats;
  const tiles: Array<[string, string]> = [
    ["Games", gil(totals.games)],
    ["Races", gil(totals.races)],
    ["Players", gil(totals.players)],
    ["Gil taken", gil(totals.taken)],
    ["Gil won", gil(totals.won)],
    ["Boost added", gil(totals.boost)],
  ];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{page.displayName} | Marbles</h1>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-current/15 p-4">
            <dt className="text-sm opacity-70">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {players.length > 0 && (
        <div className="mt-8 overflow-x-auto">
          <h2 className="mb-2 text-lg font-semibold">Players</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-current/15">
                <th className="py-2 pr-4 font-medium">Player</th>
                <th className="py-2 pr-4 text-right font-medium">Games</th>
                <th className="py-2 pr-4 text-right font-medium">Races</th>
                <th className="py-2 pr-4 text-right font-medium">Races won</th>
                <th className="py-2 pr-4 text-right font-medium">Tournaments won</th>
                <th className="py-2 text-right font-medium">Gil won</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.playerKey} className="border-b border-current/10">
                  <td className="py-2 pr-4">{player.playerName}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(player.games)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(player.races)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(player.racesWon)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(player.tournamentsWon)}</td>
                  <td className="py-2 text-right tabular-nums">{gil(player.won)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {games.length === 0 ? (
        <p className="mt-8 opacity-70">No marble games yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <h2 className="mb-2 text-lg font-semibold">Games</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-current/15">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Track</th>
                <th className="py-2 pr-4 font-medium">Format</th>
                <th className="py-2 pr-4 text-right font-medium">Races</th>
                <th className="py-2 pr-4 text-right font-medium">Players</th>
                <th className="py-2 pr-4 text-right font-medium">Taken</th>
                <th className="py-2 text-right font-medium">Paid out</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.gameId} className="border-b border-current/10">
                  <td className="py-2 pr-4 tabular-nums">{day(game.startedAt)}</td>
                  <td className="py-2 pr-4">{game.trackThemeName ?? game.theme ?? "-"}</td>
                  <td className="py-2 pr-4">
                    {game.tournament ? `Tournament${game.tournamentFormat ? ` (${game.tournamentFormat})` : ""}` : "Race"}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(game.totalRaces)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(game.totalPlayers)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{gil(game.totalTaken)}</td>
                  <td className="py-2 text-right tabular-nums">{gil(game.totalPayouts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
