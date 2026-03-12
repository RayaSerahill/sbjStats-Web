import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Missing MONGODB_URI");
  process.exit(1);
}

const dbName = process.env.MONGODB_DB ?? "app";

const client = new MongoClient(uri, {
  appName: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "nextjs-app",
});

const run = async () => {
  await client.connect();
  const db = client.db(dbName);

  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true });
  await users.createIndex({ createdAt: 1 });
  await users.createIndex({ apiKeyHash: 1 }, { unique: true, sparse: true });
  await users.createIndex({ apiKeyCreatedAt: -1 }, { sparse: true });

  const players = db.collection("players");
  await players.createIndex({ playerTag: 1 }, { unique: true });
  await players.createIndex({ createdAt: -1 });

  const aliases = db.collection("aliases");
  await aliases.createIndex({ aliasTag: 1 }, { unique: true });
  await aliases.createIndex({ primaryTag: 1, aliasTag: 1 }, { unique: true });
  await aliases.createIndex({ primaryTag: 1 });
  await aliases.createIndex({ createdAt: -1 });

  const blacklist = db.collection("blacklist");
  await blacklist.createIndex({ playerTag: 1 }, { unique: true });
  await blacklist.createIndex({ createdAt: -1 });

  const games = db.collection("games");
  await games.createIndex({ createdAt: -1 });
  await games.createIndex({ sourceDateTime: 1 }, { unique: true, sparse: true });
  await games.createIndex({ uploaderId: 1, createdAt: -1 });
  await games.createIndex({ hostId: 1, createdAt: -1 });
  await games.createIndex({ "players.playerId": 1, createdAt: -1 });
  await games.createIndex({ "players.comboKey": 1, createdAt: -1 });

  const statsPlayer = db.collection("stats_player");
  await statsPlayer.createIndex(
    { uploaderId: 1, playerId: 1 },
    {
      unique: true,
      partialFilterExpression: { uploaderId: { $exists: true }, playerId: { $exists: true } },
    }
  );
  await statsPlayer.createIndex({ uploaderId: 1, updatedAt: -1 });
  await statsPlayer.createIndex({ uploaderId: 1, games: -1 });

  const statsHost = db.collection("stats_host");
  await statsHost.createIndex(
    { uploaderId: 1, hostId: 1 },
    {
      unique: true,
      partialFilterExpression: { uploaderId: { $exists: true }, hostId: { $exists: true } },
    }
  );
  await statsHost.createIndex({ uploaderId: 1, updatedAt: -1 });
  await statsHost.createIndex({ uploaderId: 1, gamesHosted: -1 });
  await statsHost.createIndex({ ownedBy: 1, updatedAt: -1 });

  const statsCombo = db.collection("stats_combo");
  await statsCombo.createIndex(
    { uploaderId: 1, comboKey: 1 },
    {
      unique: true,
      partialFilterExpression: { uploaderId: { $exists: true }, comboKey: { $exists: true } },
    }
  );
  await statsCombo.createIndex({ uploaderId: 1, updatedAt: -1 });
  await statsCombo.createIndex({ uploaderId: 1, seen: -1 });

  const books = db.collection("books");
  await books.createIndex(
    { uploaderId: 1, key: 1 },
    {
      unique: true,
      partialFilterExpression: { uploaderId: { $exists: true }, key: { $exists: true } },
    }
  );
  await books.createIndex({ uploaderId: 1, createdAt: -1 });
  await books.createIndex({ uploaderId: 1, updatedAt: -1 });
  await books.createIndex({ uploaderId: 1, status: 1, updatedAt: -1 });
  await books.createIndex({ uploaderId: 1, favourite: 1, updatedAt: -1 });
  await books.createIndex({ uploaderId: 1, finishDate: -1 }, { sparse: true });
  await books.createIndex({ uploaderId: 1, rating10: -1, updatedAt: -1 }, { sparse: true });
  await books.createIndex({ uploaderId: 1, title: 1 });
  await books.createIndex({ uploaderId: 1, author: 1 });
  await books.createIndex({ uploaderId: 1, additionalTags: 1 }, { sparse: true });

  console.log(`OK: indexes ready in db "${dbName}" (users, games, players, aliases, blacklist, stats_*, books)`);
};

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.close();
  });
