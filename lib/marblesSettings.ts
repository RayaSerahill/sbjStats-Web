/**
 * Which of a dealer's host characters appear on their public marbles page.
 *
 * Scratch and wheel settings list the characters to show, because their
 * uploads carry everyone's games. Marbles already knows which games are the
 * dealer's own (`mine`), so every own game is public by default and the
 * settings only record the characters the dealer has taken off the page. A
 * character that hosts for the first time shows up without anyone ticking it.
 */
export type MarblesSettingsDoc = {
  uploaderId: string;
  /** Host characters ("Name@World") whose games stay off the public marbles page. */
  hiddenHosts: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export function normalizeMarblesHostName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A game's host as shown and stored in the settings: "Name@World", or the
 * bare name when the world is unknown. Empty when the game has no host name.
 */
export function marblesHostName(name: unknown, world: unknown): string {
  const hostName = normalizeMarblesHostName(name);
  if (!hostName) return "";
  const hostWorld = normalizeMarblesHostName(world);
  return hostWorld ? `${hostName}@${hostWorld}` : hostName;
}

export function normalizeHiddenMarblesHosts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  for (const item of value) {
    const host = normalizeMarblesHostName(item);
    if (host) seen.add(host);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/** The games left once every hidden host's games are taken out. Games with no host name always stay. */
export function withoutHiddenMarblesHosts<T extends { creatorName?: string | null; creatorWorld?: string | null }>(
  games: T[],
  hiddenHosts: string[]
): T[] {
  if (hiddenHosts.length === 0) return games;

  const hidden = new Set(hiddenHosts);
  return games.filter((game) => {
    const host = marblesHostName(game.creatorName, game.creatorWorld);
    return !host || !hidden.has(host);
  });
}
