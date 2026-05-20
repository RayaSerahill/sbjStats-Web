export type ScratchSettingsDoc = {
  uploaderId: string;
  visibleDealers: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export function normalizeScratchDealerName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeVisibleScratchDealers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  for (const item of value) {
    const dealer = normalizeScratchDealerName(item);
    if (dealer) seen.add(dealer);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
