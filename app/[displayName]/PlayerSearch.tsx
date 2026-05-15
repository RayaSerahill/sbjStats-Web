"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

type MatchOption = {
  playerId: string;
  playerTag: string;
  name: string;
  world: string;
  aliases: string[];
};

type PlayerStatsResponse = {
  ok?: boolean;
  status?: "stats" | "matches" | "not_found";
  error?: string;
  matches?: MatchOption[];
  player?: MatchOption;
  totals?: {
    rounds: number;
    hands: number;
    wins: number;
    betTotal: number;
    payoutTotal: number;
    profit: number;
    winRate: number;
  };
  daily?: Array<{
    day: string;
    wins: number;
    profit: number;
  }>;
};

type LoadedStats = {
  player: MatchOption;
  totals: NonNullable<PlayerStatsResponse["totals"]>;
  daily: NonNullable<PlayerStatsResponse["daily"]>;
};

type PlayerSearchProps = {
  uploaderId: string;
  fontColor: string;
  headerTextColor: string;
  elementBackground: StatsBackgroundStyle;
  popupBackground: StatsBackgroundStyle;
  searchAccentColor: string;
  chartProfitColor: string;
  chartLossColor: string;
  chartTotalProfitColor: string;
};

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtMoney(n: number, signed = false) {
  const value = Number(n) || 0;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

function fmtPct(n: number) {
  return `${(Number(n) || 0).toFixed(1)}%`;
}

function hexToRgba(hex: string, alpha: number) {
  const raw = hex.replace("#", "").trim();
  const full = raw.length === 3 ? raw.split("").map((char) => char + char).join("") : raw;
  const safe = /^[0-9a-fA-F]{6}$/.test(full) ? full : "ff9fc6";
  const r = parseInt(safe.slice(0, 2), 16);
  const g = parseInt(safe.slice(2, 4), 16);
  const b = parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function PlayerSearch({
  uploaderId,
  fontColor,
  headerTextColor,
  elementBackground,
  popupBackground,
  searchAccentColor,
  chartProfitColor,
  chartLossColor,
  chartTotalProfitColor,
}: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchOption[]>([]);
  const [stats, setStats] = useState<LoadedStats | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  const elementBackgroundStyle = useMemo(() => getBackgroundStyleCss(elementBackground), [elementBackground]);
  const popupBackgroundStyle = useMemo(() => getBackgroundStyleCss(popupBackground), [popupBackground]);
  const isModalOpen = matches.length > 0 || Boolean(stats);

  const chartData = useMemo<ChartData<"bar" | "line", number[], string>>(() => {
    const rows = stats?.daily ?? [];
    let runningProfit = 0;
    const accumulatedProfit = rows.map((row) => {
      runningProfit += Number(row.profit) || 0;
      return runningProfit;
    });

    return {
      labels: rows.map((row) => row.day),
      datasets: [
        {
          type: "bar" as const,
          label: "Daily profit",
          data: rows.map((row) => row.profit),
          backgroundColor: rows.map((row) => (row.profit >= 0 ? chartProfitColor : chartLossColor)),
          borderColor: rows.map((row) => (row.profit >= 0 ? chartProfitColor : chartLossColor)),
          borderWidth: 1,
          yAxisID: "profit",
          order: 2,
        },
        {
          type: "line" as const,
          label: "Total profit",
          data: accumulatedProfit,
          borderColor: chartTotalProfitColor,
          backgroundColor: chartTotalProfitColor,
          pointBackgroundColor: chartTotalProfitColor,
          pointBorderColor: chartTotalProfitColor,
          tension: 0.25,
          yAxisID: "totalProfit",
          order: 1,
        },
      ],
    };
  }, [chartLossColor, chartProfitColor, chartTotalProfitColor, stats?.daily]);

  const chartOptions = useMemo<ChartOptions<"bar" | "line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          labels: {
            color: fontColor,
          },
        },
        tooltip: {
          enabled: true,
        },
      },
      scales: {
        x: {
          ticks: { color: fontColor, maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(148, 163, 184, 0.18)" },
        },
        profit: {
          type: "linear",
          position: "left",
          ticks: { color: fontColor },
          grid: { color: "rgba(148, 163, 184, 0.18)" },
        },
        totalProfit: {
          type: "linear",
          position: "right",
          ticks: { color: fontColor },
          grid: { drawOnChartArea: false },
        },
      },
    }),
    [fontColor]
  );

  const closeModal = () => {
    setMatches([]);
    setStats(null);
  };

  const loadStats = async (params: URLSearchParams) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/blackjack/player-search?${params.toString()}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as PlayerStatsResponse;
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "Failed to load player stats");

      if (data.status === "matches") {
        setStats(null);
        setMatches(Array.isArray(data.matches) ? data.matches : []);
        return;
      }

      if (data.status === "stats" && data.player && data.totals && Array.isArray(data.daily)) {
        setMatches([]);
        setStats({ player: data.player, totals: data.totals, daily: data.daily });
        return;
      }

      closeModal();
      setMessage("No matching player found.");
    } catch (error: unknown) {
      closeModal();
      setMessage(getErrorMessage(error, "Failed to load player stats"));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || loading) return;

    const params = new URLSearchParams({ uploaderId, q: trimmed });
    await loadStats(params);
  };

  const selectMatch = async (playerId: string) => {
    const params = new URLSearchParams({ uploaderId, playerId });
    const trimmed = query.trim();
    if (trimmed) params.set("q", trimmed);
    await loadStats(params);
  };

  return (
    <div className="mt-6">
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="blackjack-player-search">Search player</label>
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: searchAccentColor }} />
          <input
            id="blackjack-player-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search player name or tag"
            className="h-11 w-full rounded-2xl border px-10 text-sm outline-none transition"
            style={{
              ...elementBackgroundStyle,
              color: fontColor,
              caretColor: fontColor,
              accentColor: searchAccentColor,
              borderColor: searchFocused ? searchAccentColor : "rgba(0,0,0,0.10)",
              boxShadow: searchFocused ? `0 0 0 4px ${hexToRgba(searchAccentColor, 0.24)}` : undefined,
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-black/10 px-4 text-sm font-medium shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ ...elementBackgroundStyle, color: fontColor }}
        >
          {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Search aria-hidden="true" className="h-4 w-4" />}
          Search
        </button>
      </form>

      {message ? (
        <div className="mt-3 rounded-2xl border border-black/10 px-4 py-3 text-sm" style={{ ...elementBackgroundStyle, color: fontColor }}>
          {message}
        </div>
      ) : null}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={closeModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-search-dialog-title"
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-black/10 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            style={{ ...popupBackgroundStyle, color: fontColor }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="player-search-dialog-title" className="truncate text-xl font-semibold" style={{ color: headerTextColor }}>
                  {stats ? stats.player.playerTag : "Choose player"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeModal}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4"
                style={{ ...elementBackgroundStyle, color: fontColor }}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {matches.length > 0 ? (
              <div className="mt-5 space-y-2">
                {matches.map((match) => (
                  <button
                    key={match.playerId}
                    type="button"
                    onClick={() => void selectMatch(match.playerId)}
                    disabled={loading}
                    className="flex w-full items-center justify-between gap-4 rounded-2xl border border-black/10 p-3 text-left transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ ...elementBackgroundStyle, color: fontColor }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{match.playerTag}</span>
                      <span className="mt-1 block truncate text-xs opacity-75">
                        {match.aliases.length ? match.aliases.join(", ") : `${match.name}@${match.world}`}
                      </span>
                    </span>
                    {loading ? <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : null}
                  </button>
                ))}
              </div>
            ) : null}

            {stats ? (
              <div className="mt-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Total bet</div>
                    <div className="mt-1 text-lg font-semibold">{fmtMoney(stats.totals.betTotal)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Total profit</div>
                    <div className="mt-1 text-lg font-semibold">{fmtMoney(stats.totals.profit, true)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Hands won %</div>
                    <div className="mt-1 text-lg font-semibold">{fmtPct(stats.totals.winRate)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Rounds played</div>
                    <div className="mt-1 text-lg font-semibold">{fmtInt(stats.totals.rounds)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Hands played</div>
                    <div className="mt-1 text-lg font-semibold">{fmtInt(stats.totals.hands)}</div>
                  </div>
                  <div className="rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <div className="text-xs opacity-70">Wins</div>
                    <div className="mt-1 text-lg font-semibold">{fmtInt(stats.totals.wins)}</div>
                  </div>
                </div>

                {stats.daily.length > 0 ? (
                  <div className="mt-5 h-80 rounded-2xl border border-black/10 p-3" style={elementBackgroundStyle}>
                    <Chart type="bar" data={chartData} options={chartOptions} />
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-black/10 p-4 text-sm" style={elementBackgroundStyle}>
                    No recorded hands for this host.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
