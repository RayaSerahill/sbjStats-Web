import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { ensureAuthCollections, ensureGameCollections, getDb, type UserDoc } from "@/lib/db";
import { playerTagToParts } from "@/lib/gameIngest";
import { DealerStats } from "./DealerStats";
import { loadDealerStats } from "@/lib/dealerStats";
import { getBackgroundStyleCss, getStatsFontFamily, getStatsStyleForUploader } from "@/lib/statsStyle";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import { StatsLayoutRenderer } from "./StatsLayoutRenderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function norm(input: unknown) {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  return s.normalize("NFKC").trim().toLowerCase();
}

function emailLocalPart(email: unknown) {
  const e = typeof email === "string" ? email : email == null ? "" : String(email);
  const at = e.indexOf("@");
  return at === -1 ? e : e.slice(0, at);
}

function normalizePlayerTag(input: string) {
  return playerTagToParts(input ?? "").playerTag;
}

function resolveCanonical(tag: string, aliasToPrimary: Map<string, string>) {
  let cur = normalizePlayerTag(tag);
  const seen = new Set<string>();
  while (aliasToPrimary.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    cur = normalizePlayerTag(aliasToPrimary.get(cur) ?? cur);
  }
  return cur;
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "+";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(abs)}`;
}

type PlayerAggRow = {
  playerTag: string;
  name: string;
  world: string;
  games: number;
  betTotal: number;
  payoutTotal: number;
  net: number;
};

export type LoadStatsPlayerRow = {
  playerTag: string;
  name: string;
  world: string;
  games: number;
  betTotal: number;
  payoutTotal: number;
  net: number;
};

export type LoadStatsDebug = {
  db: string;
  lookedFor: string;
  normalized: string;
  sampleNames: string[];
};

type StatsPageStyle = Awaited<ReturnType<typeof getStatsStyleForUploader>>;

export type LoadStatsResult =
    | { ok: false }
    | { ok: false; debug: LoadStatsDebug }
    | {
  ok: true;
  displayName: string;
  username: string;
  uploaderId: string;
  newestHostTag: string;
  roundsHosted: number;
  totalNet: number;
  dealerNet: number;
  totalBet: number;
  totalPayout: number;
  playerNet: number;
  topWinners: LoadStatsPlayerRow[];
  topLosers: LoadStatsPlayerRow[];
  topActive: LoadStatsPlayerRow[];
  totalPlayers: number;
  style: StatsPageStyle;
};


async function loadStats(displayName: string): Promise<LoadStatsResult> {
  await ensureAuthCollections();
  await ensureGameCollections();

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const games = db.collection("games");
  const aliases = db.collection("aliases");
  const blacklist = db.collection("blacklist");

  let dn = (displayName ?? "").trim();
  try {
    dn = decodeURIComponent(dn);
  } catch {
    dn = dn;
  }
  if (!dn) return { ok: false as const };

  const dnNorm = norm(dn);

  let user =
    (await users.findOne({ username: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne(
      { name: dn, deleted: { $ne: true } },
      { collation: { locale: "en", strength: 2 } }
    )) ??
    (await users.findOne({
      deleted: { $ne: true },
      $expr: {
        $eq: [
          { $toLower: { $trim: { input: { $ifNull: ["$name", ""] } } } },
          dnNorm,
        ],
      },
    })) ??
    (await users.findOne({ email: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne({
      deleted: { $ne: true },
      $expr: {
        $eq: [
          {
            $toLower: {
              $trim: {
                input: {
                  $ifNull: [
                    { $arrayElemAt: [{ $split: ["$email", "@"] }, 0] },
                    "",
                  ],
                },
              },
            },
          },
          dnNorm,
        ],
      },
    })) ??
    (await users.findOne({ name: { $regex: `^\\s*${escapeRegex(dn)}\\s*$`, $options: "i" } }));

  if (!user?._id) {
    const fallback = await users
      .find({ deleted: { $ne: true } }, { projection: { _id: 1, name: 1, email: 1, username: 1 } })
      .limit(2000)
      .toArray();
    user =
      (fallback as any[]).find((u) => norm(u?.username) === dnNorm) ??
      (fallback as any[]).find((u) => norm(u?.name) === dnNorm) ??
      (fallback as any[]).find((u) => norm(u?.email) === dnNorm) ??
      (fallback as any[]).find((u) => norm(emailLocalPart(u?.email)) === dnNorm) ??
      null;
  }

  if (!user?._id) {
    if (process.env.NODE_ENV !== "production") {
      const samples = await users
        .find({ deleted: { $ne: true } }, { projection: { name: 1 } })
        .limit(25)
        .toArray();
      return {
        ok: false as const,
        debug: {
          db: db.databaseName,
          lookedFor: dn,
          normalized: dnNorm,
          sampleNames: samples.map((s: any) => s?.name).filter(Boolean),
        },
      };
    }
    return { ok: false as const };
  }

  const uploaderId = user._id.toHexString();

  await db.collection("traffic").insertOne({
    userId: user._id,
    at: new Date()
  });

  const [
    newestGame,
    roundsHosted,
    aliasRows,
    row,
    blacklistDocs,
    style,
  ] = await Promise.all([
    games.findOne(
      { uploaderId },
      {
        sort: { createdAt: -1 },
        projection: { createdAt: 1, players: 1 },
      }
    ),
    games.countDocuments({ uploaderId }),
    aliases
      .find({ createdBy: uploaderId }, { projection: { primaryTag: 1, aliasTag: 1 } })
      .sort({ createdAt: -1 })
      .toArray(),
    games
      .aggregate<{
        totalProfit: number;
        totalBet: number;
        totalPayout: number;
      }>([
        { $match: { uploaderId } },
        {
          $group: {
            _id: null,
            totalProfit: { $sum: { $ifNull: ["$profit", 0] } },
            totalBet: { $sum: { $ifNull: ["$collected", 0] } },
            totalPayout: { $sum: { $ifNull: ["$paidOut", 0] } },
          },
        },
        { $project: { _id: 0, totalProfit: 1, totalBet: 1, totalPayout: 1 } },
      ])
      .next(),
    blacklist.find<{ playerTag: string; createdBy: string }>({ createdBy: uploaderId }).project({ playerTag: 1 }).toArray(),
    getStatsStyleForUploader(uploaderId, db),
  ]);

  const newestHostTag = (() => {
    const ps: any[] = Array.isArray((newestGame as any)?.players) ? (newestGame as any).players : [];
    const d = ps.find((p) => p && p.dealer);
    return typeof d?.playerTag === "string" && d.playerTag.trim() ? d.playerTag.trim() : "";
  })();


  const aliasToPrimary = new Map<string, string>();
  for (const r of aliasRows as any[]) {
    const a = typeof r?.aliasTag === "string" ? normalizePlayerTag(r.aliasTag) : "";
    const p = typeof r?.primaryTag === "string" ? normalizePlayerTag(r.primaryTag) : "";
    if (a && p && a !== p) aliasToPrimary.set(a, p);
  }

  const playerRows = (await games
    .aggregate<PlayerAggRow>([
      { $match: { uploaderId } },
      { $project: { players: 1 } },
      { $unwind: "$players" },
      { $match: { "players.dealer": { $ne: true } } },
      {
        $group: {
          _id: { playerTag: "$players.playerTag", gameId: "$_id" },
          name: { $first: "$players.name" },
          world: { $first: "$players.world" },
          betTotal: { $sum: { $ifNull: ["$players.bet", 0] } },
          payoutTotal: { $sum: { $ifNull: ["$players.payout", 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          playerTag: "$_id.playerTag",
          name: 1,
          world: 1,
          games: 1,
          betTotal: 1,
          payoutTotal: 1,
          net: { $subtract: ["$payoutTotal", "$betTotal"] },
        },
      },
      {
        $group: {
          _id: "$playerTag",
          name: { $first: "$name" },
          world: { $first: "$world" },
          games: { $sum: 1 },
          betTotal: { $sum: "$betTotal" },
          payoutTotal: { $sum: "$payoutTotal" },
          net: { $sum: "$net" },
        },
      },
      {
        $project: {
          _id: 0,
          playerTag: "$_id",
          name: 1,
          world: 1,
          games: 1,
          betTotal: 1,
          payoutTotal: 1,
          net: 1,
        },
      },
    ])
    .toArray()) as PlayerAggRow[];

  const byCanonical = new Map<
    string,
    {
      playerTag: string;
      name: string;
      world: string;
      games: number;
      betTotal: number;
      payoutTotal: number;
      net: number;
    }
  >();

  for (const r of playerRows) {
    const rawTag = typeof r?.playerTag === "string" ? normalizePlayerTag(r.playerTag) : "";
    if (!rawTag) continue;
    const canon = resolveCanonical(rawTag, aliasToPrimary);
    const prev = byCanonical.get(canon);

    const parts = playerTagToParts(canon);
    const baseName = parts.name || prev?.name || r.name || canon;
    const baseWorld = parts.world || prev?.world || r.world || "unknown";

    if (!prev) {
      byCanonical.set(canon, {
        playerTag: canon,
        name: baseName,
        world: baseWorld,
        games: Number(r.games) || 0,
        betTotal: Number(r.betTotal) || 0,
        payoutTotal: Number(r.payoutTotal) || 0,
        net: Number(r.net) || 0,
      });
    } else {
      prev.name = baseName;
      prev.world = baseWorld;
      prev.games += Number(r.games) || 0;
      prev.betTotal += Number(r.betTotal) || 0;
      prev.payoutTotal += Number(r.payoutTotal) || 0;
      prev.net = prev.payoutTotal - prev.betTotal;
    }
  }

  const totals = row ?? { totalProfit: 0, totalBet: 0, totalPayout: 0 };

  const mergedPlayers = Array.from(byCanonical.values());
  const totalBet = totals.totalBet;
  const totalPayout = totals.totalPayout;
  const playerNet = totalPayout - totalBet;
  const dealerNet = totals.totalProfit;

  const blacklistedTagsForUploader = new Set(blacklistDocs.map((b) => norm(b.playerTag)));
  const styleCount = style.leaderboardSize;


  const topWinners = mergedPlayers
      .filter((p) => p.net > 0 && !blacklistedTagsForUploader.has(norm(p.playerTag ?? "")))
      .sort((a, b) => b.net - a.net)
      .slice(0, styleCount);

  const topLosers = mergedPlayers
      .filter((p) => p.net < 0 && !blacklistedTagsForUploader.has(norm(p.playerTag ?? "")))
    .sort((a, b) => a.net - b.net)
    .slice(0, styleCount);

  const topActive = mergedPlayers
    .filter(p => !blacklistedTagsForUploader.has(norm(p.playerTag ?? "")))
    .slice()
    .sort((a, b) => b.games - a.games || b.betTotal - a.betTotal)
    .slice(0, styleCount);

  const totalNet = mergedPlayers.reduce(
      (sum, p) => sum + ((Number(p.payoutTotal) || 0) - (Number(p.betTotal) || 0)),
      0,
  );


  return {
    ok: true as const,
    displayName: user.name ?? user.username ?? displayName,
    username: user.username ?? "",
    uploaderId,
    newestHostTag,
    roundsHosted,
    totalNet,
    dealerNet,
    totalBet,
    totalPayout,
    playerNet,
    topWinners,
    topLosers,
    topActive,
    totalPlayers: mergedPlayers.length,
    style,
  };

}

const loadStatsCached = cache(loadStats);


export async function generateMetadata({
                                         params,
                                       }: {
  params: Promise<{ displayName: string }>;
}): Promise<Metadata> {
  const { displayName } = await params;

  const result = await loadStatsCached(displayName);
  if (!result.ok) return { title: "Stats" };

  const data = result;
  const title = `${data.displayName} | Stats`;
  return { title };
}

async function DealerStatsSection({
  uploaderId,
  pieChartColors,
  barChartProfitColor,
  barChartLossColor,
  barChartDays,
  fontColor,
  containerBackground,
  elementBackground,
}: {
  uploaderId: string;
  pieChartColors: string[];
  barChartProfitColor: string;
  barChartLossColor: string;
  barChartDays: number;
  fontColor: string;
  containerBackground: StatsPageStyle["containerBackground"];
  elementBackground: StatsPageStyle["elementBackground"];
}) {
  const dealerData = await loadDealerStats(uploaderId, barChartDays);

  return (
    <DealerStats
      rows={dealerData.rows}
      daily={dealerData.daily}
      pieChartColors={pieChartColors}
      barChartProfitColor={barChartProfitColor}
      barChartLossColor={barChartLossColor}
      barChartDays={barChartDays}
      fontColor={fontColor}
      containerBackground={containerBackground}
      elementBackground={elementBackground}
    />
  );
}

export default async function DealerStatsPage({
                                                params,
                                              }: {
  params: Promise<{ displayName: string }>;
}) {
  const { displayName } = await params;
  const result = await loadStatsCached(displayName);
  if (!result.ok) {
    const dbg = (result as any).debug;
    return (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-zinc-900">Stats lookup failed</h1>
          <p className="mt-2 text-sm text-zinc-700">
            Could not find a user for{" "}
            <span className="font-medium text-zinc-900">{String(displayName)}</span>.
          </p>

          {dbg ? (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800">
                <div><span className="font-semibold">DB:</span> {String(dbg.db)}</div>
                <div className="mt-2"><span className="font-semibold">Sample user names:</span></div>
                <div className="mt-1">{String(dbg.sampleNames ?? [])}</div>
              </div>
          ) : (
              <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800">
                No debug payload was provided by <code>loadStats()</code>.
              </div>
          )}
        </div>
    );
  }

  const data = result;
  const style = data.style;
  const fontFamily = getStatsFontFamily(style.fontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.background);
  const containerBackgroundStyle = getBackgroundStyleCss(style.containerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.elementBackground);
  return (
    <div className="container-main min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: style.fontColor, fontFamily }}>
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" style={containerBackgroundStyle}>
        <StatsLayoutRenderer
          data={{
            displayName: data.displayName,
            username: data.username,
            uploaderId: data.uploaderId,
            newestHostTag: data.newestHostTag,
            roundsHosted: data.roundsHosted,
            totalNet: data.totalNet,
            dealerNet: data.dealerNet,
            totalBet: data.totalBet,
            totalPayout: data.totalPayout,
            playerNet: data.playerNet,
            totalPlayers: data.totalPlayers,
            topWinners: data.topWinners,
            topLosers: data.topLosers,
            topActive: data.topActive,
          }}
          style={{
            fontColor: style.fontColor,
            leaderboardSize: style.leaderboardSize,
            containerBackground: style.containerBackground,
            elementBackground: style.elementBackground,
            layoutMarkdown: style.layoutMarkdown,
          }}
          dealerCharts={
            data.uploaderId ? (
              <Suspense
                fallback={(
                  <div className="rounded-2xl border border-black/10 p-4 text-sm" style={{ ...elementBackgroundStyle, color: style.fontColor }}>
                    Loading dealer stats…
                  </div>
                )}
              >
                <DealerStatsSection
                  uploaderId={data.uploaderId}
                  pieChartColors={style.pieChartColors}
                  barChartProfitColor={style.barChartProfitColor}
                  barChartLossColor={style.barChartLossColor}
                  barChartDays={style.barChartDays}
                  fontColor={style.fontColor}
                  containerBackground={style.containerBackground}
                  elementBackground={style.elementBackground}
                />
              </Suspense>
            ) : (
              <div className="rounded-2xl border border-black/10 p-4 text-sm" style={{ ...elementBackgroundStyle, color: style.fontColor }}>
                Could not resolve uploader ID for this display name.
              </div>
            )
          }
        />
      </div>
      <StatsFooterSection />
    </div>
  );
}
