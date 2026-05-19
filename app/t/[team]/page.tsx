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
import { normalizeEnabledGames, normalizeTeamSlug } from "@/lib/teams";
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

function heatmapColor(count: number, max: number) {
  if (!count || !max) return "#eef2f7";
  const intensity = 0.18 + (count / max) * 0.82;
  return `rgba(20, 132, 93, ${intensity.toFixed(2)})`;
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ team: string }>;
}) {
  const { team } = await params;
  const result = await loadTeamStatsCached(team);
  if (!result.ok) notFound();

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10 text-zinc-950">
      <div className="mx-auto w-full max-w-6xl">
        <div className="border border-[#FF9FC6] bg-white p-6 shadow-[0_20px_60px_rgba(25,30,45,0.10)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Team</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950">{result.team.name}</h1>
              <div className="mt-2 text-sm text-zinc-600">/t/{result.team.slug}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.team.enabledGames.map((game) => (
                <span key={game} className="border border-zinc-200 bg-[#fff7fb] px-3 py-1 text-xs font-medium capitalize text-zinc-700">
                  {game}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="border border-zinc-200 bg-[#fff7fb] p-4">
              <div className="text-xs font-medium text-zinc-500">Dealers</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-950">{fmtInt(result.dealerCount)}</div>
            </div>
            <div className="border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">Team money</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-950">{fmtMoney(result.totalMoney)}</div>
              <div className="mt-2 text-xs text-zinc-500">
                Blackjack {fmtMoney(result.blackjackMoney)}
                {result.team.enabledGames.includes("scratch") ? ` · Scratch ${fmtMoney(result.scratchMoney)}` : ""}
              </div>
            </div>
            <div className="border border-zinc-200 bg-[#f2fbf6] p-4">
              <div className="text-xs font-medium text-zinc-500">Tracked activity</div>
              <div className="mt-2 text-3xl font-semibold text-zinc-950">{fmtInt(result.totalActivities)}</div>
              <div className="mt-2 text-xs text-zinc-500">
                {fmtInt(result.blackjackGames)} blackjack · {fmtInt(result.scratchGames)} scratch
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="border border-zinc-200 bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-zinc-950">Activity heatmap</h2>
                  <p className="mt-1 text-xs text-zinc-500">Weekday and hour in UTC.</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>Less</span>
                  <span className="block h-3 w-3 border border-zinc-200" style={{ background: heatmapColor(0, result.maxActivity) }} />
                  <span className="block h-3 w-3 border border-zinc-200" style={{ background: heatmapColor(Math.ceil(result.maxActivity / 2), result.maxActivity) }} />
                  <span className="block h-3 w-3 border border-zinc-200" style={{ background: heatmapColor(result.maxActivity, result.maxActivity) }} />
                  <span>More</span>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto pb-2">
                <div className="min-w-[684px]">
                  <div className="grid items-center gap-1" style={{ gridTemplateColumns: "48px repeat(24, 22px)" }}>
                    <div />
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div key={hour} className="text-center text-[10px] text-zinc-400">
                        {hour % 3 === 0 ? hour : ""}
                      </div>
                    ))}
                    {result.heatmap.map((row, day) => (
                      <Fragment key={dayLabels[day]}>
                        <div key={`${dayLabels[day]}-label`} className="pr-2 text-right text-xs font-medium text-zinc-500">
                          {dayLabels[day]}
                        </div>
                        {row.map((cell) => (
                          <div
                            key={`${cell.day}-${cell.hour}`}
                            className="h-[22px] w-[22px] border border-white"
                            style={{ background: heatmapColor(cell.count, result.maxActivity) }}
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

            <div className="border border-zinc-200 bg-white p-4">
              <h2 className="text-base font-semibold text-zinc-950">Dealers</h2>
              <div className="mt-3 divide-y divide-zinc-100 border border-zinc-200">
                {result.members.length ? (
                  result.members.map((member) => (
                    <div key={`${member.name}-${member.username ?? ""}`} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-950">{member.name}</div>
                        <div className="mt-1 truncate text-xs text-zinc-500">{member.username ? `/${member.username}` : "No public username"}</div>
                      </div>
                      {member.username ? (
                        <a
                          href={`/${member.username}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${member.name} stats in a new tab`}
                          title="Open stats in new tab"
                          className="flex h-9 w-9 shrink-0 items-center justify-center border border-zinc-300 bg-white text-zinc-900 transition hover:bg-zinc-50"
                        >
                          <ExternalLink aria-hidden="true" size={16} strokeWidth={2} />
                        </a>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-zinc-600">No dealers yet.</div>
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
