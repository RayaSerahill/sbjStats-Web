"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { FortuneLayout } from "@/app/[displayName]/wheel/fortune/FortuneLayout";
import { AdvancedColorField } from "@/app/components/StatsStyleEditor";
import {
  normalizeFortuneTheme,
  type NormalizedStatsStyle,
  type StatsBackgroundStyle,
  type StatsGradientDirection,
  type StatsImageFit,
} from "@/lib/statsStyleShared";
import { surfaceCss } from "@/app/[displayName]/wheel/fortune/format";
import {
  DEFAULT_FORTUNE_THEME,
  FORTUNE_COLOR_KEYS,
  FORTUNE_COLOR_LABELS,
  FORTUNE_EDIT_KEYS,
  FORTUNE_EDIT_LABELS,
  FORTUNE_SURFACE_KEYS,
  type FortuneColorKey,
  type FortuneEditKey,
  type FortuneSurfaceKey,
  type FortuneTheme,
} from "@/lib/fortuneTheme";
import type { PublicStatsGame } from "@/lib/publicStatsRoutes";
import type { WheelStats } from "@/lib/wheelStats";
import "./live.css";

type Props = {
  displayName: string;
  username: string;
  rootGame: PublicStatsGame;
  style: NormalizedStatsStyle;
  stats: WheelStats;
  hasGames: boolean;
};

type Box = { top: number; left: number; width: number; height: number };

function isEditKey(value: string | undefined): value is FortuneEditKey {
  return !!value && (FORTUNE_EDIT_KEYS as readonly string[]).includes(value);
}

function isSurfaceKey(value: FortuneEditKey): value is FortuneSurfaceKey {
  return (FORTUNE_SURFACE_KEYS as readonly string[]).includes(value);
}

function boxOf(el: Element, stage: HTMLElement): Box {
  const r = el.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  return { top: r.top - s.top, left: r.left - s.left, width: r.width, height: r.height };
}

/** Controls the browser can handle on their own inside the board (tabs, sort picker). */
function isInteractive(target: Element) {
  return !!target.closest("button, select, input, textarea");
}

const DIRECTIONS: Array<{ value: StatsGradientDirection; label: string }> = [
  { value: "to bottom", label: "Down" },
  { value: "to top", label: "Up" },
  { value: "to right", label: "Right" },
  { value: "to left", label: "Left" },
  { value: "to bottom right", label: "Down right" },
  { value: "to bottom left", label: "Down left" },
  { value: "to top right", label: "Up right" },
  { value: "to top left", label: "Up left" },
];

/**
 * Edits one surface. Each mode only shows the fields it actually paints
 * with, so a colour picked in colour mode is the colour you see.
 */
