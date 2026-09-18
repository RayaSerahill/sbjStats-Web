"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

type PrizeRow = {
  prize: string;
  count: number;
  value: number | null;
  autoValue: number | null;
  autoSource: "preset" | "label" | null;
  autoPreset: string | null;
  effectiveValue: number;
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

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function autoHint(row: PrizeRow) {
  if (row.autoValue === null) return "no automatic value";
  if (row.autoSource === "preset") return `${fmtInt(row.autoValue)} from preset${row.autoPreset ? ` "${row.autoPreset}"` : ""}`;
  return `${fmtInt(row.autoValue)} from label`;
}

export function WheelPrizes() {
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
      const res = await fetch("/api/admin/wheel/prizes", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<PrizesResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load wheel prizes");
      const prizes = Array.isArray(data.prizes) ? data.prizes : [];
      setRows(prizes as PrizeRow[]);

      const nextDraft: Record<string, string> = {};
      for (const p of prizes) {
        nextDraft[p.prize] = p.value === null || p.value === undefined ? "" : String(p.value);
      }
      setDraft(nextDraft);
    } catch (err: unknown) {
      setRows([]);
      setMessage(getErrorMessage(err, "Failed to load wheel prizes"));
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

  const currentOf = (r: PrizeRow) => (r.value === null || r.value === undefined ? "" : String(r.value));

  const dirtyCount = useMemo(() => rows.filter((r) => currentOf(r) !== (draft[r.prize] ?? "")).length, [draft, rows]);

  const saveUpdates = async (updates: Array<{ prize: string; value: number | null }>) => {
    if (!updates.length) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/wheel/prizes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save wheel prizes");
      setMessage("Saved");
      await load();
    } catch (err: unknown) {
      setMessage(getErrorMessage(err, "Failed to save wheel prizes"));
    } finally {
      setSaving(false);
    }
  };

  const toUpdate = (r: PrizeRow): { prize: string; value: number | null } | null | "invalid" => {
    const d = (draft[r.prize] ?? "").trim();
    if (d === currentOf(r)) return null;
    if (!d) return { prize: r.prize, value: null };
    const num = Number(d);
    if (!Number.isFinite(num)) return "invalid";
    return { prize: r.prize, value: num };
  };

  const saveAll = async () => {
    const updates: Array<{ prize: string; value: number | null }> = [];
    for (const r of rows) {
      const u = toUpdate(r);
      if (u && u !== "invalid") updates.push(u);
    }
    await saveUpdates(updates);
  };

  const saveOne = async (prize: string) => {
    const row = rows.find((r) => r.prize === prize);
    if (!row) return;
    const u = toUpdate(row);
    if (u === "invalid") {
      setMessage("Value must be a number");
      return;
    }
    if (u) await saveUpdates([u]);
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Wheel Prizes"
        description="Prize labels your uploaded presets cannot put a gil value on: multipliers, mounts, free spins and the like. Give them a value here so they count on the public page. Labels a preset already prices are handled automatically and stay out of this list."
        action={
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
            {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "All saved"}
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <DashboardSection title="Filters">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
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
        </DashboardSection>

        {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

        <DashboardSection title="Prize values" bodyClassName="p-0">
          <div className="overflow-hidden bg-white">
            <div className="grid grid-cols-[1.4fr_.5fr_.9fr_.9fr_1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
              <div>Prize</div>
              <div className="text-right">won</div>
              <div className="text-right">effective</div>
              <div className="text-right">override</div>
              <div className="text-right">updated</div>
              <div className="text-right">&nbsp;</div>
            </div>

            {loading ? (
              <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
            ) : filtered.length ? (
              <div>
                {filtered.map((r) => {
                  const d = draft[r.prize] ?? "";
                  const isDirty = currentOf(r) !== d;

                  return (
                    <div
                      key={r.prize}
                      className="grid grid-cols-[1.4fr_.5fr_.9fr_.9fr_1fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-zinc-900" title={r.prize}>
                          {r.prize}
                        </div>
                        <div className="truncate text-xs text-zinc-500">{autoHint(r)}</div>
                      </div>
                      <div className="text-right tabular-nums text-zinc-700">{fmtInt(r.count)}</div>
                      <div className="text-right tabular-nums text-zinc-900">{fmtInt(r.effectiveValue)}</div>
                      <div className="text-right">
                        <input
                          value={d}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [r.prize]: e.target.value }))}
                          inputMode="decimal"
                          placeholder={r.autoValue === null ? "0" : "auto"}
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
        </DashboardSection>
      </div>
    </div>
  );
}
