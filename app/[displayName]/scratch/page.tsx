import {getBackgroundStyleCss, getStatsFontFamily} from "@/lib/statsStyleShared";
import { cache } from "react";
import { getStatsStyleForUploader } from "@/lib/statsStyle";
import { getDb, type UserDoc } from "@/lib/db";
import { ScratchCharts } from "./charts";
import { LeaderboardElement } from "./leaderboard";
import { StatsPageNav } from "@/app/components/StatsPageNav";
import {StatsFooterSection} from "@/app/components/StatsFooterSection";

const loadStatsCached = cache(loadStats);

type StatsPageStyle = Awaited<ReturnType<typeof getStatsStyleForUploader>>;

type ScratchGameRow = {
  _id: unknown;
  playerName?: string;
  archivedAt?: number;
  totalCards?: number;
  wins?: number;
  prizesWon?: string[];
};

type ScratchPrizeRow = {
  _id: unknown;
  prize?: string;
  value?: number;
};

type AliasRow = {
  primaryTag?: string;
  aliasTag?: string;
};

type BlacklistRow = {
  playerTag?: string;
};

export default async function Scratch({
                                        params,
                                      }: {
  params: Promise<{ displayName: string }>;
}) {
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
  const gamesStats = calculateGames(result);

  const style = result.style;
  const fontFamily = getStatsFontFamily(style.scratchFontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.scratchBackground);
  const containerBackgroundStyle = getBackgroundStyleCss(style.scratchContainerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.scratchElementBackground);

  return (
    <div className="container-main min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: style.scratchFontColor, fontFamily }}>
      <div className="mx-auto w-full max-w-5xl">
        <StatsPageNav
          username={result.username || result.displayName}
          showBlackjack={style.publicNavShowBlackjack}
          showScratch={style.publicNavShowScratch}
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
          <h1 className={"text-2xl font-semibold"} style={{ color: style.scratchFontColor }}>{result.displayName}</h1>
          <p className="text-sm" style={{ color: style.scratchFontColor }}>
            Stats for uploader{" "}
            <span className="font-medium" style={{ color: style.scratchFontColor }}>
              {result.username || result.displayName}
            </span>
          </p>
        </div>
        {result.games.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm" style={{ ...containerBackgroundStyle, color: style.scratchFontColor }}>
            No rounds uploaded yet.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.scratchFontColor }}>Scratch cards given out</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: style.scratchFontColor }}>{fmtInt(gamesStats.totalCards)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: style.scratchFontColor }}>Last hosting day: {fmtMoney(gamesStats.new.totalCards)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.scratchFontColor }}>Total winning cards</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: style.scratchFontColor }}>{fmtInt(gamesStats.totalWins)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: style.scratchFontColor }}>Last hosting day: {fmtMoney(gamesStats.new.totalWins)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.scratchFontColor }}>Total money won from cards</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: style.scratchFontColor }}>{fmtInt(gamesStats.totalWinValue)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: style.scratchFontColor }}>Last hosting day: {fmtMoney(gamesStats.new.totalWinValue)}</div>
              </div>
            </div>


            <div className="my-12">
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <ScratchCharts
                  dailyProfits={gamesStats.dailyProfits}
                  fontColor={style.scratchFontColor}
                  elementBackground={style.scratchElementBackground}
                  cardsColor={style.scratchChartCardsColor}
                  winsColor={style.scratchChartWinsColor}
                  valueColor={style.scratchChartValueColor}
                />
                <LeaderboardElement
                  fontColor={style.scratchFontColor}
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
                  data={gamesStats}
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

