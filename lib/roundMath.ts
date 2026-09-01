import { createHash } from "node:crypto";
import type { RawRoundEntry } from "@/lib/gameIngest";

// Result encoding from game base64 details:
// Bust=0, Win=1, Draw=2, Loss=3, Surrender=6
// For stats: Bust/Loss/Surrender => loss, Draw => draw, Win => win.
export function outcomeBuckets(result: number) {
  const r = Number(result);
  if (r === 1) return { wins: 1, losses: 0, pushes: 0, other: 0 };
  if (r === 2) return { wins: 0, losses: 0, pushes: 1, other: 0 };
  if (r === 0 || r === 3 || r === 6) return { wins: 0, losses: 1, pushes: 0, other: 0 };
  return { wins: 0, losses: 0, pushes: 0, other: 1 };
}

/**
 * Per-hand payouts for a round's raw entries.
 *
 * When a player splits, their SplitNum 0 entry carries the TOTAL payout for
 * all of their hands, while the SplitNum >= 2 entries repeat each split hand
 * individually (verified against the report's Collected/Paid out columns on
 * every row of a full report). The primary entry's per-hand payout is
 * therefore its payout minus the split entries' payouts, so summing
 * handPayout over a player's entries yields their true total exactly once.
 *
 * Grouping uses the raw PlayerName (before the " [n]" instance marker is
 * stripped) so two different seats sharing a display name never mix.
 *
 * Returns one handPayout per entry, index-aligned with the input.
 */
export function computeHandPayouts(entries: RawRoundEntry[]): number[] {
  const payoutOf = (e: RawRoundEntry) => (Number.isFinite(Number(e?.Payout)) ? Number(e.Payout) : 0);
  const handPayouts = entries.map(payoutOf);

  const seats = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (!e || e.Dealer) return;
    const key = String(e.PlayerName);
    const list = seats.get(key);
    if (list) list.push(i);
    else seats.set(key, [i]);
  });

  for (const indexes of seats.values()) {
    const splitIndexes = indexes.filter((i) => Number(entries[i].SplitNum) >= 2);
    if (splitIndexes.length === 0) continue;
    const primary = indexes.find((i) => !(Number(entries[i].SplitNum) >= 2));
    if (primary === undefined) continue;
    const splitTotal = splitIndexes.reduce((sum, i) => sum + handPayouts[i], 0);
    handPayouts[primary] -= splitTotal;
  }

  return handPayouts;
}

/** Game money totals from parsed entries; the house profit convention matches the report's Profit column. */
export function computeGameTotals(players: Array<{ dealer: boolean; bet: number; handPayout: number }>) {
  let collected = 0;
  let paidOut = 0;
  for (const p of players) {
    if (p.dealer) continue;
    collected += Number(p.bet) || 0;
    paidOut += Number(p.handPayout) || 0;
  }
  return { collected, paidOut, profit: collected - paidOut };
}

/**
 * Aggregation expression for a player entry's payout contribution when
 * summing money per player or per game. Prefers the stored handPayout; for
 * docs not yet repaired it falls back split-aware (only SplitNum 0 entries
 * carry a player's payout, and that entry holds their total), so sums stay
 * correct either way. Per-entry note: for an unrepaired splitting player the
 * fallback attributes the whole total to the primary entry — exact for sums,
 * which is all read paths use it for.
 */
export function handPayoutExpr(playersPath = "$players") {
  return {
    $ifNull: [
      `${playersPath}.handPayout`,
      {
        $cond: [
          { $eq: [{ $ifNull: [`${playersPath}.splitNum`, 0] }, 0] },
          { $ifNull: [`${playersPath}.payout`, 0] },
          0,
        ],
      },
    ],
  };
}

/** JS twin of handPayoutExpr for code that sums stored player entries. */
export function displayHandPayout(p: { handPayout?: number; splitNum?: number; payout?: number }) {
  if (typeof p?.handPayout === "number") return p.handPayout;
  return (Number(p?.splitNum) || 0) === 0 ? Number(p?.payout) || 0 : 0;
}

/**
 * Stable per-round dedupe key: timestamp + the exact payload. Scoped per
 * uploader by the { uploaderId, dedupeKey } unique index, so re-importing a
 * report skips existing rounds without one dealer's games shadowing
 * another's.
 */
export function computeDedupeKey(sourceDateTime: string | undefined, payload: string) {
  return createHash("sha256").update(`${sourceDateTime ?? ""}\n${payload}`, "utf8").digest("hex");
}

/** True when the error is (only) MongoDB duplicate-key noise (E11000). */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; writeErrors?: unknown; result?: { result?: { writeErrors?: unknown } } };
  if (e.code === 11000) return true;
  const writeErrors = e.writeErrors ?? e.result?.result?.writeErrors;
  return (
    Array.isArray(writeErrors) &&
    writeErrors.length > 0 &&
    writeErrors.every((we) => typeof we === "object" && we !== null && (we as { code?: unknown }).code === 11000)
  );
}
