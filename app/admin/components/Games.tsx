"use client";

import { useEffect, useMemo, useState } from "react";

type GameRow = {
    id: string;
    createdAt: string;
    profit: number;
    collected: number;
    paidOut: number;
};

type GamesResponse = {
    ok: true;
    games: GameRow[];
    page: number;
    pageSize: number;
    hasMore: boolean;
};

const moneyFmt = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

function fmtMoney(value: number) {
    return moneyFmt.format(Number(value) || 0);
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

export function Games() {
    const [games, setGames] = useState<GameRow[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [confirming, setConfirming] = useState<GameRow | null>(null);

    const canPrev = page > 1;

    const load = async (nextPage: number) => {
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/games?page=${nextPage}`, { cache: "no-store" });
            const data = (await res.json().catch(() => ({}))) as Partial<GamesResponse> & { error?: string };
            if (!res.ok) throw new Error(data?.error ?? "Failed to load games");
            setGames(Array.isArray(data.games) ? data.games : []);
            setPage(typeof data.page === "number" ? data.page : nextPage);
            setHasMore(Boolean(data.hasMore));
        } catch (err: any) {
            setGames([]);
            setMessage(err?.message ?? "Failed to load games");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void load(1);
    }, []);

    const title = useMemo(() => {
        const start = (page - 1) * 20 + 1;
        const end = start + Math.max(games.length - 1, 0);
        return games.length ? `Showing ${start}-${end}` : "No games yet";
    }, [games.length, page]);

    const deleteGame = async (game: GameRow) => {
        setBusyId(game.id);
        setMessage(null);
        try {
            const res = await fetch(`/api/admin/games/${game.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error ?? "Failed to delete game");
            setConfirming(null);
            setMessage("Game deleted permanently");
            await load(page);
        } catch (err: any) {
            setMessage(err?.message ?? "Failed to delete game");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="rounded-3xl cute-border admin-item-container">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-zinc-900">Games</h2>
                    <p className="mt-1 text-sm text-zinc-600">Lists your imported games 20 at a time. Deleting a game updates related stats.</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">{title}</div>
            </div>

            {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

            <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                <div className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                    <div>DateTime</div>
                    <div className="text-right">profit</div>
                    <div className="text-right">collected</div>
                    <div className="text-right">paid out</div>
                    <div className="text-right">&nbsp;</div>
                </div>

                {loading ? (
                    <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
                ) : games.length ? (
                    <div>
                        {games.map((game) => (
                            <div
                                key={game.id}
                                className="grid grid-cols-[1.6fr_.8fr_.8fr_.8fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 last:border-b-0"
                            >
                                <div className="truncate font-medium text-zinc-900">{fmtDate(game.createdAt)}</div>
                                <div className="text-right tabular-nums">{fmtMoney(game.profit)}</div>
                                <div className="text-right tabular-nums">{fmtMoney(game.collected)}</div>
                                <div className="text-right tabular-nums">{fmtMoney(game.paidOut)}</div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setConfirming(game)}
                                        disabled={busyId === game.id}
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                                        aria-label="Delete game"
                                        title="Delete game"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="px-3 py-4 text-sm text-zinc-600">No games imported yet.</div>
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
                                <h3 className="text-lg font-semibold text-zinc-900">Delete game?</h3>
                                <p className="mt-2 text-sm text-zinc-600">Are you sure? This is a permanent deletion.</p>
                                <p className="mt-2 text-xs text-zinc-500">{fmtDate(confirming.createdAt)} · profit {fmtMoney(confirming.profit)}</p>
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
