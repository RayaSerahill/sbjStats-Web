"use client";

import { useEffect, useMemo, useState } from "react";

type BlacklistRow = {
  id: string;
  playerTag: string;
  createdAt?: string;
  createdBy?: string;
};

export function HiddenPlayers() {
  const [playerTag, setPlayerTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<BlacklistRow[]>([]);

  const sorted = useMemo(() => rows.slice().sort((a, b) => a.playerTag.localeCompare(b.playerTag)), [rows]);

  const refresh = async () => {
    const res = await fetch("/api/admin/blacklist", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Failed to load hidden players");
    setRows(Array.isArray(data?.blacklist) ? data.blacklist : []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (e: any) {
        setMessage(e?.message ?? "Failed to load hidden players");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="section section-hidden-players mt-6 cute-border admin-item-container">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">Hidden players</h2>
        <p className="text-xs text-zinc-600">Players who won't be shown in leaderboards</p>
      </div>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage(null);
          setBusy(true);
          try {
            const res = await fetch("/api/admin/blacklist", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ playerTag }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error ?? "Failed to hide player");
            setPlayerTag("");
            await refresh();
            setMessage("Player hidden");
          } catch (err: any) {
            setMessage(err?.message ?? "Failed to hide player");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label className="block text-xs font-medium text-zinc-800">Player Name</label>
          <input
            value={playerTag}
            onChange={(e) => setPlayerTag(e.target.value)}
            placeholder="Raya Serahill@Sagittarius"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !playerTag.trim()}
          className="h-10 rounded-xl bg-[#FF9FC6] px-4 text-sm font-medium text-zinc-900 shadow-[0_12px_28px_rgba(255,159,198,0.40)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Hide"}
        </button>
      </form>

      {message ? <p className="mt-3 text-xs text-zinc-700">{message}</p> : null}

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Hidden list</h3>
          <button
            type="button"
            onClick={async () => {
              setMessage(null);
              setLoading(true);
              try {
                await refresh();
              } catch (e: any) {
                setMessage(e?.message ?? "Failed to load hidden players");
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-xl border border-[#FF9FC6]/35 bg-white px-3 py-2 text-xs font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(255,159,198,0.10)] transition hover:bg-[#FF9FC6]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/25 hover:cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_auto] gap-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
            <div>Player Name</div>
            <div className="text-right">&nbsp;</div>
          </div>

          {loading ? (
            <div className="px-3 py-3 text-xs text-zinc-600">Loading…</div>
          ) : sorted.length ? (
            <div>
              {sorted.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-xs text-zinc-800 last:border-b-0">
                  <div className="truncate font-medium text-zinc-900">{r.playerTag}</div>
                  <button
                    type="button"
                    onClick={async () => {
                      setMessage(null);
                      setBusy(true);
                      try {
                        const res = await fetch(`/api/admin/blacklist/${r.id}`, { method: "DELETE" });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error ?? "Failed to remove");
                        await refresh();
                      } catch (e: any) {
                        setMessage(e?.message ?? "Failed to remove");
                      } finally {
                        setBusy(false);
                      }
                    }}
                    disabled={busy}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/25 disabled:cursor-not-allowed disabled:opacity-60 hover:cursor-pointer"
                  >
                    Unhide
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-zinc-600">No hidden players yet.</div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-xs text-zinc-700">
        Only affects leaderboards, they are still searchable and contribute to host stats.
      </div>
    </div>
  );
}
