export type PublicStatsGame = "blackjack" | "scratch";

export const DEFAULT_PUBLIC_STATS_ROOT_GAME: PublicStatsGame = "blackjack";

export const PUBLIC_STATS_GAME_OPTIONS: Array<{ key: PublicStatsGame; label: string }> = [
  { key: "blackjack", label: "Blackjack" },
  { key: "scratch", label: "Scratch" },
];

export function isPublicStatsGame(value: unknown): value is PublicStatsGame {
  return value === "blackjack" || value === "scratch";
}

export function normalizePublicStatsRootGame(value: unknown): PublicStatsGame {
  return isPublicStatsGame(value) ? value : DEFAULT_PUBLIC_STATS_ROOT_GAME;
}

export function publicStatsRootGameValidationMessage(value: unknown) {
  return isPublicStatsGame(value) ? null : "Stats root game must be blackjack or scratch";
}

export function otherPublicStatsGame(game: PublicStatsGame): PublicStatsGame {
  return game === "blackjack" ? "scratch" : "blackjack";
}

export function publicStatsGameLabel(game: PublicStatsGame) {
  return PUBLIC_STATS_GAME_OPTIONS.find((option) => option.key === game)?.label ?? game;
}

export function publicStatsGamePath(publicName: string, game: PublicStatsGame, rootGame: unknown) {
  const root = normalizePublicStatsRootGame(rootGame);
  const encodedName = encodeURIComponent(publicName);
  return game === root ? `/${encodedName}` : `/${encodedName}/${game}`;
}
