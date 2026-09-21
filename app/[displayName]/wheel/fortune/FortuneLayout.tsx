import type { ReactNode } from "react";
import { FortuneNav } from "./nav";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import type { NormalizedStatsStyle } from "@/lib/statsStyleShared";
import type { PublicStatsGame } from "@/lib/publicStatsRoutes";
import { wheelHallOfFame, wheelOutcomeSlices, type WheelStats } from "@/lib/wheelStats";
import { FortuneDailyCharts, FortuneOutcomeDonut } from "./charts";
import { FortuneLeaderboard } from "./leaderboard";
import { avatarFor, fmtCompact, fmtDelta, fmtGil, fmtInt } from "./format";
import "./fortune.css";

const RECENT_DAYS = 30;
const GAMES_COLOR = "#a78bfa";
const GIL_COLOR = "#f2b93c";
const DONUT_COLORS = ["#c9b6ff", "#ffd166", "#7fdfc8", "#ffb3c6", "#a8d8ff", "#ffcfa3"];

const SPARKLES: Array<{ top: string; left?: string; right?: string; color: string; size?: number }> = [
  { top: "6%", left: "4%", color: "#f2b93c" },
  { top: "12%", right: "6%", color: "#7fdfc8", size: 18 },
  { top: "30%", left: "2%", color: "#ffb3c6", size: 16 },
  { top: "44%", right: "3%", color: "#c9b6ff" },
  { top: "68%", left: "5%", color: "#a8d8ff", size: 18 },
  { top: "80%", right: "5%", color: "#f2b93c", size: 16 },
];

type Tone = "lavender" | "mint" | "pink" | "peach" | "yellow" | "sky";

type FortuneLayoutProps = {
  displayName: string;
  username: string;
  rootGame: PublicStatsGame;
  style: NormalizedStatsStyle;
  stats: WheelStats;
  hasGames: boolean;
};

function StatCard({
  tone,
  title,
  icon,
  value,
  sub,
  subUp,
  isName,
}: {
  tone: Tone;
  title: string;
  icon: string;
  value: ReactNode;
  sub?: ReactNode;
  subUp?: boolean;
  isName?: boolean;
}) {
  return (
    <div className={`fortune-card tone-${tone}`}>
      <div className="fortune-card-head">{title}</div>
      <div className="fortune-card-body">
        <span className="fortune-card-icon" aria-hidden>{icon}</span>
        <div>
          <div className={`fortune-card-value${isName ? " is-name" : ""}`}>{value}</div>
          {sub ? <div className={`fortune-card-sub${subUp ? " is-up" : ""}`}>{sub}</div> : null}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children, pill }: { icon: string; children: ReactNode; pill?: ReactNode }) {
  return (
    <h2 className="fortune-section-title">
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
      {pill ? <span className="fortune-pill">{pill}</span> : null}
    </h2>
  );
}

