import type { Metadata } from "next";
import { cache } from "react";
import { getBackgroundStyleCss, getStatsFontFamily } from "@/lib/statsStyleShared";
import { ensureAuthCollections, getDb } from "@/lib/db";
import { WheelCharts } from "./charts";
import { WheelLeaderboard } from "./leaderboard";
import { FortuneLayout } from "./fortune/FortuneLayout";
import { StatsPageNav } from "@/app/components/StatsPageNav";
import { DiscordComponentEmbed } from "@/app/components/DiscordComponentEmbed";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import { findPublicStatsUser } from "@/lib/publicStatsUser";
import { calculateWheelStats } from "@/lib/wheelStats";
import { loadWheelStatsByDisplayName } from "./loadStats";

const loadStatsCached = cache(loadWheelStatsByDisplayName);

export async function generateWheelMetadata({ params }: { params: Promise<{ displayName: string }> }): Promise<Metadata> {
  const { displayName } = await params;
  await ensureAuthCollections();
  const db = await getDb();
  const { user } = await findPublicStatsUser(db, displayName);
  if (!user?._id) return { title: "Stats" };

  return { title: `${user.name ?? user.username ?? displayName} | Wheel Stats` };
}

/**
 * Public wheel stats page. The classic layout wears the Scratch page's
 * clothes (same layout and the scratch style group); the fortune layout
 * is the pastel Wheel of Fortune board hosts can pick in the dashboard.
 */
export async function WheelStatsPage({ params }: { params: Promise<{ displayName: string }> }) {
  const { displayName } = await params;
  const result = await loadStatsCached(displayName);

  if (!result.ok) {
    return (
      <div className="container-main min-h-screen w-full px-4 py-10">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">Not found</div>
        </div>
      </div>
    );
  }

  const stats = calculateWheelStats(result);
  const style = result.style;

  const embed = (
    <DiscordComponentEmbed
      displayName={result.displayName}
      username={result.username || result.displayName}
      rootGame={result.publicStatsRootGame}
      games={[
        { game: "blackjack", enabled: style.publicNavShowBlackjack },
        { game: "scratch", enabled: style.publicNavShowScratch },
        { game: "wheel", enabled: style.publicNavShowWheel },
      ]}
    />
  );

  if (style.wheelLayout === "fortune") {
    return (
      <>
        {embed}
        <FortuneLayout
          displayName={result.displayName}
          username={result.username || result.displayName}
          rootGame={result.publicStatsRootGame}
          style={style}
          stats={stats}
          hasGames={result.games.length > 0}
        />
      </>
    );
  }

  const fontColor = style.scratchFontColor;
  const fontFamily = getStatsFontFamily(style.scratchFontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.scratchBackground);
  const containerBackgroundStyle = getBackgroundStyleCss(style.scratchContainerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.scratchElementBackground);

  return (
    <div className="container-main min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: fontColor, fontFamily }}>
      {embed}
      <div className="mx-auto w-full max-w-5xl">
        <StatsPageNav
          username={result.username || result.displayName}
          rootGame={result.publicStatsRootGame}
          showBlackjack={style.publicNavShowBlackjack}
          showScratch={style.publicNavShowScratch}
          showWheel={style.publicNavShowWheel}
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
          <h1 className="text-2xl font-semibold" style={{ color: fontColor }}>{result.displayName}</h1>
          <p className="text-sm" style={{ color: fontColor }}>
            Wheel stats for uploader{" "}
            <span className="font-medium" style={{ color: fontColor }}>
              {result.username || result.displayName}
            </span>
          </p>
        </div>
        {result.games.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm" style={{ ...containerBackgroundStyle, color: fontColor }}>
            No wheel games uploaded yet.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: fontColor }}>Wheel games played</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: fontColor }}>{fmtInt(stats.totalGames)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: fontColor }}>Last hosting day: {fmtDelta(stats.new.totalGames)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: fontColor }}>Total spins</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: fontColor }}>{fmtInt(stats.totalSpins)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: fontColor }}>Last hosting day: {fmtDelta(stats.new.totalSpins)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: fontColor }}>Total gil won from the wheel</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: fontColor }}>{fmtInt(stats.totalWinValue)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: fontColor }}>Last hosting day: {fmtDelta(stats.new.totalWinValue)}</div>
              </div>
            </div>

            <div className="my-12">
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <WheelCharts
                  dailyProfits={stats.dailyProfits}
                  fontColor={fontColor}
                  elementBackground={style.scratchElementBackground}
                  spinsColor={style.scratchChartCardsColor}
                  gamesColor={style.scratchChartWinsColor}
                  valueColor={style.scratchChartValueColor}
                />
                <WheelLeaderboard
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
                  players={stats.players}
                  leaderboardSize={style.scratchLeaderboardSize}
                />
              </div>
            </div>
          </>
        )}
      </div>
      <StatsFooterSection />
    </div>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtDelta(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}
