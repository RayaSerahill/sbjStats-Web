/**
 * Phase 2 data repair — recomputes game money from stored payloads, backfills
 * dedupeKey + per-hand payouts, and rebuilds the stats_* collections.
 *
 * Usage:
 *   npm run repair -- --dry-run     # report only, writes nothing
 *   npm run repair                  # apply (gamba_test only)
 *   npm run repair -- --allow-prod  # required to run against any other db
 *
 * ALWAYS take a backup before applying to production:
 *   mongodump --uri "$MONGODB_URI" --db gamba --out backups/$(date +%Y%m%d-%H%M%S)
 */
import { MongoClient } from "mongodb";
import { repairGames } from "@/lib/statsRepair";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowProd = args.has("--allow-prod");

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (run via npm run repair so --env-file=.env is applied)");
  process.exit(1);
}
const dbName = process.env.MONGODB_DB ?? "gamba";

if (dbName !== "gamba_test" && !allowProd) {
  console.error(`Refusing to run against database "${dbName}".`);
  console.error(`Rehearse on gamba_test first; pass --allow-prod (after a mongodump backup!) to run here.`);
  process.exit(1);
}

const fmt = new Intl.NumberFormat("en-US");
const money = (n: number) => fmt.format(n);

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  console.log(`Repairing "${dbName}"${dryRun ? " (dry-run, nothing will be written)" : ""}...`);

  const started = Date.now();
  const report = await repairGames({ db, dryRun });

  if (!dryRun) {
    // Backfill is done; make the per-uploader dedupe index exist here and now
    // (same definition as ensureGameCollections).
    const games = db.collection("games");
    await games.createIndex(
      { uploaderId: 1, dedupeKey: 1 },
      {
        unique: true,
        partialFilterExpression: { uploaderId: { $exists: true }, dedupeKey: { $exists: true } },
      }
    );
    // Phase 3: the legacy global sourceDateTime unique index (which wrongly
    // collides distinct games across uploaders and within the same second) is
    // only safe to drop once every doc carries a dedupeKey.
    const unbackfilled = await games.findOne({ dedupeKey: { $exists: false } }, { projection: { _id: 1 } });
    if (unbackfilled) {
      console.warn("Some games still lack dedupeKey; keeping the legacy sourceDateTime index.");
    } else {
      await games.dropIndex("sourceDateTime_1").catch(() => {});
      console.log("Legacy global sourceDateTime index dropped (per-uploader dedupe now governs imports).");
    }
  }

  console.log(`\nDone in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`  scanned:           ${report.scanned}`);
  console.log(`  repaired:          ${report.repaired}${dryRun ? " (would be)" : ""}`);
  console.log(`  already correct:   ${report.alreadyCorrect}`);
  console.log(`  duplicates removed:${String(report.duplicatesRemoved).padStart(7)}${dryRun ? " (would be)" : ""} (same round stored more than once, e.g. live + CSV re-import)`);
  console.log(`  payload fallback:  ${report.payloadFallback} (no payloadBase64; handPayout derived from stored entries)`);
  console.log(`  dedupe collisions: ${report.dedupeCollisions}`);
  console.log(`  anomalies:         ${report.anomalies.length}`);
  for (const a of report.anomalies.slice(0, 20)) console.log(`    - game ${a.gameId}: ${a.reason}`);
  if (report.anomalies.length > 20) console.log(`    ... and ${report.anomalies.length - 20} more`);

  console.log(`\nPer-uploader money (house profit):`);
  console.log(`  uploaderId                | games  | profit before   | profit after    | delta`);
  for (const row of report.perUploader) {
    const delta = row.profitAfter - row.profitBefore;
    console.log(
      `  ${row.uploaderId.padEnd(25)} | ${String(row.games).padStart(6)} | ${money(row.profitBefore).padStart(15)} | ${money(row.profitAfter).padStart(15)} | ${money(delta).padStart(15)}`
    );
  }

  console.log(
    `\nStats rebuild${dryRun ? " (skipped in dry-run)" : ""}: ${report.statsDocs.players} players, ${report.statsDocs.hosts} hosts, ${report.statsDocs.combos} combos`
  );

  // Validation: per uploader the stored identity must now hold.
  let violations = 0;
  for (const row of report.perUploader) {
    if (row.profitAfter !== row.collected - row.paidOut) {
      violations++;
      console.error(`  VALIDATION FAILED for uploader ${row.uploaderId}: profit != collected - paidOut`);
    }
  }
  console.log(violations === 0 ? "\nValidation OK: profit === collected - paidOut for every uploader." : `\n${violations} validation failures!`);
  process.exitCode = violations === 0 ? 0 : 2;
} finally {
  await client.close();
}
