import type { Db, ObjectId } from "mongodb";
import clientPromise from "./mongodb";

export type UserRole = "owner" | "admin" | "dealer";
export type WhitelistEntryType = "email" | "discord";
export type TeamGameKey = "blackjack" | "scratch";
export type TeamMemberRole = "owner" | "member";
export type TeamInviteStatus = "pending" | "accepted" | "declined";
export type TeamTheme = "light" | "dark";

export type UserDoc = {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  name?: string;
  username?: string;
  discord?: string;
  role: UserRole;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  apiKeyCreatedAt?: Date;
  useGlobalAliases?: boolean;
  deleted?: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type WhitelistEntryDoc = {
  _id?: ObjectId;
  type: WhitelistEntryType;
  value: string;
  createdBy: string;
  createdAt: Date;
};

export type TeamDoc = {
  _id?: ObjectId;
  name: string;
  slug: string;
  description?: string;
  theme?: TeamTheme;
  accentColor?: string;
  ownerId: string;
  enabledGames: TeamGameKey[];
  createdAt: Date;
  updatedAt: Date;
};

export type TeamMemberDoc = {
  _id?: ObjectId;
  teamId: ObjectId;
  userId: string;
  role: TeamMemberRole;
  joinedAt: Date;
};

export type TeamInviteDoc = {
  _id?: ObjectId;
  teamId: ObjectId;
  inviterId: string;
  inviteeId: string;
  inviteeUsername: string;
  status: TeamInviteStatus;
  createdAt: Date;
  respondedAt?: Date;
};

const dbName = () => process.env.MONGODB_DB ?? "gamba";

let initPromise: Promise<void> | null = null;
let gameInitPromise: Promise<void> | null = null;
let teamInitPromise: Promise<void> | null = null;

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName());
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "owner" || value === "admin" || value === "dealer";
}

export function isWhitelistEntryType(value: unknown): value is WhitelistEntryType {
  return value === "email" || value === "discord";
}

export async function ensureAuthCollections() {
  if (!initPromise) {
    initPromise = (async () => {
      const db = await getDb();
      const users = db.collection<UserDoc>("users");
      const whitelist = db.collection<WhitelistEntryDoc>("whitelist");
      await users.createIndex({ email: 1 }, { unique: true });
      await users.createIndex({ username: 1 }, { unique: true, sparse: true });
      await users.createIndex({ discord: 1 }, { unique: true, sparse: true });
      await users.createIndex({ role: 1, createdAt: -1 });
      await users.createIndex({ createdAt: 1 });
      await users.createIndex({ deleted: 1, updatedAt: -1 }, { sparse: true });
      await users.createIndex({ apiKeyHash: 1 }, { unique: true, sparse: true });
      await users.createIndex({ apiKeyCreatedAt: -1 }, { sparse: true });
      await whitelist.createIndex({ type: 1, value: 1 }, { unique: true });
      await whitelist.createIndex({ createdAt: -1 });
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
      await ensureCollection(db, "scratch_games");
      await ensureCollection(db, "scratch_prizes");

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

      const scratchGames = db.collection("scratch_games");
      await scratchGames.createIndex(
        { uploaderId: 1, playerName: 1, archivedAt: 1 },
        {
          unique: true,
          partialFilterExpression: {
            uploaderId: { $exists: true },
            playerName: { $exists: true },
            archivedAt: { $exists: true },
          },
        }
      );
      await scratchGames.createIndex({ uploaderId: 1, archivedAt: -1 });
      await scratchGames.createIndex({ uploaderId: 1, playerName: 1, archivedAt: -1 });

      const scratchPrizes = db.collection("scratch_prizes");
      await scratchPrizes.createIndex(
        { uploaderId: 1, prize: 1 },
        {
          unique: true,
          partialFilterExpression: {
            uploaderId: { $exists: true },
            prize: { $exists: true },
          },
        }
      );
      await scratchPrizes.createIndex({ uploaderId: 1, updatedAt: -1 }, { sparse: true });
    })();
  }

  await gameInitPromise;
}

export async function ensureTeamCollections() {
  if (!teamInitPromise) {
    teamInitPromise = (async () => {
      const db = await getDb();

      await ensureCollection(db, "teams");
      await ensureCollection(db, "team_members");
      await ensureCollection(db, "team_invites");

      const teams = db.collection<TeamDoc>("teams");
      await teams.createIndex({ slug: 1 }, { unique: true });
      await teams.createIndex({ ownerId: 1 }, { unique: true });
      await teams.createIndex({ updatedAt: -1 });

      const teamMembers = db.collection<TeamMemberDoc>("team_members");
      await teamMembers.createIndex({ teamId: 1, userId: 1 }, { unique: true });
      await teamMembers.createIndex({ userId: 1, joinedAt: -1 });
      await teamMembers.createIndex({ teamId: 1, joinedAt: 1 });

      const teamInvites = db.collection<TeamInviteDoc>("team_invites");
      await teamInvites.createIndex({ inviteeId: 1, status: 1, createdAt: -1 });
      await teamInvites.createIndex({ teamId: 1, createdAt: -1 });
      await teamInvites.createIndex(
        { teamId: 1, inviteeId: 1, status: 1 },
        {
          unique: true,
          partialFilterExpression: { status: "pending" },
        }
      );
    })();
  }

  await teamInitPromise;
}
