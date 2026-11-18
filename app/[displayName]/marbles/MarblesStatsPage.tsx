import type { Metadata } from "next";
import { cache } from "react";
import { DiscordComponentEmbed } from "@/app/components/DiscordComponentEmbed";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import { StatsPageNav } from "@/app/components/StatsPageNav";
import { ensureAuthCollections, ensureGameCollections, getDb } from "@/lib/db";
import { loadMarblesStatsForUploader } from "@/lib/marblesStats";
import { normalizePublicStatsRootGame } from "@/lib/publicStatsRoutes";
import { findPublicStatsUser } from "@/lib/publicStatsUser";
import { getStatsStyleForUploader } from "@/lib/statsStyle";
import { getBackgroundStyleCss, getStatsFontFamily } from "@/lib/statsStyleShared";
import { MarblesLeaderboard } from "./leaderboard";

const loadPage = cache(async (displayName: string) => {
  await ensureAuthCollections();
  await ensureGameCollections();

  const db = await getDb();
  const { user, displayName: dn, normalizedDisplayName } = await findPublicStatsUser(db, displayName);
  if (!dn || !user?._id) return null;

  void db.collection("traffic").insertOne({ userId: user._id, at: new Date() });

  const uploaderId = user._id.toHexString();
  const [stats, style] = await Promise.all([
    loadMarblesStatsForUploader(db, uploaderId),
    getStatsStyleForUploader(uploaderId, db),
  ]);

  return {
    displayName: user.name ?? user.username ?? dn,
    username: user.username ?? normalizedDisplayName,
    publicStatsRootGame: normalizePublicStatsRootGame(user.publicStatsRootGame),
    stats,
    style,
  };
});

export async function generateMarblesMetadata({ params }: { params: Promise<{ displayName: string }> }): Promise<Metadata> {
  const { displayName } = await params;
  await ensureAuthCollections();
  const db = await getDb();
  const { user } = await findPublicStatsUser(db, displayName);
  if (!user?._id) return { title: "Stats" };

  return { title: `${user.name ?? user.username ?? displayName} | Marbles Stats` };
}