async function loadStats(displayName: string): Promise<LoadStatsResult> {
  const db = await getDb();

  const users = db.collection<UserDoc>("users");
  const gamesTable = db.collection("scratch_games");
  const prizesTable = db.collection("scratch_prizes");
  const aliasesTable = db.collection("aliases");
  const blacklistTable = db.collection("blacklist");

  let dn = (displayName ?? "").trim();
  try {
    dn = decodeURIComponent(dn);
  } catch {}

  if (!dn) {
    return { ok: false };
  }

  const dnNorm = norm(dn);

  const user =
    (await users.findOne({ username: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne(
      { name: dn, deleted: { $ne: true } },
      { collation: { locale: "en", strength: 2 } }
    )) ??
    (await users.findOne({ email: dnNorm, deleted: { $ne: true } }));

  if (!user?._id) {
    return { ok: false };
  }

  const uploaderId = user._id.toHexString();

  void db.collection("traffic").insertOne({
    userId: user._id,
    at: new Date(),
  });

  const [games, prizes, aliases, blacklist, style, nameDoc] = await Promise.all([
    gamesTable
      .find(
        { uploaderId },
        {
          projection: {
            _id: 1,
            playerName: 1,
            archivedAt: 1,
            totalCards: 1,
            wins: 1,
            prizesWon: 1,
          },
        }
      )
      .toArray(),
    prizesTable
      .find(
        { uploaderId },
        {
          projection: {
            _id: 1,
            prize: 1,
            value: 1,
          },
        }
      )
      .toArray(),
    aliasesTable
      .find(
        { createdBy: uploaderId },
        {
          projection: {
            primaryTag: 1,
            aliasTag: 1,
          },
        }
      )
      .toArray(),
    blacklistTable
      .find(
        { createdBy: uploaderId },
        {
          projection: {
            playerTag: 1,
          },
        }
      )
      .toArray(),
    getStatsStyleForUploader(uploaderId, db),
    users.findOne(
      { _id: user._id },
      {
        projection: {
          name: 1,
          username: 1,
        },
      }
    ),
  ]);

  return {
    ok: true,
    displayName: nameDoc?.name ?? user.name ?? user.username ?? dn,
    username: user.username ?? dnNorm,
    uploaderId,
    games: games as ScratchGameRow[],
    prizes: prizes as ScratchPrizeRow[],
    aliases: aliases as AliasRow[],
    blacklist: blacklist as BlacklistRow[],
    style,
  };
}

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}


function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}

export type LoadStatsResult =
  | { ok: false }
  | {
  ok: true;
  displayName: string;
  username: string;
  uploaderId: string;
  games: ScratchGameRow[];
  prizes: ScratchPrizeRow[];
  aliases: AliasRow[];
  blacklist: BlacklistRow[];
  style: StatsPageStyle;
};

type GamesStatsPrize = {
  name: string;
  value: number;
  prizeValue: number;
  totalWinValue: number;
};

type GamesStatsPlayer = {
  name: string;
  totalCards: number;
  totalWins: number;
  totalWinValue: number;
  prizes: GamesStatsPrize[];
};

type GamesStatsSummary = {
  totalCards: number;
  totalWins: number;
  totalWinValue: number;
};

type GamesStatsDailyProfit = {
  date: string;
  totalCards: number;
  totalWins: number;
  totalWinValue: number;
};

type GamesStats = {
  totalCards: number;
  totalWins: number;
  totalWinValue: number;
  new: GamesStatsSummary;
  dailyProfits: GamesStatsDailyProfit[];
  players: GamesStatsPlayer[];
  prizes: GamesStatsPrize[];
};

