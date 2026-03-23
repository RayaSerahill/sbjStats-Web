"use client";

import { useEffect, useMemo, useState } from "react";

type ScratchGameRow = {
  id: string;
  archivedAt: string;
  playerName: string;
  totalCards: number;
  wins: number;
  prizes: number;
};

type ScratchGamesResponse = {
  ok: true;
  games: ScratchGameRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

const intFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtInt(value: number) {
  return intFmt.format(Number(value) || 0);
}

function fmtDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
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

export function ScratchGames() {
  const [games, setGames] = useState<ScratchGameRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<ScratchGameRow | null>(null);
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const canPrev = page > 1;

  const buildUrl = (nextPage: number, from: string, to: string) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    return `/api/admin/scratch/games?${params.toString()}`;
  };

  const load = async (nextPage: number, filters?: { from?: string; to?: string }) => {
    const nextFrom = filters?.from ?? appliedFrom;
    const nextTo = filters?.to ?? appliedTo;

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(buildUrl(nextPage, nextFrom, nextTo), { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<ScratchGamesResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load scratch games");
      setGames(Array.isArray(data.games) ? data.games : []);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch (err: any) {
      setGames([]);
      setMessage(err?.message ?? "Failed to load scratch games");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, { from: "", to: "" });
  }, []);

  const title = useMemo(() => {
    const start = (page - 1) * 20 + 1;
    const end = start + Math.max(games.length - 1, 0);
    const base = games.length ? `Showing ${start}-${end}` : "No scratch games yet";

    if (!appliedFrom && !appliedTo) return base;
    const parts = [appliedFrom ? `from ${fmtDate(appliedFrom)}` : null, appliedTo ? `to ${fmtDate(appliedTo)}` : null].filter(Boolean);
    return `${base} · ${parts.join(" ")}`;
  }, [appliedFrom, appliedTo, games.length, page]);

  const applyFilters = async () => {
    if (fromInput && toInput && new Date(fromInput).getTime() > new Date(toInput).getTime()) {
      setMessage("Start date must be before end date");
      return;
    }

    setAppliedFrom(fromInput);
    setAppliedTo(toInput);
    await load(1, { from: fromInput, to: toInput });
  };

  const clearFilters = async () => {
    setFromInput("");
    setToInput("");
    setAppliedFrom("");
    setAppliedTo("");
    await load(1, { from: "", to: "" });
  };

  const deleteGame = async (game: ScratchGameRow) => {
    setBusyId(game.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/scratch/games/${game.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete scratch game");
      setConfirming(null);
      setMessage("Scratch game deleted permanently");
      await load(page);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to delete scratch game");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Scratch Games</h2>
          <p className="mt-1 text-sm text-zinc-600">Lists scratch archives 20 at a time. You can filter between two dates. Deleting a record does not affect any other stats.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">{title}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
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

          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => void clearFilters()}
              disabled={loading || (!fromInput && !toInput && !appliedFrom && !appliedTo)}
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

        {(appliedFrom || appliedTo) && !loading ? (
          <p className="mt-3 text-xs text-zinc-500">
            Active filter
            {appliedFrom ? ` from ${fmtDate(appliedFrom)}` : ""}
            {appliedTo ? ` to ${fmtDate(appliedTo)}` : ""}
          </p>
        ) : null}
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.25fr_1.25fr_.7fr_.7fr_.7fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
          <div>DateTime</div>
          <div>Player</div>
          <div className="text-right">cards</div>
          <div className="text-right">wins</div>
          <div className="text-right">prizes</div>
          <div className="text-right">&nbsp;</div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
        ) : games.length ? (
          <div>
            {games.map((game) => (
              <div
                key={game.id}
                className="grid grid-cols-[1.25fr_1.25fr_.7fr_.7fr_.7fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 last:border-b-0"
              >
                <div className="truncate font-medium text-zinc-900">{fmtDate(game.archivedAt)}</div>
                <div className="truncate">{game.playerName}</div>
                <div className="text-right tabular-nums">{fmtInt(game.totalCards)}</div>
                <div className="text-right tabular-nums">{fmtInt(game.wins)}</div>
                <div className="text-right tabular-nums">{fmtInt(game.prizes)}</div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirming(game)}
                    disabled={busyId === game.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Delete scratch game"
                    title="Delete scratch game"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-zinc-600">No scratch games found for this date range.</div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
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

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700">
                <TrashIcon />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Delete scratch game?</h3>
                <p className="mt-2 text-sm text-zinc-600">Are you sure? This is a permanent deletion.</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {fmtDate(confirming.archivedAt)} · {confirming.playerName} · wins {fmtInt(confirming.wins)}
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