/** Public marbles stats page. Like the classic wheel page, it wears the scratch style group. */
export async function MarblesStatsPage({ params }: { params: Promise<{ displayName: string }> }) {
  const { displayName } = await params;
  const page = await loadPage(displayName);

  if (!page) {
    return (
      <div className="container-main min-h-screen w-full px-4 py-10">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">Not found</div>
        </div>
      </div>
    );
  }

  const { stats, style } = page;
  const { totals, games, players } = stats;
  const username = page.username || page.displayName;

  const fontColor = style.scratchFontColor;
  const fontFamily = getStatsFontFamily(style.scratchFontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.scratchBackground);
  const containerBackgroundStyle = getBackgroundStyleCss(style.scratchContainerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.scratchElementBackground);
  const tableBackgroundStyle = getBackgroundStyleCss(style.scratchLeaderboardTableBackground);
  const tableHeaderBackgroundStyle = getBackgroundStyleCss(style.scratchLeaderboardTableHeaderBackground);
  const headerCell = { color: style.scratchLeaderboardTableHeaderTextColor, opacity: 0.7 };

  const tiles: Array<{ label: string; value: number; note?: string }> = [
    { label: "Marble games hosted", value: totals.games, note: `${fmtInt(totals.tournaments)} of them tournaments` },
    { label: "Races run", value: totals.races },
    { label: "Players", value: totals.uniquePlayers || totals.players },
    { label: "Gil taken", value: totals.taken },
    { label: "Gil won by players", value: totals.won },
    { label: "Boost added to prize pools", value: totals.boost },
  ];

  return (
    <div className="container-main min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: fontColor, fontFamily }}>
      <DiscordComponentEmbed
        displayName={page.displayName}
        username={username}
        rootGame={page.publicStatsRootGame}
        games={[
          { game: "blackjack", enabled: style.publicNavShowBlackjack },
          { game: "scratch", enabled: style.publicNavShowScratch },
          { game: "wheel", enabled: style.publicNavShowWheel },
          { game: "marbles", enabled: style.publicNavShowMarbles },
        ]}
      />
      <div className="mx-auto w-full max-w-5xl">
        <StatsPageNav
          username={username}
          rootGame={page.publicStatsRootGame}
          showBlackjack={style.publicNavShowBlackjack}
          showScratch={style.publicNavShowScratch}
          showWheel={style.publicNavShowWheel}
          showMarbles={style.publicNavShowMarbles}
          background={style.publicNavBackground}
          borderRadius={style.publicNavBorderRadius}
          fontColor={style.publicNavFontColor}
          fontSize={style.publicNavFontSize}
          fontStyle={style.publicNavFontStyle}
          inactive={style.publicNavInactive}
          hover={style.publicNavHover}
          active={style.publicNavActive}
        />
      </div>
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" style={containerBackgroundStyle}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" style={{ color: fontColor }}>{page.displayName}</h1>
          <p className="text-sm" style={{ color: fontColor }}>
            Marbles stats for uploader <span className="font-medium">{username}</span>
          </p>
        </div>

        {games.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm" style={{ ...containerBackgroundStyle, color: fontColor }}>
            No marble games uploaded yet.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {tiles.map((tile) => (
                <div key={tile.label} className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                  <div className="text-xs font-medium opacity-70" style={{ color: fontColor }}>{tile.label}</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: fontColor }}>{fmtInt(tile.value)}</div>
                  {tile.note ? <div className="mt-1 text-xs opacity-70" style={{ color: fontColor }}>{tile.note}</div> : null}
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-2">
              <MarblesLeaderboard
                fontColor={fontColor}
                elementBackground={style.scratchElementBackground}
                tableBackground={style.scratchLeaderboardTableBackground}
                tableHeaderBackground={style.scratchLeaderboardTableHeaderBackground}
                tableHeaderTextColor={style.scratchLeaderboardTableHeaderTextColor}
                tabContainerBackground={style.scratchLeaderboardTabContainerBackground}
                tabActiveBackground={style.scratchLeaderboardTabActiveBackground}
                tabInactiveBackground={style.scratchLeaderboardTabInactiveBackground}
                tabHoverBackground={style.scratchLeaderboardTabHoverBackground}
                tabActiveTextColor={style.scratchLeaderboardTabActiveTextColor}
                tabInactiveTextColor={style.scratchLeaderboardTabInactiveTextColor}
                tabHoverTextColor={style.scratchLeaderboardTabHoverTextColor}
                leaderboardSize={style.scratchLeaderboardSize}
                players={players.map((player) => ({
                  key: player.playerKey,
                  name: player.playerName,
                  games: player.games,
                  races: player.races,
                  racesWon: player.racesWon,
                  tournamentsWon: player.tournamentsWon,
                  won: player.won,
                }))}
              />

              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="mb-4 text-lg font-semibold" style={{ color: fontColor }}>Recent games</div>
                <div className="overflow-x-auto rounded-xl border border-black/10" style={tableBackgroundStyle}>
                  <table className="w-full text-sm" style={{ color: fontColor }}>
                    <thead>
                      <tr className="border-b border-black/10 text-left" style={tableHeaderBackgroundStyle}>
                        <th className="px-3 py-2 text-xs font-semibold" style={headerCell}>Date</th>
                        <th className="px-3 py-2 text-xs font-semibold" style={headerCell}>Format</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold" style={headerCell}>Races</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold" style={headerCell}>Players</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold" style={headerCell}>Taken</th>
                      </tr>
                    </thead>
                    <tbody>
                      {games.slice(0, RECENT_GAMES).map((game) => (
                        <tr key={game.gameId} className="border-b border-black/10 last:border-b-0">
                          <td className="px-3 py-2 tabular-nums">{fmtDay(game.startedAt)}</td>
                          <td className="px-3 py-2">
                            {game.tournament
                              ? `Tournament${game.tournamentFormat ? ` (${game.tournamentFormat})` : ""}`
                              : "Race"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtInt(game.totalRaces)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtInt(game.totalPlayers)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtInt(game.totalTaken)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <StatsFooterSection />
    </div>
  );
}

const RECENT_GAMES = 10;

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtDay(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
