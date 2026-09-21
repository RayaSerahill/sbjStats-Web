import type { StatsBackgroundStyle } from "./statsStyleShared";

/**
 * Colours and surfaces of the Fortune wheel layout. Every surface is a
 * StatsBackgroundStyle so it can be a colour, an image or a gradient,
 * and every key maps to one element hosts can click in the live editor.
 */
export const FORTUNE_SURFACE_KEYS = [
  "page",
  "nav",
  "navActive",
  "host",
  "banner",
  "card",
  "toneLavender",
  "toneMint",
  "tonePink",
  "tonePeach",
  "toneYellow",
  "toneSky",
  "tableHead",
  "tableSorted",
  "podium",
] as const;

export type FortuneSurfaceKey = (typeof FORTUNE_SURFACE_KEYS)[number];

export const FORTUNE_COLOR_KEYS = ["ink", "muted", "accent", "accentText", "chartGames", "chartGil"] as const;

export type FortuneColorKey = (typeof FORTUNE_COLOR_KEYS)[number];

export type FortuneTheme = {
  surfaces: Record<FortuneSurfaceKey, StatsBackgroundStyle>;
  colors: Record<FortuneColorKey, string>;
};

export const FORTUNE_SURFACE_LABELS: Record<FortuneSurfaceKey, { label: string; hint: string }> = {
  page: { label: "Page background", hint: "The sky behind everything." },
  nav: { label: "Nav bar", hint: "The pill bar holding the game links." },
  navActive: { label: "Active nav pill", hint: "The link for the page you are on." },
  host: { label: "Host name pill", hint: "The little pill with your name." },
  banner: { label: "Title banner", hint: "The Wheel of Fortune Stats box." },
  card: { label: "Cards", hint: "The body of every stat, chart and leaderboard card." },
  toneLavender: { label: "Lavender card header", hint: "Total games and friends." },
  toneMint: { label: "Mint card header", hint: "Total spins and the biggest winner." },
  tonePink: { label: "Pink card header", hint: "Total gil and the most bankrupt." },
  tonePeach: { label: "Peach card header", hint: "Most games played." },
  toneYellow: { label: "Yellow card header", hint: "Top prize and the luckiest spinner." },
  toneSky: { label: "Sky card header", hint: "Players and the little pills." },
  tableHead: { label: "Table header", hint: "Column titles on the leaderboard table." },
  tableSorted: { label: "Sorted column", hint: "The highlighted column on the leaderboard table." },
  podium: { label: "First place row", hint: "Top row of both leaderboard lists." },
};

export const FORTUNE_COLOR_LABELS: Record<FortuneColorKey, string> = {
  ink: "Text",
  muted: "Muted text",
  accent: "Accent borders",
  accentText: "Accent text",
  chartGames: "Games chart",
  chartGil: "Gil chart",
};

const solid = (color: string): StatsBackgroundStyle => ({
  mode: "color",
  color,
  imageUrl: "",
  imageFit: "cover",
  gradientColors: [color, color],
  gradientDirection: "to bottom",
});

const gradient = (colors: string[]): StatsBackgroundStyle => ({
  mode: "gradient",
  color: colors[0],
  imageUrl: "",
  imageFit: "cover",
  gradientColors: colors,
  gradientDirection: "to bottom",
});

export const DEFAULT_FORTUNE_THEME: FortuneTheme = {
  surfaces: {
    page: gradient(["#ece5ff", "#f7ebfb", "#dbeeff"]),
    nav: solid("#ffffff"),
    navActive: solid("#d4f4ea"),
    host: solid("#d4f4ea"),
    banner: solid("#ffffff"),
    card: solid("#ffffff"),
    toneLavender: solid("#e9ddff"),
    toneMint: solid("#d4f4ea"),
    tonePink: solid("#ffd9e8"),
    tonePeach: solid("#ffe3cf"),
    toneYellow: solid("#fff1bf"),
    toneSky: solid("#d8ebff"),
    tableHead: solid("#faf8ff"),
    tableSorted: solid("#ffd9e8"),
    podium: solid("#d4f4ea"),
  },
  colors: {
    ink: "#3a3454",
    muted: "#7b7497",
    accent: "#33b7a4",
    accentText: "#1f9a89",
    chartGames: "#a78bfa",
    chartGil: "#f2b93c",
  },
};
