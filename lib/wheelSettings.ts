export type WheelSettingsDoc = {
  uploaderId: string;
  /** Dealer (host character) names whose games show on the public wheel page. */
  visibleDealers: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export function normalizeWheelDealerName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeVisibleWheelDealers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  for (const item of value) {
    const dealer = normalizeWheelDealerName(item);
    if (dealer) seen.add(dealer);
  }

  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}