/** The pastel Wheel of Fortune board. Keeps the host's shared nav, brings its own palette. */
export function FortuneLayout({ displayName, username, rootGame, style, stats, hasGames }: FortuneLayoutProps) {
  const fame = wheelHallOfFame(stats.players);
  const slices = wheelOutcomeSlices(stats.prizes);
  // Only days this dealer actually hosted; quiet days are left out.
  const recent = stats.dailyProfits.slice(-RECENT_DAYS);
  const topPrize = stats.prizes[0] ?? null;
  const mostBankruptLost = stats.players.find((player) => player.name === fame.mostBankrupt?.name)?.lostToBankrupt ?? 0;

  return (
    <div className="container-main fortune-scope">
      <div className="fortune-clouds" aria-hidden />
      {SPARKLES.map((s, i) => (
        <span
          key={i}
          className="fortune-sparkle"
          aria-hidden
          style={{ top: s.top, left: s.left, right: s.right, color: s.color, fontSize: s.size }}
        >
          ✦
        </span>
      ))}

      <div className="fortune-page">
        <FortuneNav
          username={username}
          rootGame={rootGame}
          showBlackjack={style.publicNavShowBlackjack}
          showScratch={style.publicNavShowScratch}
          showWheel={style.publicNavShowWheel}
        />

        <header className="fortune-banner">
          <div className="fortune-host">
            <span aria-hidden>♥</span>
            <span>{displayName}</span>
            <span aria-hidden>♥</span>
          </div>
          <h1 className="fortune-title">
            <span className="fortune-title-icon" aria-hidden>🪙</span>
            Wheel of Fortune Stats
            <span className="fortune-title-icon" aria-hidden>🎡</span>
          </h1>
        </header>

        {!hasGames ? (
          <div className="fortune-empty">No wheel games uploaded yet.</div>
        ) : (
          <>
            <section className="fortune-section">
              <SectionTitle icon="🔮">Stat Overview</SectionTitle>
              <div className="fortune-stat-grid">
                <StatCard tone="lavender" title="Total Games" icon="🎮" value={fmtInt(stats.totalGames)} sub={fmtDelta(stats.new.totalGames)} subUp />
                <StatCard tone="mint" title="Total Spins" icon="🎡" value={fmtInt(stats.totalSpins)} sub={fmtDelta(stats.new.totalSpins)} subUp />
                <StatCard tone="pink" title="Total Gil" icon="💰" value={fmtCompact(stats.totalWinValue)} sub={fmtDelta(stats.new.totalWinValue)} subUp />
                <StatCard tone="sky" title="Players" icon="🧑‍🤝‍🧑" value={fmtInt(stats.players.length)} sub="on the board" />
                <StatCard
                  tone="peach"
                  title="Most Games Played"
                  icon="🕹️"
                  value={fame.mostGames?.name ?? "Nobody yet"}
                  sub={fame.mostGames ? `${fmtInt(fame.mostGames.value)} games` : undefined}
                  isName
                />
                <StatCard
                  tone="yellow"
                  title="Top Prize"
                  icon="🎁"
                  value={topPrize?.name ?? "Nothing yet"}
                  sub={topPrize ? `landed ${fmtInt(topPrize.value)} times` : undefined}
                  isName
                />
              </div>
            </section>

            <section className="fortune-section">
              <SectionTitle icon="🏆">Hall of Fame</SectionTitle>
              <div className="fortune-fame-grid">
                <StatCard
                  tone="mint"
                  title="👑 Biggest Winner"
                  icon={fame.biggestWinner ? avatarFor(fame.biggestWinner.name) : "👑"}
                  value={fame.biggestWinner?.name ?? "Nobody yet"}
                  sub={fame.biggestWinner ? fmtGil(fame.biggestWinner.value) : undefined}
                  isName
                />
                <StatCard
                  tone="pink"
                  title="💣 Most Bankrupt"
                  icon={fame.mostBankrupt ? avatarFor(fame.mostBankrupt.name) : "💣"}
                  value={fame.mostBankrupt?.name ?? "Nobody yet"}
                  sub={fame.mostBankrupt ? `${fmtInt(fame.mostBankrupt.value)} times, ${fmtGil(mostBankruptLost)} lost` : undefined}
                  isName
                />
                <StatCard
                  tone="yellow"
                  title="🍀 Luckiest Spinner"
                  icon={fame.luckiestSpinner ? avatarFor(fame.luckiestSpinner.name) : "🍀"}
                  value={fame.luckiestSpinner?.name ?? "Nobody yet"}
                  sub={fame.luckiestSpinner ? `${fmtGil(fame.luckiestSpinner.value)} avg/spin` : undefined}
                  isName
                />
              </div>
            </section>

            <div className="fortune-two-up fortune-section">
              <section>
                <SectionTitle icon="📊" pill={`Last ${RECENT_DAYS} hosting days`}>Daily Fun</SectionTitle>
                <FortuneDailyCharts days={recent} gamesColor={GAMES_COLOR} gilColor={GIL_COLOR} />
              </section>
              <section>
                <SectionTitle icon="🎯">Outcome Distribution</SectionTitle>
                {slices.length ? (
                  <FortuneOutcomeDonut slices={slices} colors={DONUT_COLORS} />
                ) : (
                  <div className="fortune-empty">No prizes landed yet.</div>
                )}
              </section>
            </div>

            <section className="fortune-section">
              <SectionTitle icon="🏅">Leaderboard</SectionTitle>
              <FortuneLeaderboard players={stats.players} size={style.scratchLeaderboardSize} />
            </section>
          </>
        )}

        <StatsFooterSection />
      </div>
    </div>
  );
}
