import type { Metadata } from "next";
import { Fragment, cache } from "react";
import { notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { ExternalLink } from "lucide-react";
import {
  ensureAuthCollections,
  ensureGameCollections,
  ensureTeamCollections,
  getDb,
  type TeamDoc,
  type TeamMemberDoc,
  type UserDoc,
} from "@/lib/db";
import { DEFAULT_TEAM_ACCENT_COLOR, normalizeEnabledGames, normalizeTeamAccentColor, normalizeTeamSlug, normalizeTeamTheme } from "@/lib/teams";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HeatmapCell = {
  day: number;
  hour: number;
  count: number;
};

type ActivityAggRow = {
  _id: {
    day: number;
    hour: number;
  };
  count: number;
};

type ScratchPrizeRow = {
  uploaderId?: string;
  prize?: string;
  value?: number | null;
};

type ScratchGameRow = {
  uploaderId?: string;
  prizesWon?: string[];
};

type LoadTeamStatsResult =
  | { ok: false }
  | {
      ok: true;
      team: {
        name: string;
        slug: string;
        description: string;
        theme: string;
        accentColor: string;
        enabledGames: string[];
      };
      dealerCount: number;
      totalMoney: number;
      blackjackMoney: number;
      scratchMoney: number;
      blackjackGames: number;
      scratchGames: number;
      totalActivities: number;
      members: Array<{
        name: string;
        username: string | null;
      }>;
      heatmap: HeatmapCell[][];
      maxActivity: number;
    };

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}

function displayUser(user: Pick<UserDoc, "email" | "name" | "username"> | undefined) {
  if (!user) return "Unknown dealer";
  return user.name || user.username || user.email;
}

function dayIndexFromMongoDay(day: number) {
  return day === 1 ? 6 : Math.max(0, day - 2);
}

function emptyHeatmap() {
  return Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day,
      hour,
      count: 0,
    }))
  );
}

function addActivityRows(heatmap: HeatmapCell[][], rows: ActivityAggRow[]) {
  for (const row of rows) {
    const day = dayIndexFromMongoDay(Number(row._id?.day) || 1);
    const hour = Math.min(23, Math.max(0, Number(row._id?.hour) || 0));
    heatmap[day][hour].count += Number(row.count) || 0;
  }
}

