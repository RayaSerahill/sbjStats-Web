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

export type StatsNavItemStyle = {
  background: StatsBackgroundStyle;
  borderRadius: number;
  fontColor: string;
  fontSize: number;
  fontStyle: StatsFontStyle;
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
  scratchBackground: StatsBackgroundStyle;
  scratchContainerBackground: StatsBackgroundStyle;
  scratchElementBackground: StatsBackgroundStyle;
  scratchFontColor: string;
  scratchFontStyle: StatsFontStyle;
  scratchLeaderboardSize: number;
  scratchChartCardsColor: string;
  scratchChartWinsColor: string;
  scratchChartValueColor: string;
  scratchLeaderboardTableBackground: StatsBackgroundStyle;
  scratchLeaderboardTableHeaderBackground: StatsBackgroundStyle;
  scratchLeaderboardTableHeaderTextColor: string;
  scratchLeaderboardTabContainerBackground: StatsBackgroundStyle;
  scratchLeaderboardTabActiveBackground: StatsBackgroundStyle;
  scratchLeaderboardTabInactiveBackground: StatsBackgroundStyle;
  scratchLeaderboardTabHoverBackground: StatsBackgroundStyle;
  scratchLeaderboardTabActiveTextColor: string;
  scratchLeaderboardTabInactiveTextColor: string;
  scratchLeaderboardTabHoverTextColor: string;
  publicNavShowBlackjack: boolean;
  publicNavShowScratch: boolean;
  publicNavBackground: StatsBackgroundStyle;
  publicNavBorderRadius: number;
  publicNavFontColor: string;
  publicNavFontSize: number;
  publicNavFontStyle: StatsFontStyle;
  publicNavInactive: StatsNavItemStyle;
  publicNavHover: StatsNavItemStyle;
  publicNavActive: StatsNavItemStyle;
};

const defaultBackground = (color: string): StatsBackgroundStyle => ({
  mode: "color",
  color,
  imageUrl: "",
  imageFit: "cover",
  gradientColors: [color, color],
  gradientDirection: "to bottom",
});

const defaultNavItemStyle = (backgroundColor: string, fontColor: string, fontStyle: StatsFontStyle): StatsNavItemStyle => ({
  background: defaultBackground(backgroundColor),
  borderRadius: 14,
  fontColor,
  fontSize: 14,
  fontStyle,
});

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
  scratchBackground: defaultBackground("#000000"),
  scratchContainerBackground: defaultBackground("#ffffff"),
  scratchElementBackground: defaultBackground("#ffffff"),
  scratchFontColor: "#000000",
  scratchFontStyle: "sans",
  scratchLeaderboardSize: 20,
  scratchChartCardsColor: "#3b82f6",
  scratchChartWinsColor: "#ec4899",
  scratchChartValueColor: "#22c55e",
  scratchLeaderboardTableBackground: defaultBackground("#ffffff"),
  scratchLeaderboardTableHeaderBackground: defaultBackground("#ffffff"),
  scratchLeaderboardTableHeaderTextColor: "#000000",
  scratchLeaderboardTabContainerBackground: defaultBackground("#ffffff"),
  scratchLeaderboardTabActiveBackground: defaultBackground("#ec4899"),
  scratchLeaderboardTabInactiveBackground: defaultBackground("#ffffff"),
  scratchLeaderboardTabHoverBackground: defaultBackground("#fdf2f8"),
  scratchLeaderboardTabActiveTextColor: "#ffffff",
  scratchLeaderboardTabInactiveTextColor: "#000000",
  scratchLeaderboardTabHoverTextColor: "#000000",
  publicNavShowBlackjack: true,
  publicNavShowScratch: true,
  publicNavBackground: defaultBackground("#ffffff"),
  publicNavBorderRadius: 18,
  publicNavFontColor: "#000000",
  publicNavFontSize: 14,
  publicNavFontStyle: "sans",
  publicNavInactive: defaultNavItemStyle("#ffffff", "#000000", "sans"),
  publicNavHover: defaultNavItemStyle("#f3f4f6", "#000000", "sans"),
  publicNavActive: defaultNavItemStyle("#111111", "#ffffff", "sans"),
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

