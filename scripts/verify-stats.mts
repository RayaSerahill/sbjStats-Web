/**
 * Read-only consistency check for repaired game data: money identity,
 * dedupeKey/handPayout coverage, stats_* reconciliation against games, and
 * per-uploader dedupe uniqueness. Run after scripts/repair-games.mts:
 *   npm run verify:stats
 */
import { MongoClient } from "mongodb";

const client = new MongoClient(process.env.MONGODB_URI!);
await client.connect();
const db = client.db(process.env.MONGODB_DB ?? "gamba");
console.log("verifying db:", db.databaseName);

const games = db.collection("games");

// 1. Identity + repair-marker coverage over all cards games.
const [cover] = await games.aggregate([
  { $match: { gameType: "cards" } },
  { $group: {
      _id: null,
      games: { $sum: 1 },
      badIdentity: { $sum: { $cond: [{ $ne: ["$profit", { $subtract: ["$collected", "$paidOut"] }] }, 1, 0] } },
      missingDedupe: { $sum: { $cond: [{ $eq: [{ $type: "$dedupeKey" }, "missing"] }, 1, 0] } },
      missingRepairPrev: { $sum: { $cond: [{ $eq: [{ $type: "$repair.prev" }, "missing"] }, 1, 0] } },
      version2: { $sum: { $cond: [{ $eq: ["$integrity.version", 2] }, 1, 0] } },
  } },
]).toArray();
console.log("coverage:", cover);

// 2. handPayout present on every entry.
const missingHand = await games.countDocuments({ gameType: "cards", players: { $elemMatch: { handPayout: { $exists: false } } } });
console.log("games with any entry missing handPayout:", missingHand);

// 3. stats_host vs games, per uploader+host.
const fromGames = await games.aggregate([
  { $match: { gameType: "cards" } },
  { $group: { _id: { u: "$uploaderId", h: "$hostId" }, games: { $sum: 1 }, profit: { $sum: "$profit" } } },
]).toArray();
const hosts = await db.collection("stats_host").find({}).toArray();
const hostMap = new Map(hosts.map((h) => [`${h.uploaderId} ${h.hostId}`, h]));
let hostMismatch = 0;
for (const g of fromGames) {
  const h = hostMap.get(`${g._id.u} ${g._id.h}`);
  if (!h || h.gamesHosted !== g.games || h.net !== -g.profit) {
    hostMismatch++;
    console.log("host mismatch:", g._id, { statsNet: h?.net, gamesNetExpected: -g.profit, statsGames: h?.gamesHosted, games: g.games });
  }
}
console.log("host rows checked:", fromGames.length, "mismatches:", hostMismatch, "stats_host docs:", hosts.length);

// 4. stats_player net reconciles with host net per uploader.
const perUploaderPlayers = await db.collection("stats_player").aggregate([
  { $group: { _id: "$uploaderId", net: { $sum: "$net" } } },
]).toArray();
const perUploaderHosts = new Map<string, number>();
for (const h of hosts) {
  perUploaderHosts.set(h.uploaderId, (perUploaderHosts.get(h.uploaderId) ?? 0) + h.net);
}
let playerMismatch = 0;
for (const row of perUploaderPlayers) {
  if ((perUploaderHosts.get(row._id) ?? NaN) !== row.net) {
    playerMismatch++;
    console.log("player/host net mismatch for uploader", row._id, row.net, perUploaderHosts.get(row._id));
  }
}
console.log("uploader player-net rows checked:", perUploaderPlayers.length, "mismatches:", playerMismatch);

// 5. dedupeKey uniqueness per uploader + index present.
const dupes = await games.aggregate([
  { $match: { dedupeKey: { $exists: true } } },
  { $group: { _id: { u: "$uploaderId", k: "$dedupeKey" }, n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
  { $count: "dupes" },
]).toArray();
console.log("duplicate (uploaderId, dedupeKey) pairs:", dupes[0]?.dupes ?? 0);
console.log("games indexes:", (await games.indexes()).map((i) => i.name).join(", "));

await client.close();
