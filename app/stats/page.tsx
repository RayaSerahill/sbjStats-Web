import type { Metadata } from "next";
import { ensureAuthCollections, ensureGameCollections, getDb } from "@/lib/db";
import { DEFAULT_STATS_STYLE, getBackgroundStyleCss, getStatsFontFamily } from "@/lib/statsStyle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Global Stats",
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

async function loadGlobalStats() {
  await ensureAuthCollections();
  await ensureGameCollections();

  const db = await getDb();
  const users = db.collection("users");
  const players = db.collection("players");
  const games = db.collection("games");

  const [hosts, uniquePlayers, roundsHosted, totalsRaw] = await Promise.all([
    users.countDocuments({ deleted: { $ne: true } }),
    players.countDocuments({}),
    games.countDocuments({}),
    games
      .aggregate([
        {
          $group: {
            _id: null,
            totalCollected: { $sum: { $toDouble: { $ifNull: ["$collected", 0] } } },
            totalPaidOut: { $sum: { $toDouble: { $ifNull: ["$paidOut", 0] } } },
            totalProfit: { $sum: { $toDouble: { $ifNull: ["$profit", 0] } } },
          },
        },
      ])
      .toArray(),
  ]);

  const totals = totalsRaw[0] ?? {
    totalCollected: 0,
    totalPaidOut: 0,
    totalProfit: 0,
  };

  return {
    hosts,
    uniquePlayers,
    roundsHosted,
    totalCollected: Number(totals.totalCollected) || 0,
    totalPaidOut: Number(totals.totalPaidOut) || 0,
    totalProfit: Number(totals.totalProfit) || 0,
  };
}

export default async function StatsOverviewPage() {
  const data = await loadGlobalStats();
  const style = DEFAULT_STATS_STYLE;
  const fontFamily = getStatsFontFamily(style.fontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.background);
  const containerBackgroundStyle = getBackgroundStyleCss(style.containerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.elementBackground);

  return (
    <div className="min-h-screen w-full px-4 py-10" style={{ ...pageBackgroundStyle, color: style.fontColor, fontFamily }}>
      <div
        className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        style={containerBackgroundStyle}
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold" style={{ color: style.fontColor }}>Global stats</h1>
          <p className="text-sm" style={{ color: style.fontColor }}>
            Overview of all uploaded stats across every host.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Hosts</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtInt(data.hosts)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Unique players</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtInt(data.uniquePlayers)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Rounds hosted</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtInt(data.roundsHosted)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Total gil collected</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtMoney(data.totalCollected)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
              Sum of collected across all games
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Total gil paid out</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtMoney(data.totalPaidOut)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
              Sum of paid out across all games
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
            <div className="text-xs font-medium opacity-70" style={{ color: style.fontColor }}>Total gil profit</div>
            <div className="mt-2 text-2xl font-semibold" style={{ color: style.fontColor }}>{fmtMoney(data.totalProfit)}</div>
            <div className="mt-1 text-xs opacity-70" style={{ color: style.fontColor }}>
              Sum of profit across all games
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