function normalizeBool(input: unknown, fallback: boolean) {
  return typeof input === "boolean" ? input : fallback;
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

function normalizeNavItemStyle(input: unknown, fallback: StatsNavItemStyle): StatsNavItemStyle {
  const raw = input && typeof input === "object" ? (input as Partial<StatsNavItemStyle>) : {};
  return {
    background: normalizeBackgroundStyle(raw.background, fallback.background),
    borderRadius: normalizeInt(raw.borderRadius, fallback.borderRadius, 0, 999),
    fontColor: normalizeHex(raw.fontColor, fallback.fontColor),
    fontSize: normalizeInt(raw.fontSize, fallback.fontSize, 8, 72),
    fontStyle: normalizeFontStyle(raw.fontStyle, fallback.fontStyle),
  };
}

export function normalizeStatsStyle(input?: Partial<NormalizedStatsStyle> | null): NormalizedStatsStyle {
  const background = normalizeBackgroundStyle(input?.background, DEFAULT_STATS_STYLE.background);
  const containerBackground = normalizeBackgroundStyle(input?.containerBackground, DEFAULT_STATS_STYLE.containerBackground);
  const elementBackground = normalizeBackgroundStyle(input?.elementBackground, DEFAULT_STATS_STYLE.elementBackground);
  const fontColor = normalizeHex(input?.fontColor, DEFAULT_STATS_STYLE.fontColor);
  const fontStyle = normalizeFontStyle(input?.fontStyle, DEFAULT_STATS_STYLE.fontStyle);
  const leaderboardSize = normalizeInt(input?.leaderboardSize, DEFAULT_STATS_STYLE.leaderboardSize, 1, 100);
  const pieChartColors = normalizePieChartColors(input?.pieChartColors, DEFAULT_STATS_STYLE.pieChartColors);
  const barChartProfitColor = normalizeHex(input?.barChartProfitColor, DEFAULT_STATS_STYLE.barChartProfitColor);
  const barChartLossColor = normalizeHex(input?.barChartLossColor, DEFAULT_STATS_STYLE.barChartLossColor);
  const barChartDays = normalizeInt(input?.barChartDays, DEFAULT_STATS_STYLE.barChartDays, 1, 365);

  return {
    background,
    containerBackground,
    elementBackground,
    fontColor,
    fontStyle,
    leaderboardSize,
    pieChartColors,
    barChartProfitColor,
    barChartLossColor,
    barChartDays,
    scratchBackground: normalizeBackgroundStyle(input?.scratchBackground, background),
    scratchContainerBackground: normalizeBackgroundStyle(input?.scratchContainerBackground, containerBackground),
    scratchElementBackground: normalizeBackgroundStyle(input?.scratchElementBackground, elementBackground),
    scratchFontColor: normalizeHex(input?.scratchFontColor, fontColor),
    scratchFontStyle: normalizeFontStyle(input?.scratchFontStyle, fontStyle),
    scratchLeaderboardSize: normalizeInt(input?.scratchLeaderboardSize, leaderboardSize, 1, 100),
    scratchChartCardsColor: normalizeHex(input?.scratchChartCardsColor, pieChartColors[0] ?? DEFAULT_STATS_STYLE.scratchChartCardsColor),
    scratchChartWinsColor: normalizeHex(input?.scratchChartWinsColor, pieChartColors[1] ?? DEFAULT_STATS_STYLE.scratchChartWinsColor),
    scratchChartValueColor: normalizeHex(input?.scratchChartValueColor, barChartProfitColor),
    scratchLeaderboardTableBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTableBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTableBackground
    ),
    scratchLeaderboardTableHeaderBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTableHeaderBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTableHeaderBackground
    ),
    scratchLeaderboardTableHeaderTextColor: normalizeHex(
      input?.scratchLeaderboardTableHeaderTextColor,
      DEFAULT_STATS_STYLE.scratchLeaderboardTableHeaderTextColor
    ),
    scratchLeaderboardTabContainerBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTabContainerBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabContainerBackground
    ),
    scratchLeaderboardTabActiveBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTabActiveBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabActiveBackground
    ),
    scratchLeaderboardTabInactiveBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTabInactiveBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabInactiveBackground
    ),
    scratchLeaderboardTabHoverBackground: normalizeBackgroundStyle(
      input?.scratchLeaderboardTabHoverBackground,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabHoverBackground
    ),
    scratchLeaderboardTabActiveTextColor: normalizeHex(
      input?.scratchLeaderboardTabActiveTextColor,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabActiveTextColor
    ),
    scratchLeaderboardTabInactiveTextColor: normalizeHex(
      input?.scratchLeaderboardTabInactiveTextColor,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabInactiveTextColor
    ),
    scratchLeaderboardTabHoverTextColor: normalizeHex(
      input?.scratchLeaderboardTabHoverTextColor,
      DEFAULT_STATS_STYLE.scratchLeaderboardTabHoverTextColor
    ),
    publicNavShowBlackjack: normalizeBool(input?.publicNavShowBlackjack, DEFAULT_STATS_STYLE.publicNavShowBlackjack),
    publicNavShowScratch: normalizeBool(input?.publicNavShowScratch, DEFAULT_STATS_STYLE.publicNavShowScratch),
    publicNavBackground: normalizeBackgroundStyle(input?.publicNavBackground, DEFAULT_STATS_STYLE.publicNavBackground),
    publicNavBorderRadius: normalizeInt(input?.publicNavBorderRadius, DEFAULT_STATS_STYLE.publicNavBorderRadius, 0, 999),
    publicNavFontColor: normalizeHex(input?.publicNavFontColor, DEFAULT_STATS_STYLE.publicNavFontColor),
    publicNavFontSize: normalizeInt(input?.publicNavFontSize, DEFAULT_STATS_STYLE.publicNavFontSize, 8, 72),
    publicNavFontStyle: normalizeFontStyle(input?.publicNavFontStyle, DEFAULT_STATS_STYLE.publicNavFontStyle),
    publicNavInactive: normalizeNavItemStyle(input?.publicNavInactive, DEFAULT_STATS_STYLE.publicNavInactive),
    publicNavHover: normalizeNavItemStyle(input?.publicNavHover, DEFAULT_STATS_STYLE.publicNavHover),
    publicNavActive: normalizeNavItemStyle(input?.publicNavActive, DEFAULT_STATS_STYLE.publicNavActive),
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

export function getBackgroundStyleCss(surface?: StatsBackgroundStyle | string | null): CSSProperties {
  const resolvedSurface = normalizeBackgroundStyle(surface, DEFAULT_STATS_STYLE.background);

  if (resolvedSurface.mode === "image" && resolvedSurface.imageUrl) {
    return {
      backgroundColor: resolvedSurface.color,
      backgroundImage: `url("${resolvedSurface.imageUrl.replace(/"/g, "\\\"")}")`,
      backgroundPosition: "center",
      backgroundRepeat: resolvedSurface.imageFit === "repeat" ? "repeat" : "no-repeat",
      backgroundSize: resolvedSurface.imageFit === "repeat" ? "auto" : "cover",
    };
  }

  if (resolvedSurface.mode === "gradient") {
    const colors = resolvedSurface.gradientColors.length >= 2
      ? resolvedSurface.gradientColors
      : [resolvedSurface.color, resolvedSurface.color];
    return {
      backgroundColor: colors[0],
      backgroundImage: `linear-gradient(${resolvedSurface.gradientDirection}, ${colors.join(", ")})`,
    };
  }

  return { backgroundColor: resolvedSurface.color };
}
