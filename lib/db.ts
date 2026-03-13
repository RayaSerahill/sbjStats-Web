import type { Db, ObjectId } from "mongodb";
import clientPromise from "./mongodb";

export type UserRole = "owner" | "admin" | "user";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  username?: string;
  role: UserRole;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  apiKeyCreatedAt?: Date;
  deleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const dbName = () => process.env.MONGODB_DB ?? "gamba";

let initPromise: Promise<void> | null = null;
let gameInitPromise: Promise<void> | null = null;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName());
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "owner" || value === "admin" || value === "user";
}

export async function ensureAuthCollections() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      const users = db.collection<UserDoc>("users");
      await users.createIndex({ email: 1 }, { unique: true });
      await users.createIndex({ username: 1 }, { unique: true, sparse: true });
      await users.createIndex({ role: 1, createdAt: -1 });
      await users.createIndex({ createdAt: 1 });
      await users.createIndex({ deleted: 1, updatedAt: -1 }, { sparse: true });
      await users.createIndex({ apiKeyHash: 1 }, { unique: true, sparse: true });
      await users.createIndex({ apiKeyCreatedAt: -1 }, { sparse: true });
    })();
  }

  await initPromise;
}

async function ensureCollection(db: Db, name: string) {
  const existing = await db.listCollections({ name }, { nameOnly: true }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name);
  }
}

/**
 * Ensures collections + indexes used by round ingestion and stats exist.
 *
 * Stats collections are prefixed with "stats_".
 */
export async function ensureGameCollections() {
  if (!gameInitPromise) {
    gameInitPromise = (async () => {
      const db = await getDb();

      await ensureCollection(db, "players");
      await ensureCollection(db, "games");
      await ensureCollection(db, "aliases");
      await ensureCollection(db, "blacklist");
      await ensureCollection(db, "stats_player");
      await ensureCollection(db, "stats_host");
      await ensureCollection(db, "stats_combo");
      await ensureCollection(db, "stats_styles");

      const players = db.collection("players");
      await players.createIndex({ playerTag: 1 }, { unique: true });
      await players.createIndex({ createdAt: -1 });

      const aliases = db.collection("aliases");
      await aliases.dropIndex("aliasTag_1").catch(() => {});
      await aliases.dropIndex("primaryTag_1_aliasTag_1").catch(() => {});
      await aliases.createIndex({ createdBy: 1, aliasTag: 1 }, { unique: true });
      await aliases.createIndex({ createdBy: 1, primaryTag: 1, aliasTag: 1 }, { unique: true });
      await aliases.createIndex({ createdBy: 1, primaryTag: 1 });
      await aliases.createIndex({ createdBy: 1, createdAt: -1 });

      const blacklist = db.collection("blacklist");
      await blacklist.dropIndex("playerTag_1").catch(() => {});
      await blacklist.createIndex({ createdBy: 1, playerTag: 1 }, { unique: true });
      await blacklist.createIndex({ createdBy: 1, createdAt: -1 });

      const games = db.collection("games");
      await games.createIndex({ createdAt: -1 });
      // Used to dedupe CSV imports ("Date and time" column). Sparse so manual imports without this field still work.
      await games.createIndex({ sourceDateTime: 1 }, { unique: true, sparse: true });
      await games.createIndex({ uploaderId: 1, createdAt: -1 });
      await games.createIndex({ hostId: 1, createdAt: -1 });
      await games.createIndex({ "players.playerId": 1, createdAt: -1 });
      await games.createIndex({ "players.comboKey": 1, createdAt: -1 });

      const statsPlayer = db.collection("stats_player");
      // Stats are user-scoped: the same playerId/comboKey/hostId can exist under different uploaders.
      // Use partial unique compound indexes so legacy docs (without uploaderId) don't block index creation.
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

      const statsStyles = db.collection("stats_styles");
      await statsStyles.createIndex({ uploaderId: 1 }, { unique: true });
      await statsStyles.createIndex({ updatedAt: -1 });
    })();
  }

  await gameInitPromise;
}
