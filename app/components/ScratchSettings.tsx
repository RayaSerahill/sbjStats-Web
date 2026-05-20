"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

type DealerRow = {
  name: string;
  games: number;
  enabled: boolean;
};

type ScratchSettingsResponse = {
  ok: true;
  dealers: DealerRow[];
  visibleDealers: string[];
  updatedAt: string | null;
};

const intFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtInt(value: number) {
  return intFmt.format(Number(value) || 0);
}

function isDealerRow(value: unknown): value is DealerRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.name === "string" && typeof row.games === "number" && typeof row.enabled === "boolean";
}

function messageFromError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function ScratchSettings() {
  const [dealers, setDealers] = useState<DealerRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/scratch/settings", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<ScratchSettingsResponse> & {
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load scratch settings");

      const nextDealers = Array.isArray(data.dealers) ? data.dealers.filter(isDealerRow) : [];
      const nextChecked: Record<string, boolean> = {};
      for (const dealer of nextDealers) {
        nextChecked[dealer.name] = dealer.enabled;
      }

      setDealers(nextDealers);
      setChecked(nextChecked);
    } catch (err: unknown) {
      setDealers([]);
      setChecked({});
      setMessage(messageFromError(err, "Failed to load scratch settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredDealers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter((dealer) => dealer.name.toLowerCase().includes(q));
  }, [dealers, query]);

  const visibleCount = useMemo(
    () => dealers.reduce((sum, dealer) => sum + (checked[dealer.name] ? 1 : 0), 0),
    [checked, dealers]
  );

  const dirtyCount = useMemo(
    () =>
      dealers.reduce(
        (sum, dealer) => sum + ((checked[dealer.name] ?? false) !== dealer.enabled ? 1 : 0),
        0
      ),
    [checked, dealers]
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const visibleDealers = dealers.filter((dealer) => checked[dealer.name]).map((dealer) => dealer.name);
      const res = await fetch("/api/admin/scratch/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibleDealers }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to save scratch settings");

      setDealers((current) =>
        current.map((dealer) => ({
          ...dealer,
          enabled: Boolean(checked[dealer.name]),
        }))
      );
      setMessage("Saved");
    } catch (err: unknown) {
      setMessage(messageFromError(err, "Failed to save scratch settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Scratch Settings</h2>
          <p className="mt-1 text-sm text-zinc-600">Public scratch stats include only checked dealers.</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
          {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : `${visibleCount} visible`}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
        <div className="rounded-2xl border border-zinc-200 bg-white p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Search dealers</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Type to filter..."
              className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </label>
        </div>

        <div className="flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={loading || saving || dirtyCount === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
          <div>Display</div>
          <div>Dealer</div>
          <div className="text-right">games</div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-sm text-zinc-600">Loading...</div>
        ) : filteredDealers.length ? (
          <div>
            {filteredDealers.map((dealer) => (
              <label
                key={dealer.name}
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 transition last:border-b-0 hover:bg-zinc-50"
              >
                <input
                  type="checkbox"
                  checked={Boolean(checked[dealer.name])}
                  onChange={(event) =>
                    setChecked((current) => ({
                      ...current,
                      [dealer.name]: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="truncate font-medium text-zinc-900" title={dealer.name}>
                  {dealer.name}
                </span>
                <span className="text-right tabular-nums text-zinc-700">{fmtInt(dealer.games)}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-zinc-600">No dealer names found in scratch games.</div>
        )}
      </div>
    </div>
  );
}
