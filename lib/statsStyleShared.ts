import type { CSSProperties } from "react";

export type StatsFontStyle = "sans" | "serif" | "mono" | "old-london";
export type StatsBackgroundMode = "color" | "image" | "gradient";
export type StatsImageFit = "cover" | "repeat";
export type StatsGradientDirection =
  | "to bottom"
  | "to top"
  | "to right"
  | "to left"
  | "to bottom right"
  | "to bottom left"
  | "to top right"
  | "to top left";

export type StatsBackgroundStyle = {
  mode: StatsBackgroundMode;
  color: string;
  imageUrl: string;
  imageFit: StatsImageFit;
  gradientColors: string[];
  gradientDirection: StatsGradientDirection;
};

export type NormalizedStatsStyle = {
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
  layoutMarkdown: string;
};

const defaultBackground = (color: string): StatsBackgroundStyle => ({
  mode: "color",
  color,
  imageUrl: "",
  imageFit: "cover",
  gradientColors: [color, color],
  gradientDirection: "to bottom",
});

export const DEFAULT_STATS_LAYOUT_MARKDOWN = `# {{dealerName}}
Stats for uploader **{{usernameOrName}}** • {{totalPlayers}} tracked players

{{summary}}

## Leaderboards
{{leaderboards}}

{{dealer-charts}}

{{footer-note}}`;

export const DEFAULT_STATS_STYLE: NormalizedStatsStyle = {
  background: defaultBackground("#000000"),
  containerBackground: defaultBackground("#ffffff"),
  elementBackground: defaultBackground("#ffffff"),
  fontColor: "#000000",
  fontStyle: "sans",
  leaderboardSize: 20,
  pieChartColors: ["#ff0000", "#d52d00", "#ff9a56", "#ffffff", "#d162a4", "#a30262"],
  barChartProfitColor: "#16a34a",
  barChartLossColor: "#dc2626",
  barChartDays: 20,
  layoutMarkdown: DEFAULT_STATS_LAYOUT_MARKDOWN,
};

const FONT_STYLE_VALUES: StatsFontStyle[] = ["sans", "serif", "mono", "old-london"];
const BG_MODE_VALUES: StatsBackgroundMode[] = ["color", "image", "gradient"];
const IMAGE_FIT_VALUES: StatsImageFit[] = ["cover", "repeat"];
const GRADIENT_DIRECTION_VALUES: StatsGradientDirection[] = [
  "to bottom",
  "to top",
  "to right",
  "to left",
  "to bottom right",
  "to bottom left",
  "to top right",
  "to top left",
];

function normalizeHex(input: unknown, fallback: string) {
  const value = typeof input === "string" ? input.trim() : "";
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value.toLowerCase() : fallback;
}

