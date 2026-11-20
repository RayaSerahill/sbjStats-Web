"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

type HostRow = {
  name: string;
  games: number;
  enabled: boolean;
};

type MarblesSettingsResponse = {
  ok: true;
  hosts: HostRow[];
  hiddenHosts: string[];
  updatedAt: string | null;
};

const intFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmtInt(value: number) {
  return intFmt.format(Number(value) || 0);
}

function isHostRow(value: unknown): value is HostRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.name === "string" && typeof row.games === "number" && typeof row.enabled === "boolean";
}

function messageFromError(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function MarblesSettings() {
  const [hosts, setHosts] = useState<HostRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/marbles/settings", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<MarblesSettingsResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load marbles settings");

      const nextHosts = Array.isArray(data.hosts) ? data.hosts.filter(isHostRow) : [];
      const nextChecked: Record<string, boolean> = {};
      for (const host of nextHosts) {
        nextChecked[host.name] = host.enabled;
      }

      setHosts(nextHosts);
      setChecked(nextChecked);
    } catch (err: unknown) {
      setHosts([]);
      setChecked({});
      setMessage(messageFromError(err, "Failed to load marbles settings"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredHosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return hosts;
    return hosts.filter((host) => host.name.toLowerCase().includes(q));
  }, [hosts, query]);

  const visibleCount = useMemo(() => hosts.reduce((sum, host) => sum + (checked[host.name] ? 1 : 0), 0), [checked, hosts]);

  const dirtyCount = useMemo(
    () => hosts.reduce((sum, host) => sum + ((checked[host.name] ?? false) !== host.enabled ? 1 : 0), 0),
    [checked, hosts]
  );

  const save = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Marbles stores who is hidden, not who is shown: every unticked character goes on the list.
      const hiddenHosts = hosts.filter((host) => !checked[host.name]).map((host) => host.name);
      const res = await fetch("/api/admin/marbles/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hiddenHosts }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to save marbles settings");

      setHosts((current) => current.map((host) => ({ ...host, enabled: Boolean(checked[host.name]) })));
      setMessage("Saved");
    } catch (err: unknown) {
      setMessage(messageFromError(err, "Failed to save marbles settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Marbles Settings"
        description="Public marbles stats include your own games from every checked character. A character is shown until you untick it, so new ones appear on their own."
        action={
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
            {dirtyCount ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : `${visibleCount} visible`}
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <DashboardSection title="Filters and actions">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Search characters</span>
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
        </DashboardSection>

        {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

        <DashboardSection
          title="Visible characters"
          description="Game counts are finished games that had players, the ones the public page counts."
          bodyClassName="p-0"
        >
          <div className="overflow-hidden bg-white">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
              <div>Display</div>
              <div>Character</div>
              <div className="text-right">games</div>
            </div>

            {loading ? (
              <div className="px-3 py-4 text-sm text-zinc-600">Loading...</div>
            ) : filteredHosts.length ? (
              <div>
                {filteredHosts.map((host) => (
                  <label
                    key={host.name}
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-sm text-zinc-800 transition last:border-b-0 hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checked[host.name])}
                      onChange={(event) => setChecked((current) => ({ ...current, [host.name]: event.target.checked }))}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                    />
                    <span className="truncate font-medium text-zinc-900" title={host.name}>
                      {host.name}
                    </span>
                    <span className="text-right tabular-nums text-zinc-700">{fmtInt(host.games)}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="px-3 py-4 text-sm text-zinc-600">
                {hosts.length ? "No characters match that search." : "No characters of yours have hosted a marble game yet."}
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
