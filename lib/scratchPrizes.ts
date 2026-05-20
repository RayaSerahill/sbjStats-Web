const FORMATTED_GIL_PRIZE_RE = /^(\d+(?:\.\d+)?)\s*([km])\s+gil$/i;

export function normalizeScratchPrizeName(value: unknown) {
  return String(value ?? "").trim();
}

export function parseFormattedGilPrizeValue(value: unknown): number | null {
  const prize = normalizeScratchPrizeName(value);
  const match = prize.match(FORMATTED_GIL_PRIZE_RE);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const multiplier = match[2].toLowerCase() === "k" ? 1_000 : 1_000_000;
  const assumedValue = Math.round(amount * multiplier);

  return Number.isSafeInteger(assumedValue) ? assumedValue : null;
}

export function scratchPrizeValue(prizeName: unknown, configuredValue: unknown) {
  if (typeof configuredValue === "number" && Number.isFinite(configuredValue)) {
    return configuredValue;
  }

  return parseFormattedGilPrizeValue(prizeName) ?? 0;
}
