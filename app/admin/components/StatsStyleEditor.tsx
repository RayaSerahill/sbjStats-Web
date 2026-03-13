"use client";

import { useEffect, useMemo, useState } from "react";

type StatsFontStyle = "sans" | "serif" | "mono" | "old-london";
type StatsBackgroundMode = "color" | "image" | "gradient";
type StatsImageFit = "cover" | "repeat";
type StatsGradientDirection =
  | "to bottom"
  | "to top"
  | "to right"
  | "to left"
  | "to bottom right"
  | "to bottom left"
  | "to top right"
  | "to top left";

type StatsBackgroundStyle = {
  mode: StatsBackgroundMode;
  color: string;
  imageUrl: string;
  imageFit: StatsImageFit;
  gradientColors: string[];
  gradientDirection: StatsGradientDirection;
};

type StatsStyle = {
  background: StatsBackgroundStyle;
  containerBackground: StatsBackgroundStyle;
  elementBackground: StatsBackgroundStyle;
  fontColor: string;
  fontStyle: StatsFontStyle;
  leaderboardSize: number;
  pieChartColors: string[];
  barChartProfitColor: string;
  barChartLossColor: string;
  barChartDays: number;
};

const makeBackground = (color: string): StatsBackgroundStyle => ({
  mode: "color",
  color,
  imageUrl: "",
  imageFit: "cover",
  gradientColors: [color, color],
  gradientDirection: "to bottom",
});

const defaults: StatsStyle = {
  background: makeBackground("#000000"),
  containerBackground: makeBackground("#ffffff"),
  elementBackground: makeBackground("#ffffff"),
  fontColor: "#000000",
  fontStyle: "sans",
  leaderboardSize: 20,
  pieChartColors: ["#ff0000", "#d52d00", "#ff9a56", "#ffffff", "#d162a4", "#a30262"],
  barChartProfitColor: "#16a34a",
  barChartLossColor: "#dc2626",
  barChartDays: 20,
};

const fontOptions = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Monospace" },
  { value: "old-london", label: "Old London" },
] as const;

const directionOptions: Array<{ value: StatsGradientDirection; label: string }> = [
  { value: "to bottom", label: "Down" },
  { value: "to top", label: "Up" },
  { value: "to right", label: "Right" },
  { value: "to left", label: "Left" },
  { value: "to bottom right", label: "Down right" },
  { value: "to bottom left", label: "Down left" },
  { value: "to top right", label: "Up right" },
  { value: "to top left", label: "Up left" },
];

const quickColors = [
  "#000000",
  "#ffffff",
  "#ff9fc6",
  "#ff6fae",
  "#d162a4",
  "#a30262",
  "#ff9a56",
  "#d52d00",
  "#16a34a",
  "#dc2626",
  "#60a5fa",
  "#a78bfa",
];

