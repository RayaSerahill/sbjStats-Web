"use client";

import { useEffect, useMemo, useState } from "react";

type PrizeRow = {
  prize: string;
  count: number;
  value: number | null;
  updatedAt: string | null;
};

type PrizesResponse = {
  ok: true;
  prizes: PrizeRow[];
};

const intFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtInt(value: number) {
  return intFmt.format(Number(value) || 0);
}

function fmtDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function ScratchPrizes() {
  const [rows, setRows] = useState<PrizeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/scratch/prizes", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<PrizesResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load scratch prizes");
      const prizes = Array.isArray(data.prizes) ? data.prizes : [];
      setRows(prizes as PrizeRow[]);

      const nextDraft: Record<string, string> = {};
      for (const p of prizes) {
        nextDraft[p.prize] = p.value === null || p.value === undefined ? "" : String(p.value);
      }
      setDraft(nextDraft);
    } catch (err: any) {
      setRows([]);
      setMessage(err?.message ?? "Failed to load scratch prizes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.prize.toLowerCase().includes(q));
  }, [query, rows]);

  const dirtyCount = useMemo(() => {
    let dirty = 0;
    for (const r of rows) {
      const current = r.value === null || r.value === undefined ? "" : String(r.value);
      const d = draft[r.prize] ?? "";
      if (current !== d) dirty += 1;
    }
    return dirty;
  }, [draft, rows]);

  const saveUpdates = async (updates: Array<{ prize: string; value: number | null }>) => {
    if (!updates.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/scratch/prizes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save scratch prizes");
      setMessage("Saved");
      await load();
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to save scratch prizes");
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async () => {
    const updates: Array<{ prize: string; value: number | null }> = [];
    for (const r of rows) {
      const d = (draft[r.prize] ?? "").trim();
      const current = r.value === null || r.value === undefined ? "" : String(r.value);
      if (d === current) continue;
      if (!d) {
        updates.push({ prize: r.prize, value: null });
        continue;
      }
      const num = Number(d);
      if (!Number.isFinite(num)) continue;
      updates.push({ prize: r.prize, value: num });
    }
    await saveUpdates(updates);
  };

  const saveOne = async (prize: string) => {
    const row = rows.find((r) => r.prize === prize);
    if (!row) return;
    const d = (draft[prize] ?? "").trim();
    const current = row.value === null || row.value === undefined ? "" : String(row.value);
    if (d === current) return;

    if (!d) {
      await saveUpdates([{ prize, value: null }]);
      return;
    }

    const num = Number(d);
    if (!Number.isFinite(num)) {
      setMessage("Value must be a number");
      return;
    }
    await saveUpdates([{ prize, value: num }]);
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Scratch Prizes</h2>
          <p className="mt-1 text-sm text-zinc-600">All unique prizes seen in scratch archives. Assign a numeric value to each prize for later calculations.</p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
            {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "All saved"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Search prizes</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </label>
        </div>

        <div className="flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void saveAll()}
            disabled={loading || saving || dirtyCount === 0}
            className="rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save all"}
          </button>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.6fr_.6fr_.8fr_1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
          <div>Prize</div>
          <div className="text-right">won</div>
          <div className="text-right">value</div>
          <div className="text-right">updated</div>
          <div className="text-right">&nbsp;</div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
        ) : filtered.length ? (
          <div>
            {filtered.map((r) => {
              const current = r.value === null || r.value === undefined ? "" : String(r.value);
              const d = draft[r.prize] ?? "";
              const isDirty = current !== d;

              return (
                <div
                  key={r.prize}
                  className="grid grid-cols-[1.6fr_.6fr_.8fr_1fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 last:border-b-0"
                >
                  <div className="truncate font-medium text-zinc-900" title={r.prize}>
                    {r.prize}
                  </div>
                  <div className="text-right tabular-nums text-zinc-700">{fmtInt(r.count)}</div>
                  <div className="text-right">
                    <input
                      value={d}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [r.prize]: e.target.value }))}
                      inputMode="decimal"
                      placeholder="0"
                      className={[
                        "w-full max-w-[160px] rounded-xl border bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400",
                        isDirty ? "border-amber-300" : "border-zinc-300",
                      ].join(" ")}
                    />
                  </div>
                  <div className="text-right text-xs text-zinc-500">{fmtDate(r.updatedAt)}</div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void saveOne(r.prize)}
                      disabled={saving || !isDirty}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Save
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-zinc-600">No prizes found.</div>
        )}
      </div>
    </div>
  );
}