function LiveSurfaceEditor({ value, onChange }: { value: StatsBackgroundStyle; onChange: (value: StatsBackgroundStyle) => void }) {
  const stops = value.gradientColors.length >= 2 ? value.gradientColors : [value.color, value.color];

  const setMode = (mode: StatsBackgroundStyle["mode"]) => {
    if (mode === value.mode) return;
    if (mode === "color") {
      // Carry the first gradient stop over so the page does not jump to an old colour.
      onChange({ ...value, mode, color: value.mode === "gradient" ? stops[0] : value.color });
      return;
    }
    if (mode === "gradient") {
      const same = stops.every((stop) => stop === stops[0]);
      onChange({ ...value, mode, gradientColors: same ? [value.color, value.color] : stops });
      return;
    }
    onChange({ ...value, mode });
  };

  const setStop = (index: number, color: string) => {
    const next = stops.slice();
    next[index] = color;
    onChange({ ...value, gradientColors: next });
  };

  return (
    <div className="live-surface">
      <div className="live-preview-swatch" style={surfaceCss(value)} aria-hidden />
      <div className="live-modes" role="tablist" aria-label="Surface type">
        {([
          ["color", "Colour"],
          ["gradient", "Gradient"],
          ["image", "Image"],
        ] as const).map(([mode, label]) => (
          <button key={mode} type="button" role="tab" aria-selected={value.mode === mode} className={value.mode === mode ? "is-active" : ""} onClick={() => setMode(mode)}>
            {label}
          </button>
        ))}
      </div>

      {value.mode === "color" ? <AdvancedColorField label="Colour" value={value.color} onChange={(color) => onChange({ ...value, color })} /> : null}

      {value.mode === "gradient" ? (
        <div className="grid gap-3">
          <label className="live-field">
            <span>Direction</span>
            <select value={value.gradientDirection} onChange={(e) => onChange({ ...value, gradientDirection: e.target.value as StatsGradientDirection })}>
              {DIRECTIONS.map((direction) => (
                <option key={direction.value} value={direction.value}>
                  {direction.label}
                </option>
              ))}
            </select>
          </label>
          {stops.map((stop, index) => (
            <div key={index} className="live-stop">
              <AdvancedColorField label={`Stop ${index + 1}`} value={stop} onChange={(color) => setStop(index, color)} />
              {stops.length > 2 ? (
                <button type="button" className="live-reset" onClick={() => onChange({ ...value, gradientColors: stops.filter((_, i) => i !== index) })}>
                  Remove stop {index + 1}
                </button>
              ) : null}
            </div>
          ))}
          <button type="button" className="live-panel-close" onClick={() => onChange({ ...value, gradientColors: [...stops, stops[stops.length - 1]] })}>
            Add a stop
          </button>
        </div>
      ) : null}

      {value.mode === "image" ? (
        <div className="grid gap-3">
          <label className="live-field">
            <span>Image URL or path</span>
            <input value={value.imageUrl} onChange={(e) => onChange({ ...value, imageUrl: e.target.value })} placeholder="/img/noise.png or https://..." spellCheck={false} />
          </label>
          <label className="live-field">
            <span>Fit</span>
            <select value={value.imageFit} onChange={(e) => onChange({ ...value, imageFit: e.target.value as StatsImageFit })}>
              <option value="cover">Cover</option>
              <option value="repeat">Repeat</option>
            </select>
          </label>
          <AdvancedColorField label="Colour behind the image" value={value.color} onChange={(color) => onChange({ ...value, color })} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * The real Fortune board with a dashed highlight following the mouse and
 * a side panel that edits whichever surface was clicked. Nothing is
 * saved until the host presses Save.
 */
export function WheelLiveEditor({ displayName, username, rootGame, style, stats, hasGames }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const hoverElRef = useRef<Element | null>(null);
  const selectedElRef = useRef<Element | null>(null);

  const [theme, setTheme] = useState<FortuneTheme>(style.fortune);
  const [saved, setSaved] = useState<FortuneTheme>(style.fortune);
  const [selected, setSelected] = useState<FortuneEditKey | null>(null);
  const [hoverKey, setHoverKey] = useState<FortuneEditKey | null>(null);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = JSON.stringify(theme) !== JSON.stringify(saved);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setHoverBox(hoverElRef.current?.isConnected ? boxOf(hoverElRef.current, stage) : null);
    setSelectedBox(selectedElRef.current?.isConnected ? boxOf(selectedElRef.current, stage) : null);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  // Re-measure once the board has repainted with the new theme or panel state.
  useEffect(() => {
    const id = window.setTimeout(measure, 220);
    return () => window.clearTimeout(id);
  }, [theme, selected, measure]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (target.closest(".live-panel, .live-toolbar")) return;
    const el = target.closest("[data-edit]");
    if (el === hoverElRef.current) return;
    hoverElRef.current = el;
    const key = el?.getAttribute("data-edit") ?? undefined;
    setHoverKey(isEditKey(key) ? key : null);
    measure();
  };

  const onMouseLeave = () => {
    hoverElRef.current = null;
    setHoverKey(null);
    setHoverBox(null);
  };

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (target.closest(".live-panel, .live-toolbar")) return;
    if (isInteractive(target)) return;
    const el = target.closest("[data-edit]");
    const key = el?.getAttribute("data-edit") ?? undefined;
    if (!el || !isEditKey(key)) return;
    e.preventDefault();
    e.stopPropagation();
    selectedElRef.current = el;
    setSelected(key);
    measure();
  };

  const select = (key: FortuneEditKey) => {
    const stage = stageRef.current;
    selectedElRef.current = stage?.querySelector(`[data-edit="${key}"]`) ?? null;
    selectedElRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setSelected(key);
    measure();
  };

  const close = () => {
    selectedElRef.current = null;
    setSelected(null);
    setSelectedBox(null);
  };

  const setSurface = (key: FortuneSurfaceKey, value: StatsBackgroundStyle) =>
    setTheme((t) => ({ ...t, surfaces: { ...t.surfaces, [key]: value } }));
  const setColor = (key: FortuneColorKey, value: string) => setTheme((t) => ({ ...t, colors: { ...t.colors, [key]: value } }));
  const setDonutColor = (index: number, value: string) =>
    setTheme((t) => {
      const donut = t.donut.slice();
      donut[index] = value;
      return { ...t, donut };
    });

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stats-style", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fortune: theme }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      const next = normalizeFortuneTheme(data?.style?.fortune);
      setTheme(next);
      setSaved(next);
      setMessage("Saved");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    if (!window.confirm("Reset every colour and surface of the Fortune layout to the defaults? Nothing is saved until you press Save.")) return;
    setTheme(DEFAULT_FORTUNE_THEME);
  };

  const panelLabel = selected ? FORTUNE_EDIT_LABELS[selected] : null;

  return (
    <div
      ref={stageRef}
      className={`live-stage${selected ? " has-panel" : ""}`}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClickCapture={onClickCapture}
    >
      <FortuneLayout
        displayName={displayName}
        username={username}
        rootGame={rootGame}
        style={style}
        stats={stats}
        hasGames={hasGames}
        theme={theme}
        editing
        navActive="wheel"
      />

      {selectedBox && selected ? (
        <div className="fortune-edit-highlight is-selected" style={selectedBox} aria-hidden>
          <span className="fortune-edit-tag">{FORTUNE_EDIT_LABELS[selected].label}</span>
        </div>
      ) : null}
      {hoverBox && hoverKey && hoverKey !== selected ? (
        <div className="fortune-edit-highlight" style={hoverBox} aria-hidden>
          <span className="fortune-edit-tag">{FORTUNE_EDIT_LABELS[hoverKey].label}</span>
        </div>
      ) : null}

      <div className="live-toolbar" role="toolbar" aria-label="Live editor">
        <span className="live-toolbar-hint">
          {dirty ? <span className="live-dot" aria-hidden /> : null}
          🎨 Hover an element, click it to edit
        </span>
        <button type="button" className="live-btn" onClick={() => select("page")}>
          Page and colours
        </button>
        <button type="button" className="live-btn" onClick={resetAll}>
          Reset all
        </button>
        <button type="button" className="live-btn is-primary" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </button>
        <Link href="/dashboard/stats-style" className="live-btn">
          Back to dashboard
        </Link>
        {message ? <span className="live-message">{message}</span> : null}
      </div>

      {selected && panelLabel ? (
        <aside className="live-panel" aria-label={`Edit ${panelLabel.label}`}>
          <div className="live-panel-head">
            <div>
              <div className="live-panel-title">{panelLabel.label}</div>
              <div className="live-panel-hint">{panelLabel.hint}</div>
            </div>
            <button type="button" className="live-panel-close" onClick={close}>
              Done
            </button>
          </div>

          {isSurfaceKey(selected) ? (
            <>
              <LiveSurfaceEditor value={theme.surfaces[selected]} onChange={(value) => setSurface(selected, value)} />
              <button type="button" className="live-reset" onClick={() => setSurface(selected, DEFAULT_FORTUNE_THEME.surfaces[selected])}>
                Reset this element
              </button>
            </>
          ) : selected === "donut" ? (
            <>
              <div className="grid gap-3">
                {theme.donut.map((color, index) => (
                  <AdvancedColorField key={index} label={`Slice ${index + 1}`} value={color} onChange={(value) => setDonutColor(index, value)} />
                ))}
              </div>
              <button type="button" className="live-reset" onClick={() => setTheme((t) => ({ ...t, donut: DEFAULT_FORTUNE_THEME.donut }))}>
                Reset the donut
              </button>
            </>
          ) : (
            <>
              <AdvancedColorField label="Line colour" value={theme.colors[selected]} onChange={(value) => setColor(selected, value)} />
              <button type="button" className="live-reset" onClick={() => setColor(selected, DEFAULT_FORTUNE_THEME.colors[selected])}>
                Reset this chart
              </button>
            </>
          )}

          {selected === "page" ? (
            <div className="live-panel-section">
              <div className="live-panel-section-title">Colours</div>
              <div className="grid gap-3">
                {FORTUNE_COLOR_KEYS.filter((key) => key !== "chartGames" && key !== "chartGil").map((key) => (
                  <AdvancedColorField key={key} label={FORTUNE_COLOR_LABELS[key]} value={theme.colors[key]} onChange={(value) => setColor(key, value)} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="live-panel-section">
            <div className="live-panel-section-title">Jump to</div>
            <div className="live-jump">
              {FORTUNE_EDIT_KEYS.map((key) => (
                <button key={key} type="button" className={key === selected ? "is-active" : ""} onClick={() => select(key)}>
                  {FORTUNE_EDIT_LABELS[key].label}
                </button>
              ))}
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