function normalizeHex(value: string, fallback: string) {
  const clean = value.trim().toLowerCase();
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(clean) ? clean : fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHex(hex, "#000000");
  const raw = normalized.slice(1);
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

function buildPreviewStyle(surface: StatsBackgroundStyle) {
  if (surface.mode === "image" && surface.imageUrl.trim()) {
    return {
      backgroundColor: surface.color,
      backgroundImage: `url("${surface.imageUrl.trim().replace(/"/g, "\\\"")}")`,
      backgroundPosition: "center",
      backgroundRepeat: surface.imageFit === "repeat" ? "repeat" : "no-repeat",
      backgroundSize: surface.imageFit === "repeat" ? "auto" : "cover",
    };
  }

  if (surface.mode === "gradient") {
    const colors = surface.gradientColors.filter(Boolean);
    const resolved = colors.length >= 2 ? colors : [surface.color, surface.color];
    return {
      backgroundColor: resolved[0],
      backgroundImage: `linear-gradient(${surface.gradientDirection}, ${resolved.join(", ")})`,
    };
  }

  return { backgroundColor: surface.color };
}

function AdvancedColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const safeValue = normalizeHex(value, "#000000");
  const rgb = useMemo(() => hexToRgb(safeValue), [safeValue]);
  const [draft, setDraft] = useState(safeValue);

  useEffect(() => {
    setDraft(safeValue);
  }, [safeValue]);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-zinc-800">{label}</span>
        <div className="h-8 w-8 rounded-xl border border-black/10" style={{ background: safeValue }} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {quickColors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            className="h-7 w-7 rounded-lg border border-black/10 transition hover:scale-105"
            style={{ background: color }}
            title={color}
          />
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-zinc-200 px-3 py-2">
        <div className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Hex</div>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const next = normalizeHex(draft, safeValue);
            setDraft(next);
            onChange(next);
          }}
          placeholder="#ff9fc6"
          spellCheck={false}
          className="mt-1 w-full bg-transparent text-sm text-zinc-900 outline-none"
        />
      </div>

      <div className="mt-3 grid gap-2">
        {([
          ["R", rgb.r, (next: number) => onChange(rgbToHex(next, rgb.g, rgb.b))],
          ["G", rgb.g, (next: number) => onChange(rgbToHex(rgb.r, next, rgb.b))],
          ["B", rgb.b, (next: number) => onChange(rgbToHex(rgb.r, rgb.g, next))],
        ] as const).map(([name, channel, setter]) => (
          <label key={name} className="grid grid-cols-[20px_1fr_42px] items-center gap-3 text-xs text-zinc-600">
            <span>{name}</span>
            <input
              type="range"
              min={0}
              max={255}
              value={channel}
              onChange={(e) => setter(Number(e.target.value))}
              className="w-full"
            />
            <span className="text-right tabular-nums">{channel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function BackgroundEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: StatsBackgroundStyle;
  onChange: (value: StatsBackgroundStyle) => void;
}) {
  const gradientColors = value.gradientColors.length ? value.gradientColors : [value.color, value.color];

  const setGradientColor = (index: number, color: string) => {
    const next = gradientColors.slice();
    next[index] = color;
    onChange({ ...value, gradientColors: next });
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{label}</div>
          <div className="mt-1 text-xs text-zinc-500">Pick a solid color, image, or a gradient stack.</div>
        </div>
        <div className="h-24 w-full rounded-2xl border border-black/10 md:w-44" style={buildPreviewStyle(value)} />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {([
          ["color", "Color"],
          ["image", "Image"],
          ["gradient", "Gradient"],
        ] as const).map(([mode, modeLabel]) => (
          <button
            key={mode}
            type="button"
            onClick={() => onChange({ ...value, mode })}
            className={`rounded-2xl border px-3 py-2 text-sm transition ${value.mode === mode ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-400"}`}
          >
            {modeLabel}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <AdvancedColorField
          label={value.mode === "image" ? "Fallback color" : value.mode === "gradient" ? "Base color" : "Color"}
          value={value.color}
          onChange={(color) => onChange({ ...value, color })}
        />
      </div>

      {value.mode === "image" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
          <label className="block text-sm text-zinc-800">
            <span className="text-xs font-medium">Image URL or path</span>
            <input
              value={value.imageUrl}
              onChange={(e) => onChange({ ...value, imageUrl: e.target.value })}
              placeholder="/img/noise.png or https://..."
              spellCheck={false}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
            />
          </label>
          <label className="block text-sm text-zinc-800">
            <span className="text-xs font-medium">Image mode</span>
            <select
              value={value.imageFit}
              onChange={(e) => onChange({ ...value, imageFit: e.target.value as StatsImageFit })}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
            >
              <option value="cover">Cover</option>
              <option value="repeat">Repeat</option>
            </select>
          </label>
        </div>
      ) : null}

      {value.mode === "gradient" ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-zinc-900">Gradient colors</div>
              <div className="text-xs text-zinc-500">Add as many stops as you want.</div>
            </div>
            <button
              type="button"
              onClick={() => onChange({ ...value, gradientColors: [...gradientColors, gradientColors[gradientColors.length - 1] ?? value.color] })}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 transition hover:border-zinc-400"
            >
              Add color
            </button>
          </div>

          <label className="mt-4 block text-sm text-zinc-800">
            <span className="text-xs font-medium">Direction</span>
            <select
              value={value.gradientDirection}
              onChange={(e) => onChange({ ...value, gradientDirection: e.target.value as StatsGradientDirection })}
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
            >
              {directionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid gap-3">
            {gradientColors.map((color, index) => (
              <div key={index} className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-zinc-700">Stop {index + 1}</div>
                  {gradientColors.length > 2 ? (
                    <button
                      type="button"
                      onClick={() => onChange({ ...value, gradientColors: gradientColors.filter((_, i) => i !== index) })}
                      className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <AdvancedColorField label={`Gradient color ${index + 1}`} value={color} onChange={(next) => setGradientColor(index, next)} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function StatsStyleEditor() {
  const [style, setStyle] = useState<StatsStyle>(defaults);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/stats-style", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Failed to load stats style");
    setStyle({ ...defaults, ...(data?.style ?? {}) });
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e: any) {
        setMessage(e?.message ?? "Failed to load stats style");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pieColors = useMemo(() => {
    const arr = style.pieChartColors.slice(0, 6);
    while (arr.length < 6) arr.push(defaults.pieChartColors[arr.length]);
    return arr;
  }, [style.pieChartColors]);

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stats-style", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...style, pieChartColors: pieColors }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save stats style");
      setStyle({ ...defaults, ...(data?.style ?? {}) });
      setMessage("Stats style saved");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to save stats style");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setStyle(defaults);
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stats-style", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(defaults),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to reset stats style");
      setStyle({ ...defaults, ...(data?.style ?? {}) });
      setMessage("Stats style reset to defaults");
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to reset stats style");
    } finally {
      setBusy(false);
    }
  };

  const setPieColor = (index: number, value: string) => {
    setStyle((current) => {
      const next = current.pieChartColors.slice(0, 6);
      while (next.length < 6) next.push(defaults.pieChartColors[next.length]);
      next[index] = value;
      return { ...current, pieChartColors: next };
    });
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Stats style</h2>
        <p className="mt-1 text-sm text-zinc-600">Customize the public stats page with richer surface backgrounds, fonts, chart colors, and leaderboard sizing.</p>
      </div>

      {loading ? <div className="mt-4 text-sm text-zinc-700">Loading…</div> : null}

      <div className="mt-4 grid gap-4">
        <BackgroundEditor label="Page background" value={style.background} onChange={(background) => setStyle((s) => ({ ...s, background }))} />
        <BackgroundEditor label="Container background" value={style.containerBackground} onChange={(containerBackground) => setStyle((s) => ({ ...s, containerBackground }))} />
        <BackgroundEditor label="Element background" value={style.elementBackground} onChange={(elementBackground) => setStyle((s) => ({ ...s, elementBackground }))} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdvancedColorField label="Font color" value={style.fontColor} onChange={(fontColor) => setStyle((s) => ({ ...s, fontColor }))} />

        <label className="block text-sm text-zinc-800">
          <span className="text-xs font-medium">Font style</span>
          <select
            value={style.fontStyle}
            onChange={(e) => setStyle((s) => ({ ...s, fontStyle: e.target.value as StatsFontStyle }))}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
          >
            {fontOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm text-zinc-800">
          <span className="text-xs font-medium">Leaderboard size</span>
          <input
            type="number"
            min={1}
            max={100}
            value={style.leaderboardSize}
            onChange={(e) => setStyle((s) => ({ ...s, leaderboardSize: Number(e.target.value) || 1 }))}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
          />
        </label>

        <label className="block text-sm text-zinc-800">
          <span className="text-xs font-medium">Bar chart days</span>
          <input
            type="number"
            min={1}
            max={365}
            value={style.barChartDays}
            onChange={(e) => setStyle((s) => ({ ...s, barChartDays: Number(e.target.value) || 1 }))}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none"
          />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-[#FF9FC6]/30 bg-[#fff7fb] p-4">
        <div className="text-sm font-medium text-zinc-900">Pie chart colors</div>
        <div className="mt-1 text-xs text-zinc-600">Default order follows the lesbian pride palette, with red used for bust.</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pieColors.map((color, index) => (
            <AdvancedColorField key={index} label={`Color ${index + 1}`} value={color} onChange={(value) => setPieColor(index, value)} />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AdvancedColorField label="Bar chart profit color" value={style.barChartProfitColor} onChange={(barChartProfitColor) => setStyle((s) => ({ ...s, barChartProfitColor }))} />
        <AdvancedColorField label="Bar chart loss color" value={style.barChartLossColor} onChange={(barChartLossColor) => setStyle((s) => ({ ...s, barChartLossColor }))} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || loading}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save style"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || loading}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reset to defaults
        </button>
        {message ? <div className="self-center text-sm text-zinc-700">{message}</div> : null}
      </div>
    </div>
  );
}
