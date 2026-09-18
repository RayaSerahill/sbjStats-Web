"use client";

import { useEffect, useMemo, useState } from "react";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

type SegmentRow = {
  type: "string" | "image" | "imageurl";
  label: string;
  valueTypeGil: boolean;
  gilValue: number;
  win: boolean;
  bankrupt: boolean;
  probability: number;
  color: string;
  freeSpins: number;
  reverseSpin: boolean;
  effects: string[];
};

type VersionRow = {
  id: string;
  version: number;
  activeFrom: string;
  activeUntil: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  dealer: string | null;
  games: number;
  segments: SegmentRow[];
};

type PresetRow = {
  name: string;
  unlinkedGames: number;
  versions: VersionRow[];
};

type PresetsResponse = {
  ok: true;
  presets: PresetRow[];
  missing: Array<{ name: string; games: number }>;
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

function segmentKind(seg: SegmentRow) {
  if (seg.bankrupt) return "bankrupt";
  if (seg.freeSpins > 0) return `${seg.freeSpins} free spin${seg.freeSpins === 1 ? "" : "s"}`;
  if (seg.valueTypeGil) return "gil";
  if (seg.win) return "win";
  return "—";
}

export function WheelPresets() {
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [missing, setMissing] = useState<Array<{ name: string; games: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openVersion, setOpenVersion] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/wheel/presets", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<PresetsResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load wheel presets");
      setPresets(Array.isArray(data.presets) ? data.presets : []);
      setMissing(Array.isArray(data.missing) ? data.missing : []);
    } catch (err: unknown) {
      setPresets([]);
      setMissing([]);
      setMessage(getErrorMessage(err, "Failed to load wheel presets"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter((p) => p.name.toLowerCase().includes(q));
  }, [presets, query]);

  const totalVersions = presets.reduce((sum, p) => sum + p.versions.length, 0);

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Wheel Presets"
        description="Presets uploaded from SimpleWheel. Every time a preset's segments change, a new version is kept and games are tied to the version that was current when they were played. Nothing here is ever deleted."
        action={
          <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
            {loading ? "Loading…" : `${fmtInt(presets.length)} preset${presets.length === 1 ? "" : "s"} · ${fmtInt(totalVersions)} version${totalVersions === 1 ? "" : "s"}`}
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        <DashboardSection title="Filters">
          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Search presets</span>
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
                disabled={loading}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>
        </DashboardSection>

        {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

        {missing.length ? (
          <DashboardSection
            title="Named by games but never uploaded"
            description="These preset names appear on uploaded games, but no preset with that name has been uploaded yet. Use the preset upload in SimpleStats to fill them in."
          >
            <div className="flex flex-wrap gap-2">
              {missing.map((m) => (
                <span key={m.name} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                  {m.name} · {fmtInt(m.games)} game{m.games === 1 ? "" : "s"}
                </span>
              ))}
            </div>
          </DashboardSection>
        ) : null}

        <DashboardSection title="Presets" bodyClassName="p-0">
          {loading ? (
            <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
          ) : filtered.length ? (
            <div className="divide-y divide-zinc-100 bg-white">
              {filtered.map((preset) => (
                <div key={preset.name} className="px-3 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="text-sm font-semibold text-zinc-900">{preset.name}</div>
                    <div className="text-xs text-zinc-500">
                      {fmtInt(preset.versions.length)} version{preset.versions.length === 1 ? "" : "s"}
                      {preset.unlinkedGames ? ` · ${fmtInt(preset.unlinkedGames)} unlinked game${preset.unlinkedGames === 1 ? "" : "s"}` : ""}
                    </div>
                  </div>

                  <div className="mt-2 grid gap-2">
                    {preset.versions.map((v) => {
                      const isOpen = openVersion === v.id;
                      const gilSegments = v.segments.filter((s) => s.valueTypeGil).length;
                      return (
                        <div key={v.id} className="rounded-2xl border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => setOpenVersion(isOpen ? null : v.id)}
                            className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-50"
                            aria-expanded={isOpen}
                          >
                            <span className="rounded-lg bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">v{v.version}</span>
                            <span className="min-w-0 truncate text-xs text-zinc-600">
                              active from {fmtDate(v.activeFrom)}
                              {v.activeUntil ? ` until ${fmtDate(v.activeUntil)}` : " (current)"}
                              {" · "}
                              {fmtInt(v.segments.length)} segment{v.segments.length === 1 ? "" : "s"}, {fmtInt(gilSegments)} gil
                            </span>
                            <span className="text-xs tabular-nums text-zinc-700">{fmtInt(v.games)} game{v.games === 1 ? "" : "s"}</span>
                          </button>

                          {isOpen ? (
                            <div className="border-t border-zinc-100">
                              <div className="grid grid-cols-[1.4fr_.7fr_.9fr_.6fr_1fr] gap-3 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
                                <div>Segment</div>
                                <div>kind</div>
                                <div className="text-right">gil</div>
                                <div className="text-right">weight</div>
                                <div>effects</div>
                              </div>
                              {v.segments.map((seg, idx) => (
                                <div
                                  key={`${v.id}-${idx}`}
                                  className="grid grid-cols-[1.4fr_.7fr_.9fr_.6fr_1fr] items-center gap-3 border-b border-zinc-100 px-3 py-1.5 text-sm text-zinc-800 last:border-b-0"
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: seg.color || "#e4e4e7" }} aria-hidden="true" />
                                    <span className="truncate" title={seg.label}>{seg.label || <span className="text-zinc-400">(empty)</span>}</span>
                                    {seg.type !== "string" ? <span className="shrink-0 text-xs text-zinc-400">{seg.type}</span> : null}
                                  </div>
                                  <div className="text-xs text-zinc-600">{segmentKind(seg)}{seg.reverseSpin ? " · reverse" : ""}</div>
                                  <div className="text-right tabular-nums">{seg.valueTypeGil ? fmtInt(seg.gilValue) : "—"}</div>
                                  <div className="text-right tabular-nums text-zinc-600">{seg.probability}</div>
                                  <div className="truncate text-xs text-zinc-500">{seg.effects.length ? seg.effects.join(", ") : "—"}</div>
                                </div>
                              ))}
                              <div className="px-3 py-2 text-xs text-zinc-500">
                                first seen {fmtDate(v.firstSeenAt)} · last seen {fmtDate(v.lastSeenAt)}
                                {v.dealer ? ` · uploaded by ${v.dealer}` : ""}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-4 text-sm text-zinc-600">No presets uploaded yet.</div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