function normalizeInt(input: unknown, fallback: number, min: number, max: number) {
  const n = Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function normalizeFontStyle(input: unknown, fallback: StatsFontStyle): StatsFontStyle {
  return typeof input === "string" && FONT_STYLE_VALUES.includes(input as StatsFontStyle)
    ? (input as StatsFontStyle)
    : fallback;
}

function normalizePieChartColors(input: unknown, fallback: string[]) {
  const raw = Array.isArray(input) ? input : [];
  const colors = raw
    .map((value) => normalizeHex(value, ""))
    .filter(Boolean)
    .slice(0, 12);
  return colors.length ? colors : fallback;
}

function normalizeBackgroundMode(input: unknown, fallback: StatsBackgroundMode): StatsBackgroundMode {
  return typeof input === "string" && BG_MODE_VALUES.includes(input as StatsBackgroundMode)
    ? (input as StatsBackgroundMode)
    : fallback;
}

function normalizeImageFit(input: unknown, fallback: StatsImageFit): StatsImageFit {
  return typeof input === "string" && IMAGE_FIT_VALUES.includes(input as StatsImageFit)
    ? (input as StatsImageFit)
    : fallback;
}

function normalizeGradientDirection(input: unknown, fallback: StatsGradientDirection): StatsGradientDirection {
  return typeof input === "string" && GRADIENT_DIRECTION_VALUES.includes(input as StatsGradientDirection)
    ? (input as StatsGradientDirection)
    : fallback;
}

function normalizeGradientColors(input: unknown, fallback: string[]) {
  const raw = Array.isArray(input) ? input : [];
  const colors = raw
    .map((value) => normalizeHex(value, ""))
    .filter(Boolean)
    .slice(0, 12);
  if (colors.length >= 2) return colors;
  if (colors.length === 1) return [colors[0], colors[0]];
  return fallback;
}

function normalizeBackgroundStyle(input: unknown, fallback: StatsBackgroundStyle): StatsBackgroundStyle {
  if (typeof input === "string") {
    return defaultBackground(normalizeHex(input, fallback.color));
  }

  const raw = input && typeof input === "object" ? (input as Partial<StatsBackgroundStyle>) : {};
  const color = normalizeHex(raw.color, fallback.color);
  return {
    mode: normalizeBackgroundMode(raw.mode, fallback.mode),
    color,
    imageUrl: typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : fallback.imageUrl,
    imageFit: normalizeImageFit(raw.imageFit, fallback.imageFit),
    gradientColors: normalizeGradientColors(raw.gradientColors, fallback.gradientColors),
    gradientDirection: normalizeGradientDirection(raw.gradientDirection, fallback.gradientDirection),
  };
}

function normalizeLayoutMarkdown(input: unknown, fallback: string) {
  if (typeof input !== "string") return fallback;
  const normalized = input.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return fallback;
  return normalized.slice(0, 12000);
}

export function normalizeStatsStyle(input?: Partial<NormalizedStatsStyle> | null): NormalizedStatsStyle {
  return {
    background: normalizeBackgroundStyle(input?.background, DEFAULT_STATS_STYLE.background),
    containerBackground: normalizeBackgroundStyle(input?.containerBackground, DEFAULT_STATS_STYLE.containerBackground),
    elementBackground: normalizeBackgroundStyle(input?.elementBackground, DEFAULT_STATS_STYLE.elementBackground),
    fontColor: normalizeHex(input?.fontColor, DEFAULT_STATS_STYLE.fontColor),
    fontStyle: normalizeFontStyle(input?.fontStyle, DEFAULT_STATS_STYLE.fontStyle),
    leaderboardSize: normalizeInt(input?.leaderboardSize, DEFAULT_STATS_STYLE.leaderboardSize, 1, 100),
    pieChartColors: normalizePieChartColors(input?.pieChartColors, DEFAULT_STATS_STYLE.pieChartColors),
    barChartProfitColor: normalizeHex(input?.barChartProfitColor, DEFAULT_STATS_STYLE.barChartProfitColor),
    barChartLossColor: normalizeHex(input?.barChartLossColor, DEFAULT_STATS_STYLE.barChartLossColor),
    barChartDays: normalizeInt(input?.barChartDays, DEFAULT_STATS_STYLE.barChartDays, 1, 365),
    layoutMarkdown: normalizeLayoutMarkdown(input?.layoutMarkdown, DEFAULT_STATS_STYLE.layoutMarkdown),
  };
}

export function getStatsFontFamily(fontStyle: StatsFontStyle) {
  switch (fontStyle) {
    case "serif":
      return 'Georgia, "Times New Roman", serif';
    case "mono":
      return '"Space Mono", "Courier New", monospace';
    case "old-london":
      return '"Old London", Georgia, serif';
    default:
      return 'Arial, Helvetica, sans-serif';
  }
}

export function getBackgroundStyleCss(surface: StatsBackgroundStyle): CSSProperties {
  if (surface.mode === "image" && surface.imageUrl) {
    return {
      backgroundColor: surface.color,
      backgroundImage: `url("${surface.imageUrl.replace(/"/g, "\"")}")`,
      backgroundPosition: "center",
      backgroundRepeat: surface.imageFit === "repeat" ? "repeat" : "no-repeat",
      backgroundSize: surface.imageFit === "repeat" ? "auto" : "cover",
    };
  }

  if (surface.mode === "gradient") {
    const colors = surface.gradientColors.length >= 2 ? surface.gradientColors : [surface.color, surface.color];
    return {
      backgroundColor: colors[0],
      backgroundImage: `linear-gradient(${surface.gradientDirection}, ${colors.join(", ")})`,
    };
  }

  return { backgroundColor: surface.color };
}
