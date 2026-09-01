import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ground-truth reader for test.csv.
 *
 * The report uses European formatting: dots as thousand separators
 * ("1.200.000" = 1,200,000). Amount columns relate to the payload like this
 * (verified to hold on every row of test.csv):
 *
 *   Collected = sum of Bet over ALL non-dealer entries (split hands each bet)
 *   Paid out  = sum of Payout over non-dealer entries with SplitNum === 0
 *               (a splitting player's SplitNum 0 entry already carries their
 *                TOTAL payout; SplitNum >= 2 entries repeat the per-hand
 *                payouts and must not be added again)
 *   Profit    = Collected - Paid out   (house perspective)
 */

export const TEST_CSV_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "test.csv"
);

export const EXPECTED_ROWS = 2419;
export const EXPECTED_HOST_PROFIT = 726_945_436;

export type GroundTruthRow = {
  sourceDateTime: string;
  collected: number;
  paidOut: number;
  profit: number;
  entries: any[];
  betSumAllEntries: number;
  payoutSumAllEntries: number;
  payoutSumSplitZero: number;
};

export function parseEuroAmount(input: string): number {
  const cleaned = input.trim().replace(/[.\s  ]/g, "").replace(/,/g, "").replace(/'/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) throw new Error(`Unparseable amount in test.csv: "${input}"`);
  return Math.trunc(n);
}

export function loadTestCsvText(): string {
  return fs.readFileSync(TEST_CSV_PATH, "utf8");
}

export function loadGroundTruth(): GroundTruthRow[] {
  const lines = loadTestCsvText()
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  let cursor = 0;
  let delimiter = ";";
  if (/^sep=/i.test(lines[0])) {
    delimiter = lines[0].slice(4).trim() || ";";
    cursor = 1;
  }

  const headers = lines[cursor].split(delimiter).map((h) => h.trim().toLowerCase());
  const idx = {
    date: headers.findIndex((h) => h.includes("date") && h.includes("time")),
    collected: headers.findIndex((h) => h.includes("collect")),
    paidOut: headers.findIndex((h) => h.includes("paid")),
    profit: headers.findIndex((h) => h.includes("profit")),
    details: headers.findIndex((h) => h.includes("detail")),
  };
  if (Object.values(idx).some((i) => i === -1)) {
    throw new Error(`test.csv is missing an expected column (${JSON.stringify(idx)})`);
  }

  const rows: GroundTruthRow[] = [];
  for (let i = cursor + 1; i < lines.length; i++) {
    const parts = lines[i].split(delimiter).map((v) => v.trim());
    const details = parts[idx.details];
    if (!parts[idx.date] || !details) continue;

    const entries = JSON.parse(Buffer.from(details, "base64").toString("utf8")) as any[];
    const nonDealer = entries.filter((e) => !e.Dealer);

    rows.push({
      sourceDateTime: parts[idx.date],
      collected: parseEuroAmount(parts[idx.collected]),
      paidOut: parseEuroAmount(parts[idx.paidOut]),
      profit: parseEuroAmount(parts[idx.profit]),
      entries,
      betSumAllEntries: nonDealer.reduce((sum, e) => sum + (Number(e.Bet) || 0), 0),
      payoutSumAllEntries: nonDealer.reduce((sum, e) => sum + (Number(e.Payout) || 0), 0),
      payoutSumSplitZero: nonDealer
        .filter((e) => Number(e.SplitNum) === 0)
        .reduce((sum, e) => sum + (Number(e.Payout) || 0), 0),
    });
  }
  return rows;
}
