import type { Db } from "mongodb";
import { getStatsStyleForUploader } from "@/lib/statsStyle";
import { ensureAuthCollections, ensureGameCollections, getDb, type UserDoc } from "@/lib/db";
import { GLOBAL_ALIASES_CREATED_BY, orderAliasesByPrecedence, usesGlobalAliases } from "@/lib/aliases";
import { findPublicStatsUser } from "@/lib/publicStatsUser";
import { normalizeVisibleWheelDealers, type WheelSettingsDoc } from "@/lib/wheelSettings";
import { normalizePublicStatsRootGame, type PublicStatsGame } from "@/lib/publicStatsRoutes";
import type { WheelStatsAliasRow, WheelStatsGameRow, WheelStatsPresetRow, WheelStatsPrizeRow } from "@/lib/wheelStats";

type StatsPageStyle = Awaited<ReturnType<typeof getStatsStyleForUploader>>;

export type WheelAliasRow = WheelStatsAliasRow & { createdBy?: string };

export type WheelPageData = {
  displayName: string;
  username: string;
  uploaderId: string;
  games: WheelStatsGameRow[];
  presets: WheelStatsPresetRow[];
  prizes: WheelStatsPrizeRow[];
  aliases: WheelAliasRow[];
  publicStatsRootGame: PublicStatsGame;
  style: StatsPageStyle;
};

export type LoadStatsResult = { ok: false } | ({ ok: true } & WheelPageData);

/** Everything the public wheel page needs for one host, looked up by public name. */
export async function loadWheelStatsByDisplayName(displayName: string): Promise<LoadStatsResult> {
  await ensureAuthCollections();
  await ensureGameCollections();

  const db = await getDb();
  const { user, displayName: dn, normalizedDisplayName: dnNorm } = await findPublicStatsUser(db, displayName);
  if (!dn || !user?._id) return { ok: false };

  void db.collection("traffic").insertOne({ userId: user._id, at: new Date() });

  const data = await loadWheelStatsForUser(db, user, { displayName: dn, username: dnNorm });
  return { ok: true, ...data };
}

/**
 * The same data for a known user, used by the public page and the live
 * editor. Does not count traffic; the public page does that itself.
 */
export async function loadWheelStatsForUser(
  db: Db,
  user: UserDoc,
  fallback: { displayName: string; username: string }
): Promise<WheelPageData> {
  if (!user._id) throw new Error("User has no id");

  const users = db.collection<UserDoc>("users");
  const gamesTable = db.collection("wheel_games");
  const presetsTable = db.collection("wheel_presets");
  const prizesTable = db.collection("wheel_prizes");
  const settingsTable = db.collection<WheelSettingsDoc>("wheel_settings");
  const aliasesTable = db.collection("aliases");

  const uploaderId = user._id.toHexString();
  const includeGlobalAliases = usesGlobalAliases(user);
  const settings = await settingsTable.findOne({ uploaderId }, { projection: { visibleDealers: 1 } });
  const visibleDealers = normalizeVisibleWheelDealers(settings?.visibleDealers);

  // Like Scratch: only games hosted by a dealer the host has ticked in
  // the wheel settings are shown publicly.
  const [games, presets, prizes, aliases, style, nameDoc] = await Promise.all([
    gamesTable
      .find(
        { uploaderId, dealer: { $in: visibleDealers } },
        {
          projection: {
            _id: 1,
            playerName: 1,
            archivedAt: 1,
            preset: 1,
            presetId: 1,
            maxSpins: 1,
            spinsUsed: 1,
            spinsPaid: 1,
            spinCost: 1,
            prizesWon: 1,
          },
        }
      )
      .toArray(),
    presetsTable.find({ uploaderId }, { projection: { _id: 1, name: 1, version: 1, segments: 1 } }).toArray(),
    prizesTable.find({ uploaderId }, { projection: { _id: 0, prize: 1, value: 1 } }).toArray(),
    aliasesTable
      .find(
        includeGlobalAliases
          ? { createdBy: { $in: [GLOBAL_ALIASES_CREATED_BY, uploaderId] } }
          : { createdBy: uploaderId },
        { projection: { primaryTag: 1, aliasTag: 1, createdBy: 1 } }
      )
      .toArray(),
    getStatsStyleForUploader(uploaderId, db),
    users.findOne({ _id: user._id }, { projection: { name: 1, username: 1 } }),
  ]);

  return {
    displayName: nameDoc?.name ?? user.name ?? user.username ?? fallback.displayName,
    username: user.username ?? fallback.username,
    uploaderId,
    games: games as WheelStatsGameRow[],
    presets: presets as WheelStatsPresetRow[],
    prizes: prizes as WheelStatsPrizeRow[],
    aliases: orderAliasesByPrecedence(aliases as WheelAliasRow[], uploaderId),
    publicStatsRootGame: normalizePublicStatsRootGame(user.publicStatsRootGame),
    style,
  };
}
