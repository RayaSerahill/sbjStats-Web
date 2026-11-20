"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

type MarblesGameRow = {
  id: string;
  gameId: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  theme: string | null;
  trackThemeName: string | null;
  totalRaces: number;
  totalPlayers: number;
  totalTaken: number;
  totalPayouts: number;
  totalVenueCut: number;
  totalBoost: number;
  tournament: boolean;
  tournamentFormat: string | null;
  creatorName: string | null;
  creatorWorld: string | null;
  mine: boolean;
  hasDetail: boolean;
};

type MarblesGamesResponse = {
  ok: true;
  games: MarblesGameRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

type Filters = { from: string; to: string; mineOnly: boolean };

const NO_FILTERS: Filters = { from: "", to: "", mineOnly: false };

const intFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtInt(value: number) {
  return intFmt.format(Number(value) || 0);
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/** SimpleMarbles statuses arrive as active, completed, auto_closed. */
function statusLabel(status: string) {
  if (status === "active") return "running";
  return status.replace(/_/g, " ") || "unknown";
}

function formatLabel(game: MarblesGameRow) {
  if (!game.tournament) return "Races";
  return game.tournamentFormat ? `Tournament (${game.tournamentFormat})` : "Tournament";
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 11v6" />
    </svg>
  );
}

export function MarblesGames() {
  const [games, setGames] = useState<MarblesGameRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<MarblesGameRow | null>(null);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [mineOnlyInput, setMineOnlyInput] = useState(false);
  const [applied, setApplied] = useState<Filters>(NO_FILTERS);

  const canPrev = page > 1;

  const buildUrl = (nextPage: number, filters: Filters) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (filters.from) params.set("from", new Date(filters.from).toISOString());
    if (filters.to) params.set("to", new Date(filters.to).toISOString());
    if (filters.mineOnly) params.set("mine", "1");
    return `/api/admin/marbles/games?${params.toString()}`;
  };

  const load = async (nextPage: number, filters?: Filters) => {
    const active = filters ?? applied;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(buildUrl(nextPage, active), { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<MarblesGamesResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load marble games");
      setGames(Array.isArray(data.games) ? data.games : []);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch (err: unknown) {
      setGames([]);
      setMessage(getErrorMessage(err, "Failed to load marble games"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, NO_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title = useMemo(() => {
    const start = (page - 1) * 20 + 1;
    const end = start + Math.max(games.length - 1, 0);
    const base = games.length ? `Showing ${start}-${end}` : "No marble games yet";
    const parts = [
      applied.from ? `from ${fmtDate(applied.from)}` : null,
      applied.to ? `to ${fmtDate(applied.to)}` : null,
      applied.mineOnly ? "my games only" : null,
    ].filter(Boolean);
    return parts.length ? `${base} · ${parts.join(" ")}` : base;
  }, [applied, games.length, page]);

  const applyFilters = async () => {
    if (fromInput && toInput && new Date(fromInput).getTime() > new Date(toInput).getTime()) {
      setMessage("Start date must be before end date");
      return;
    }
    const next: Filters = { from: fromInput, to: toInput, mineOnly: mineOnlyInput };
    setApplied(next);
    await load(1, next);
  };

  const clearFilters = async () => {
    setFromInput("");
    setToInput("");
    setMineOnlyInput(false);
    setApplied(NO_FILTERS);
    await load(1, NO_FILTERS);
  };

  const deleteGame = async (game: MarblesGameRow) => {
    setBusyId(game.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/marbles/games/${game.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete marble game");
      setConfirming(null);
      setMessage("Marble game deleted permanently");
      await load(page);
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to delete marble game"));
    } finally {
      setBusyId(null);
    }
  };

  const hasAnyFilter = Boolean(fromInput || toInput || mineOnlyInput || applied.from || applied.to || applied.mineOnly);
  const gridCols = "grid-cols-[1.3fr_1.2fr_1.1fr_.5fr_.6fr_.8fr_.8fr_auto]";

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Marble Games"
        description="Lists marble games 20 at a time, newest first. Your archive also carries other dealers' games; only your own count towards your stats. Deleting a game removes its player results too."
        action={<div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">{title}</div>}
      />

      <div className="mt-6 space-y-6">
        <DashboardSection title="Filters">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">From</span>
              <input
                type="datetime-local"
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">To</span>
              <input
                type="datetime-local"
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900">
              <input
                type="checkbox"
                checked={mineOnlyInput}
                onChange={(e) => setMineOnlyInput(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span>Only my games</span>
            </label>

            <div className="flex gap-2 md:justify-end">
              <button
                type="button"
                onClick={() => void clearFilters()}
                disabled={loading || !hasAnyFilter}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => void applyFilters()}
                disabled={loading}
                className="rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Search
              </button>
            </div>
          </div>
        </DashboardSection>

        {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

        <DashboardSection title="Marble games" bodyClassName="p-0">
          <div className="overflow-x-auto bg-white">
            <div className={`grid ${gridCols} min-w-[860px] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700`}>
              <div>Started</div>
              <div>Host</div>
              <div>Format</div>
              <div className="text-right">races</div>
              <div className="text-right">players</div>
              <div className="text-right">taken</div>
              <div className="text-right">payouts</div>
              <div className="text-right">&nbsp;</div>
            </div>

            {loading ? (
              <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
            ) : games.length ? (
              <div>
                {games.map((game) => (
                  <div
                    key={game.id}
                    className={`grid ${gridCols} min-w-[860px] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 last:border-b-0`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900">{fmtDate(game.startedAt)}</div>
                      <div className="truncate text-xs text-zinc-500">
                        #{game.gameId} · {statusLabel(game.status)}
                        {game.hasDetail ? "" : " · summary only"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{game.creatorName ?? "—"}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {game.creatorWorld ? `${game.creatorWorld} · ` : ""}
                        {game.mine ? "your game" : "another dealer"}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate">{formatLabel(game)}</div>
                      <div className="truncate text-xs text-zinc-500">{game.trackThemeName ?? game.theme ?? "no track theme"}</div>
                    </div>
                    <div className="text-right tabular-nums">{fmtInt(game.totalRaces)}</div>
                    <div className="text-right tabular-nums">{fmtInt(game.totalPlayers)}</div>
                    <div className="text-right tabular-nums">{fmtInt(game.totalTaken)}</div>
                    <div className="text-right tabular-nums">{fmtInt(game.totalPayouts)}</div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setConfirming(game)}
                        disabled={busyId === game.id}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label="Delete marble game"
                        title="Delete marble game"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-zinc-600">No marble games found for these filters.</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
            <button
              type="button"
              onClick={() => void load(page - 1)}
              disabled={loading || !canPrev}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <div className="text-xs text-zinc-500">Page {page}</div>

            <button
              type="button"
              onClick={() => void load(page + 1)}
              disabled={loading || !hasMore}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </DashboardSection>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <TrashIcon />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Delete marble game?</h3>
                <p className="mt-2 text-sm text-zinc-600">
                  Are you sure? This is a permanent deletion, and the game&apos;s player results go with it. Re-uploading the archive will bring it back.
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {fmtDate(confirming.startedAt)} · #{confirming.gameId} · {confirming.creatorName ?? "unknown host"} · {formatLabel(confirming)} · races{" "}
                  {fmtInt(confirming.totalRaces)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={busyId === confirming.id}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteGame(confirming)}
                disabled={busyId === confirming.id}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500 disabled:opacity-60"
              >
                {busyId === confirming.id ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