async function loadTeamStats(slugParam: string): Promise<LoadTeamStatsResult> {
  await ensureAuthCollections();
  await ensureGameCollections();
  await ensureTeamCollections();

  let decodedSlug = slugParam ?? "";
  try {
    decodedSlug = decodeURIComponent(decodedSlug);
  } catch {}
  const slug = normalizeTeamSlug(decodedSlug);
  if (!slug) return { ok: false };

  const db = await getDb();
  const teams = db.collection<TeamDoc>("teams");
  const teamMembers = db.collection<TeamMemberDoc>("team_members");
  const users = db.collection<UserDoc>("users");
  const games = db.collection("games");
  const scratchGames = db.collection<ScratchGameRow>("scratch_games");
  const scratchPrizes = db.collection<ScratchPrizeRow>("scratch_prizes");

  const team = await teams.findOne({ slug });
  if (!team?._id) return { ok: false };

  const members = await teamMembers.find({ teamId: team._id }).sort({ joinedAt: 1 }).toArray();
  const memberIds = members.map((member) => member.userId);
  const enabledGames = normalizeEnabledGames(team.enabledGames);
  const heatmap = emptyHeatmap();

  const userObjectIds = memberIds.filter(ObjectId.isValid).map((id) => new ObjectId(id));
  const memberUsers = userObjectIds.length
    ? await users
        .find(
          { _id: { $in: userObjectIds }, deleted: { $ne: true } },
          { projection: { email: 1, username: 1, name: 1 } }
        )
        .toArray()
    : [];
  const userById = new Map(memberUsers.map((user) => [user._id?.toHexString() ?? "", user]));

  let blackjackMoney = 0;
  let blackjackGames = 0;
  let scratchMoney = 0;
  let scratchGameCount = 0;

  if (memberIds.length && enabledGames.includes("blackjack")) {
    const [blackjackTotals, blackjackActivity] = await Promise.all([
      games
        .aggregate<{ totalProfit: number; games: number }>([
          { $match: { uploaderId: { $in: memberIds } } },
          {
            $group: {
              _id: null,
              totalProfit: { $sum: { $ifNull: ["$profit", 0] } },
              games: { $sum: 1 },
            },
          },
        ])
        .next(),
      games
        .aggregate<ActivityAggRow>([
          { $match: { uploaderId: { $in: memberIds }, createdAt: { $type: "date" } } },
          {
            $project: {
              hour: { $hour: { date: "$createdAt", timezone: "UTC" } },
              day: { $dayOfWeek: { date: "$createdAt", timezone: "UTC" } },
            },
          },
          { $group: { _id: { day: "$day", hour: "$hour" }, count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    blackjackMoney = Number(blackjackTotals?.totalProfit) || 0;
    blackjackGames = Number(blackjackTotals?.games) || 0;
    addActivityRows(heatmap, blackjackActivity);
  }

  if (memberIds.length && enabledGames.includes("scratch")) {
    const [prizeRows, scratchRows, scratchActivity] = await Promise.all([
      scratchPrizes.find({ uploaderId: { $in: memberIds } }, { projection: { uploaderId: 1, prize: 1, value: 1 } }).toArray(),
      scratchGames.find({ uploaderId: { $in: memberIds } }, { projection: { uploaderId: 1, prizesWon: 1 } }).toArray(),
      scratchGames
        .aggregate<ActivityAggRow>([
          { $match: { uploaderId: { $in: memberIds }, archivedAt: { $type: "number" } } },
          {
            $project: {
              archivedDate: { $toDate: { $multiply: ["$archivedAt", 1000] } },
            },
          },
          {
            $project: {
              hour: { $hour: { date: "$archivedDate", timezone: "UTC" } },
              day: { $dayOfWeek: { date: "$archivedDate", timezone: "UTC" } },
            },
          },
          { $group: { _id: { day: "$day", hour: "$hour" }, count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const prizeValueByUploader = new Map<string, Map<string, number>>();
    for (const prize of prizeRows) {
      const uploaderId = String(prize.uploaderId ?? "");
      const prizeName = String(prize.prize ?? "").trim();
      if (!uploaderId || !prizeName) continue;
      const values = prizeValueByUploader.get(uploaderId) ?? new Map<string, number>();
      values.set(prizeName, Number(prize.value) || 0);
      prizeValueByUploader.set(uploaderId, values);
    }

    for (const game of scratchRows) {
      const uploaderId = String(game.uploaderId ?? "");
      const values = prizeValueByUploader.get(uploaderId);
      const prizesWon = Array.isArray(game.prizesWon) ? game.prizesWon : [];
      scratchGameCount += 1;
      for (const rawPrize of prizesWon) {
        const prizeName = String(rawPrize ?? "").trim();
        if (!prizeName) continue;
        scratchMoney += values?.get(prizeName) ?? 0;
      }
    }

    addActivityRows(heatmap, scratchActivity);
  }

  const maxActivity = Math.max(0, ...heatmap.flat().map((cell) => cell.count));
  const totalActivities = heatmap.flat().reduce((sum, cell) => sum + cell.count, 0);

  return {
    ok: true,
    team: {
      name: team.name,
      slug: team.slug,
      description: team.description ?? "",
      theme: normalizeTeamTheme(team.theme),
      accentColor: normalizeTeamAccentColor(team.accentColor),
      enabledGames,
    },
    dealerCount: members.length,
    totalMoney: blackjackMoney + scratchMoney,
    blackjackMoney,
    scratchMoney,
    blackjackGames,
    scratchGames: scratchGameCount,
    totalActivities,
    members: members.map((member) => {
      const user = userById.get(member.userId);
      return {
        name: displayUser(user),
        username: user?.username ?? null,
      };
    }),
    heatmap,
    maxActivity,
  };
}

const loadTeamStatsCached = cache(loadTeamStats);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const result = await loadTeamStatsCached(team);
  if (!result.ok) return { title: "Team Stats" };
  return { title: `${result.team.name} | Team Stats` };
}

function hexToRgb(hex: string) {
  const color = normalizeTeamAccentColor(hex).replace("#", "");
  return {
    r: Number.parseInt(color.slice(0, 2), 16),
    g: Number.parseInt(color.slice(2, 4), 16),
    b: Number.parseInt(color.slice(4, 6), 16),
  };
}

function colorWithAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function heatmapColor(count: number, max: number, accentColor: string, emptyColor: string) {
  if (!count || !max) return emptyColor;
  const intensity = 0.18 + (count / max) * 0.82;
  return colorWithAlpha(accentColor, intensity);
}

function teamPageTheme(theme: string) {
  const dark = theme === "dark";
  return {
    page: dark ? "min-h-screen bg-[#0d1117] px-4 py-10 text-zinc-100" : "min-h-screen bg-[#f5f7fb] px-4 py-10 text-zinc-950",
    shell: dark
      ? "border bg-[#151923] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
      : "border bg-white p-6 shadow-[0_20px_60px_rgba(25,30,45,0.10)]",
    label: dark ? "text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400" : "text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500",
    title: dark ? "mt-2 text-3xl font-semibold tracking-normal text-zinc-50" : "mt-2 text-3xl font-semibold tracking-normal text-zinc-950",
    body: dark ? "mt-2 max-w-2xl text-sm leading-6 text-zinc-300" : "mt-2 max-w-2xl text-sm leading-6 text-zinc-600",
    chip: dark ? "border px-3 py-1 text-xs font-medium capitalize text-zinc-100" : "border px-3 py-1 text-xs font-medium capitalize text-zinc-700",
    card: dark ? "border border-zinc-800 bg-[#10151f] p-4" : "border border-zinc-200 bg-white p-4",
    labelText: dark ? "text-xs font-medium text-zinc-400" : "text-xs font-medium text-zinc-500",
    metricText: dark ? "mt-2 text-3xl font-semibold text-zinc-50" : "mt-2 text-3xl font-semibold text-zinc-950",
    muted: dark ? "text-xs text-zinc-400" : "text-xs text-zinc-500",
    panel: dark ? "border border-zinc-800 bg-[#10151f] p-4" : "border border-zinc-200 bg-white p-4",
    panelTitle: dark ? "text-base font-semibold text-zinc-50" : "text-base font-semibold text-zinc-950",
    divider: dark ? "mt-3 divide-y divide-zinc-800 border border-zinc-800" : "mt-3 divide-y divide-zinc-100 border border-zinc-200",
    dealerName: dark ? "truncate font-medium text-zinc-50" : "truncate font-medium text-zinc-950",
    dealerMeta: dark ? "mt-1 truncate text-xs text-zinc-400" : "mt-1 truncate text-xs text-zinc-500",
    dealerButton: dark
      ? "flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-700 bg-[#151923] text-zinc-100 transition hover:bg-[#1d2533]"
      : "flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-300 bg-white text-zinc-900 transition hover:bg-zinc-50",
    emptyText: dark ? "px-3 py-3 text-sm text-zinc-400" : "px-3 py-3 text-sm text-zinc-600",
    heatmapEmpty: dark ? "#202938" : "#eef2f7",
    heatmapBorder: dark ? "#10151f" : "#ffffff",
    hourText: dark ? "text-center text-[10px] text-zinc-500" : "text-center text-[10px] text-zinc-400",
    dayText: dark ? "pr-2 text-right text-xs font-medium text-zinc-400" : "pr-2 text-right text-xs font-medium text-zinc-500",
  };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  const result = await loadTeamStatsCached(team);
  if (!result.ok) notFound();
  const accentColor = result.team.accentColor || DEFAULT_TEAM_ACCENT_COLOR;
  const pageTheme = teamPageTheme(result.team.theme);
  const accentSurface = { backgroundColor: colorWithAlpha(accentColor, result.team.theme === "dark" ? 0.16 : 0.1), borderColor: colorWithAlpha(accentColor, 0.45) };
  const accentChip = { backgroundColor: colorWithAlpha(accentColor, result.team.theme === "dark" ? 0.18 : 0.12), borderColor: colorWithAlpha(accentColor, 0.45) };

  return (
    <div className={pageTheme.page}>
      <div className="mx-auto w-full max-w-6xl">
        <div className={pageTheme.shell} style={{ borderColor: accentColor }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className={pageTheme.label}>Team</div>
              <h1 className={pageTheme.title}>{result.team.name}</h1>
              {result.team.description ? (
                <p className={pageTheme.body}>{result.team.description}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {result.team.enabledGames.map((game) => (
                <span key={game} className={pageTheme.chip} style={accentChip}>
                  {game}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="border p-4" style={accentSurface}>
              <div className={pageTheme.labelText}>Dealers</div>
              <div className={pageTheme.metricText}>{fmtInt(result.dealerCount)}</div>
            </div>
            <div className={pageTheme.card}>
              <div className={pageTheme.labelText}>Team money</div>
              <div className={pageTheme.metricText}>{fmtMoney(result.totalMoney)}</div>
              <div className={`mt-2 ${pageTheme.muted}`}>
                Blackjack {fmtMoney(result.blackjackMoney)}
                {result.team.enabledGames.includes("scratch") ? ` · Scratch ${fmtMoney(result.scratchMoney)}` : ""}
              </div>
            </div>
            <div className="border p-4" style={accentSurface}>
              <div className={pageTheme.labelText}>Tracked activity</div>
              <div className={pageTheme.metricText}>{fmtInt(result.totalActivities)}</div>
              <div className={`mt-2 ${pageTheme.muted}`}>
                {fmtInt(result.blackjackGames)} blackjack · {fmtInt(result.scratchGames)} scratch
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className={pageTheme.panel}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className={pageTheme.panelTitle}>Activity heatmap</h2>
                  <p className={`mt-1 ${pageTheme.muted}`}>Weekday and hour in UTC.</p>
                </div>
                <div className={`flex items-center gap-2 ${pageTheme.muted}`}>
                  <span>Less</span>
                  <span className="block h-3 w-3 border" style={{ background: heatmapColor(0, result.maxActivity, accentColor, pageTheme.heatmapEmpty), borderColor: colorWithAlpha(accentColor, 0.35) }} />
                  <span className="block h-3 w-3 border" style={{ background: heatmapColor(Math.ceil(result.maxActivity / 2), result.maxActivity, accentColor, pageTheme.heatmapEmpty), borderColor: colorWithAlpha(accentColor, 0.35) }} />
                  <span className="block h-3 w-3 border" style={{ background: heatmapColor(result.maxActivity, result.maxActivity, accentColor, pageTheme.heatmapEmpty), borderColor: colorWithAlpha(accentColor, 0.35) }} />
                  <span>More</span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto pb-2">
                <div className="min-w-[684px]">
                  <div className="grid items-center gap-1" style={{ gridTemplateColumns: "48px repeat(24, 22px)" }}>
                    <div />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className={pageTheme.hourText}>
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                    {result.heatmap.map((row, day) => (
                      <Fragment key={dayLabels[day]}>
                        <div key={`${dayLabels[day]}-label`} className={pageTheme.dayText}>
                          {dayLabels[day]}
                        </div>
                        {row.map((cell) => (
                          <div
                            key={`${cell.day}-${cell.hour}`}
                            className="h-[22px] w-[22px] border"
                            style={{ background: heatmapColor(cell.count, result.maxActivity, accentColor, pageTheme.heatmapEmpty), borderColor: pageTheme.heatmapBorder }}
                            title={`${dayLabels[cell.day]} ${String(cell.hour).padStart(2, "0")}:00 UTC: ${cell.count}`}
                            aria-label={`${dayLabels[cell.day]} ${cell.hour}:00 UTC activity ${cell.count}`}
                          />
                        ))}
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={pageTheme.panel}>
              <h2 className={pageTheme.panelTitle}>Dealers</h2>
              <div className={pageTheme.divider}>
                {result.members.length ? (
                  result.members.map((member) => (
                    <div key={`${member.name}-${member.username ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <div className={pageTheme.dealerName}>{member.name}</div>
                        <div className={pageTheme.dealerMeta}>{member.username ? `/${member.username}` : "No public username"}</div>
                      </div>
                      {member.username ? (
                        <a
                          href={`/${member.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${member.name} stats in a new tab`}
                          title="Open stats in new tab"
                          className={pageTheme.dealerButton}
                        >
                          <ExternalLink aria-hidden="true" size={16} strokeWidth={2} />
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className={pageTheme.emptyText}>No dealers yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <StatsFooterSection />
      </div>
    </div>
  );
}