export function calculateGames(result: LoadStatsResult): GamesStats {
  const empty: GamesStats = {
    totalCards: 0,
    totalWins: 0,
    totalWinValue: 0,
    new: {
      totalCards: 0,
      totalWins: 0,
      totalWinValue: 0,
    },
    dailyProfits: [],
    players: [],
    prizes: [],
  };

  if (!result.ok) {
    return empty;
  }

  const prizeValueByName = new Map<string, number>();

  for (const prize of result.prizes) {
    const name = String(prize.prize ?? "").trim();
    if (!name) continue;
    prizeValueByName.set(name, Number(prize.value ?? 0));
  }

  const totalPrizeCounts = new Map<string, number>();
  const playerMap = new Map<
    string,
    {
      name: string;
      totalCards: number;
      totalWins: number;
      totalWinValue: number;
      prizeCounts: Map<string, number>;
    }
  >();

  const dailyMap = new Map<
    string,
    {
      date: string;
      totalCards: number;
      totalWins: number;
      totalWinValue: number;
    }
  >();

  let totalCards = 0;
  let totalWins = 0;
  let totalWinValue = 0;

  let newestDayKey: string | null = null;

  for (const game of result.games) {
    const archivedAt = Number(game.archivedAt ?? 0);
    if (!archivedAt) continue;

    const dayKey = toUtcDayKey(archivedAt);
    if (newestDayKey === null || dayKey > newestDayKey) {
      newestDayKey = dayKey;
    }
  }

  let newTotalCards = 0;
  let newTotalWins = 0;
  let newTotalWinValue = 0;

  for (const game of result.games) {
    const playerName = String(game.playerName ?? "").trim() || "Unknown";
    const playerKey = playerName.toLowerCase();
    const cards = Number(game.totalCards ?? 0);
    const wins = Number(game.wins ?? 0);
    const archivedAt = Number(game.archivedAt ?? 0);
    const prizesWon = Array.isArray(game.prizesWon) ? game.prizesWon : [];

    let gameWinValue = 0;

    for (const rawPrize of prizesWon) {
      const prizeName = String(rawPrize ?? "").trim();
      if (!prizeName) continue;

      const configuredPrizeValue = Number(prizeValueByName.get(prizeName) ?? 0);
      gameWinValue += configuredPrizeValue;

      totalPrizeCounts.set(prizeName, (totalPrizeCounts.get(prizeName) ?? 0) + 1);
    }

    totalCards += cards;
    totalWins += wins;
    totalWinValue += gameWinValue;

    if (archivedAt) {
      const dayKey = toUtcDayKey(archivedAt);
      const existingDay = dailyMap.get(dayKey) ?? {
        date: dayKey,
        totalCards: 0,
        totalWins: 0,
        totalWinValue: 0,
      };

      existingDay.totalCards += cards;
      existingDay.totalWins += wins;
      existingDay.totalWinValue += gameWinValue;

      dailyMap.set(dayKey, existingDay);

      if (newestDayKey && dayKey === newestDayKey) {
        newTotalCards += cards;
        newTotalWins += wins;
        newTotalWinValue += gameWinValue;
      }
    }

    const existingPlayer = playerMap.get(playerKey) ?? {
      name: playerName,
      totalCards: 0,
      totalWins: 0,
      totalWinValue: 0,
      prizeCounts: new Map<string, number>(),
    };

    existingPlayer.totalCards += cards;
    existingPlayer.totalWins += wins;
    existingPlayer.totalWinValue += gameWinValue;

    for (const rawPrize of prizesWon) {
      const prizeName = String(rawPrize ?? "").trim();
      if (!prizeName) continue;

      existingPlayer.prizeCounts.set(
        prizeName,
        (existingPlayer.prizeCounts.get(prizeName) ?? 0) + 1
      );
    }

    playerMap.set(playerKey, existingPlayer);
  }

  const allPrizeNames = new Set<string>([
    ...Array.from(prizeValueByName.keys()),
    ...Array.from(totalPrizeCounts.keys()),
  ]);

  const prizes: GamesStatsPrize[] = Array.from(allPrizeNames)
    .map((name) => {
      const count = totalPrizeCounts.get(name) ?? 0;
      const prizeValue = prizeValueByName.get(name) ?? 0;

      return {
        name,
        value: count,
        prizeValue,
        totalWinValue: count * prizeValue,
      };
    })
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      if (b.totalWinValue !== a.totalWinValue) return b.totalWinValue - a.totalWinValue;
      return a.name.localeCompare(b.name);
    });

  const players: GamesStatsPlayer[] = Array.from(playerMap.values())
    .map((player) => ({
      name: player.name,
      totalCards: player.totalCards,
      totalWins: player.totalWins,
      totalWinValue: player.totalWinValue,
      prizes: Array.from(player.prizeCounts.entries())
        .map(([name, count]) => {
          const prizeValue = prizeValueByName.get(name) ?? 0;

          return {
            name,
            value: count,
            prizeValue,
            totalWinValue: count * prizeValue,
          };
        })
        .sort((a, b) => {
          if (b.value !== a.value) return b.value - a.value;
          if (b.totalWinValue !== a.totalWinValue) return b.totalWinValue - a.totalWinValue;
          return a.name.localeCompare(b.name);
        }),
    }))
    .sort((a, b) => {
      if (b.totalWinValue !== a.totalWinValue) return b.totalWinValue - a.totalWinValue;
      if (b.totalWins !== a.totalWins) return b.totalWins - a.totalWins;
      if (b.totalCards !== a.totalCards) return b.totalCards - a.totalCards;
      return a.name.localeCompare(b.name);
    });

  const dailyProfits: GamesStatsDailyProfit[] = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return {
    totalCards,
    totalWins,
    totalWinValue,
    new: {
      totalCards: newTotalCards,
      totalWins: newTotalWins,
      totalWinValue: newTotalWinValue,
    },
    dailyProfits,
    players,
    prizes,
  };
}

function toUtcDayKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
