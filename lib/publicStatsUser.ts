import type { Db } from "mongodb";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import { normalizePublicStatsRootGame, type PublicStatsGame } from "@/lib/publicStatsRoutes";

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function norm(input: unknown) {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  return s.normalize("NFKC").trim().toLowerCase();
}

function emailLocalPart(email: unknown) {
  const e = typeof email === "string" ? email : email == null ? "" : String(email);
  const at = e.indexOf("@");
  return at === -1 ? e : e.slice(0, at);
}

export type PublicStatsUserLookup = {
  user: UserDoc | null;
  displayName: string;
  normalizedDisplayName: string;
};

export async function findPublicStatsUser(db: Db, displayName: string): Promise<PublicStatsUserLookup> {
  const users = db.collection<UserDoc>("users");

  let dn = (displayName ?? "").trim();
  try {
    dn = decodeURIComponent(dn);
  } catch {}

  if (!dn) {
    return { user: null, displayName: dn, normalizedDisplayName: "" };
  }

  const dnNorm = norm(dn);

  let user =
    (await users.findOne({ username: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne(
      { name: dn, deleted: { $ne: true } },
      { collation: { locale: "en", strength: 2 } }
    )) ??
    (await users.findOne({
      deleted: { $ne: true },
      $expr: {
        $eq: [
          { $toLower: { $trim: { input: { $ifNull: ["$name", ""] } } } },
          dnNorm,
        ],
      },
    })) ??
    (await users.findOne({ email: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne({
      deleted: { $ne: true },
      $expr: {
        $eq: [
          {
            $toLower: {
              $trim: {
                input: {
                  $ifNull: [
                    { $arrayElemAt: [{ $split: ["$email", "@"] }, 0] },
                    "",
                  ],
                },
              },
            },
          },
          dnNorm,
        ],
      },
    })) ??
    (await users.findOne({ name: { $regex: `^\\s*${escapeRegex(dn)}\\s*$`, $options: "i" }, deleted: { $ne: true } }));

  if (!user?._id) {
    const fallback = await users
      .find({ deleted: { $ne: true } }, { projection: { _id: 1, name: 1, email: 1, username: 1, publicStatsRootGame: 1 } })
      .limit(2000)
      .toArray();
    user =
      fallback.find((u) => norm(u.username) === dnNorm) ??
      fallback.find((u) => norm(u.name) === dnNorm) ??
      fallback.find((u) => norm(u.email) === dnNorm) ??
      fallback.find((u) => norm(emailLocalPart(u.email)) === dnNorm) ??
      null;
  }

  return { user, displayName: dn, normalizedDisplayName: dnNorm };
}

export async function getPublicStatsRootGameForDisplayName(displayName: string): Promise<PublicStatsGame> {
  await ensureAuthCollections();
  const db = await getDb();
  const { user } = await findPublicStatsUser(db, displayName);
  return normalizePublicStatsRootGame(user?.publicStatsRootGame);
}
