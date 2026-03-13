import type { Metadata } from "next";
import { ensureAuthCollections, ensureGameCollections, getDb, type UserDoc } from "@/lib/db";
import { playerTagToParts } from "@/lib/gameIngest";
import { DealerStats } from "./DealerStats";
import { getBackgroundStyleCss, getStatsFontFamily, getStatsStyleForUploader } from "@/lib/statsStyle";

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
    (await users.findOne({ username: dnNorm })) ??
    (await users.findOne(
      { name: dn },
      { collation: { locale: "en", strength: 2 } }
    )) ??
    (await users.findOne({
      $expr: {
        $eq: [
          { $toLower: { $trim: { input: { $ifNull: ["$name", ""] } } } },
          dnNorm,
        ],
      },
    })) ??
    (await users.findOne({ email: dnNorm })) ??
    (await users.findOne({
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
      .find({}, { projection: { _id: 1, name: 1, email: 1, username: 1 } })
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
        .find({}, { projection: { name: 1 } })
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

  const newestGame = await games.findOne(
    { uploaderId },
    {
      sort: { createdAt: -1 },
      projection: { createdAt: 1, players: 1 },
    }
  );

  const newestHostTag = (() => {
    const ps: any[] = Array.isArray((newestGame as any)?.players) ? (newestGame as any).players : [];
    const d = ps.find((p) => p && p.dealer);
    return typeof d?.playerTag === "string" && d.playerTag.trim() ? d.playerTag.trim() : "";
  })();

  const roundsHosted = await games.countDocuments({ uploaderId });

  const aliasRows = await aliases
    .find({}, { projection: { primaryTag: 1, aliasTag: 1 } })
    .sort({ createdAt: -1 })
    .toArray();

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

  const row = await games
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
      .next();

  const totals = row ?? { totalProfit: 0, totalBet: 0, totalPayout: 0 };

  const mergedPlayers = Array.from(byCanonical.values());
  const totalBet = totals.totalBet;
  const totalPayout = totals.totalPayout;
  const playerNet = totalPayout - totalBet;
  const dealerNet = totals.totalProfit;

  type BlacklistDoc = { playerTag: string; createdBy: string };

  const blacklistDocs = await blacklist
      .find<BlacklistDoc>({ createdBy: uploaderId })
      .project({ playerTag: 1 })
      .toArray();

  const blacklistedTagsForUploader = new Set(blacklistDocs.map((b) => norm(b.playerTag)));

  const style = await getStatsStyleForUploader(uploaderId, db);
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
  };

}

export async function generateMetadata({
                                         params,
                                       }: {
  params: Promise<{ displayName: string }>;
}): Promise<Metadata> {
  const { displayName } = await params;

  const result = await loadStats(displayName);
  if (!result.ok) return { title: "Stats" };

  const data = result;
  const title = `${data.displayName} | Stats`;
  return { title };
}

export default async function DealerStatsPage({
                                                params,
                                              }: {
  params: Promise<{ displayName: string }>;
}) {
  const { displayName } = await params;
  const result = await loadStats(displayName);
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
  const style = await getStatsStyleForUploader(data.uploaderId);
  const fontFamily = getStatsFontFamily(style.fontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.background);
  const containerBackgroundStyle = getBackgroundStyleCss(style.containerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.elementBackground);
  const title = data.displayName;
  console.log(data);

  return (
    <div className="min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: style.fontColor, fontFamily }}>
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" style={containerBackgroundStyle}>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" style={{ color: style.fontColor }}>{title}</h1>
          <p className="text-sm" style={{ color: style.fontColor }}>
            Stats for uploader{" "}
            <span className="font-medium" style={{ color: style.fontColor }}>
              {data.username || data.displayName}
            </span>
            {data.totalPlayers ? (
                <>
                  {" "}• {fmtInt(data.totalPlayers)} players
                </>
            ) : null}
          </p>

        </div>

        {data.roundsHosted === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm" style={{ ...containerBackgroundStyle, color: style.fontColor }}>
            No rounds uploaded yet.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Rounds hosted</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtInt(data.roundsHosted)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Profit / loss (dealer)</div>
                <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtMoney(data.dealerNet)}</div>
                <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>Players net: {fmtMoney(data.playerNet)}</div>
              </div>
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Volume</div>
                <div className="mt-2 text-sm" style={{ color: style.fontColor }}>
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: style.fontColor, opacity: 0.75 }}>Total bet</span>
                    <span className="font-medium" style={{ color: style.fontColor }}>{fmtInt(data.totalBet)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span style={{ color: style.fontColor, opacity: 0.75 }}>Total payout</span>
                    <span className="font-medium" style={{ color: style.fontColor }}>{fmtInt(data.totalPayout)}</span>
                  </div>
                </div>
              </div>
            </div>


            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold" style={{ color: style.fontColor }}>Top {style.leaderboardSize} winners</h2>
                  <span className="text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>by net</span>
                </div>
                <ol className="mt-3 space-y-2 text-sm" style={{ color: style.fontColor }}>
                  {data.topWinners.length ? (
                      data.topWinners.map((p, idx) => (
                          <li key={p.name} className="flex items-center justify-between gap-3">
                        <span className="truncate" style={{ color: style.fontColor }}>
                          <span className="mr-2 text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>#{idx + 1}</span>
                          <span className="font-medium" style={{ color: style.fontColor }}>{p.playerTag}</span>
                        </span>
                            <span className="shrink-0 font-medium" style={{ color: style.fontColor }}>{fmtMoney(p.net)}</span>
                          </li>
                      ))
                  ) : (
                      <li style={{ color: style.fontColor, opacity: 0.75 }}>No winners yet.</li>
                  )}
                </ol>
              </div>

              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold" style={{ color: style.fontColor }}>Top {style.leaderboardSize} losers</h2>
                  <span className="text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>by net</span>
                </div>
                <ol className="mt-3 space-y-2 text-sm" style={{ color: style.fontColor }}>
                  {data.topLosers.length ? (
                      data.topLosers.map((p, idx) => (
                          <li key={p.name} className="flex items-center justify-between gap-3">
                        <span className="truncate" style={{ color: style.fontColor }}>
                          <span className="mr-2 text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>#{idx + 1}</span>
                          <span className="font-medium" style={{ color: style.fontColor }}>{p.playerTag}</span>
                        </span>
                            <span className="shrink-0 font-medium" style={{ color: style.fontColor }}>{fmtMoney(p.net)}</span>
                          </li>
                      ))
                  ) : (
                      <li style={{ color: style.fontColor, opacity: 0.75 }}>No losers yet.</li>
                  )}
                </ol>
              </div>

              <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold" style={{ color: style.fontColor }}>Top {style.leaderboardSize} most active</h2>
                  <span className="text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>by games</span>
                </div>
                <ol className="mt-3 space-y-2 text-sm" style={{ color: style.fontColor }}>
                  {data.topActive.length ? (
                      data.topActive.map((p, idx) => (
                          <li key={p.name} className="flex items-center justify-between gap-3">
                        <span className="truncate" style={{ color: style.fontColor }}>
                          <span className="mr-2 text-xs" style={{ color: style.fontColor, opacity: 0.7 }}>#{idx + 1}</span>
                          <span className="font-medium" style={{ color: style.fontColor }}>{p.playerTag}</span>
                        </span>
                            <span className="shrink-0 font-medium" style={{ color: style.fontColor }}>{fmtInt(p.games)}</span>
                          </li>
                      ))
                  ) : (
                      <li style={{ color: style.fontColor, opacity: 0.75 }}>No players yet.</li>
                  )}
                </ol>
              </div>
            </div>

            {data.uploaderId ? (
                <DealerStats
                  uploaderId={data.uploaderId}
                  pieChartColors={style.pieChartColors}
                  barChartProfitColor={style.barChartProfitColor}
                  barChartLossColor={style.barChartLossColor}
                  barChartDays={style.barChartDays}
                  fontColor={style.fontColor}
                  containerBackground={style.containerBackground}
                  elementBackground={style.elementBackground}
                />
            ) : (
                <div className="mt-6 rounded-2xl border border-black/10 p-4 text-sm" style={{ ...elementBackgroundStyle, color: style.fontColor }}>
                  Could not resolve uploader ID for this display name.
                </div>
            )}


            <div className="mt-6 rounded-2xl border border-black/10 p-4 text-xs shadow-[0_0_0_1px_rgba(0,0,0,0.04)]" style={{ ...elementBackgroundStyle, color: style.fontColor }}>
              Stats are usually updated after each hosting session.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
