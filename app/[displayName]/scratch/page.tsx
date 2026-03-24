import {getBackgroundStyleCss, getStatsFontFamily} from "@/lib/statsStyleShared";
import { cache } from "react";
import { getStatsStyleForUploader } from "@/lib/statsStyle";
import { getDb, type UserDoc } from "@/lib/db";

const loadStatsCached = cache(loadStats);

type StatsPageStyle = Awaited<ReturnType<typeof getStatsStyleForUploader>>;

type ScratchGameRow = {
  _id: unknown;
  playerName?: string;
  archivedAt?: number;
  totalCards?: number;
  wins?: number;
  prizesWon?: string[];
};

type ScratchPrizeRow = {
  _id: unknown;
  prize?: string;
  value?: number;
};

type AliasRow = {
  primaryTag?: string;
  aliasTag?: string;
};

type BlacklistRow = {
  playerTag?: string;
};

export type LoadStatsResult =
  | { ok: false }
  | {
  ok: true;
  displayName: string;
  username: string;
  uploaderId: string;
  games: ScratchGameRow[];
  prizes: ScratchPrizeRow[];
  aliases: AliasRow[];
  blacklist: BlacklistRow[];
  style: StatsPageStyle;
};

export default async function Scratch({
                                        params,
                                      }: {
  params: Promise<{ displayName: string }>;
}) {
  const { displayName } = await params;
  const result = await loadStatsCached(displayName);

  if (!result.ok) {
    return (
      <div className="container-main min-h-screen w-full px-4 py-10">
        <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
          <div className="flex flex-col gap-2">Not found</div>
        </div>
      </div>
    );
  }

  const style = result.style;
  const fontFamily = getStatsFontFamily(style.fontStyle);
  const pageBackgroundStyle = getBackgroundStyleCss(style.background);
  const containerBackgroundStyle = getBackgroundStyleCss(style.containerBackground);
  const elementBackgroundStyle = getBackgroundStyleCss(style.elementBackground);

  return (
    <div className="container-main min-h-screen w-full px-4 py-10" style={pageBackgroundStyle}>
      <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/10 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]" style={containerBackgroundStyle}>
        <div className="flex flex-col gap-2">
          <h1 className={"text-2xl font-semibold"} style={{ color: style.fontColor }}>{result.displayName}</h1>
        </div>
      </div>
    </div>
  );
}

async function loadStats(displayName: string): Promise<LoadStatsResult> {
  const db = await getDb();

  const users = db.collection<UserDoc>("users");
  const gamesTable = db.collection("scratch_games");
  const prizesTable = db.collection("scratch_prizes");
  const aliasesTable = db.collection("aliases");
  const blacklistTable = db.collection("blacklist");

  let dn = (displayName ?? "").trim();
  try {
    dn = decodeURIComponent(dn);
  } catch {}

  if (!dn) {
    return { ok: false };
  }

  const dnNorm = norm(dn);

  const user =
    (await users.findOne({ username: dnNorm, deleted: { $ne: true } })) ??
    (await users.findOne(
      { name: dn, deleted: { $ne: true } },
      { collation: { locale: "en", strength: 2 } }
    )) ??
    (await users.findOne({ email: dnNorm, deleted: { $ne: true } }));

  if (!user?._id) {
    return { ok: false };
  }

  const uploaderId = user._id.toHexString();

  void db.collection("traffic").insertOne({
    userId: user._id,
    at: new Date(),
  });

  const [games, prizes, aliases, blacklist, style, nameDoc] = await Promise.all([
    gamesTable
      .find(
        { uploaderId },
        {
          projection: {
            _id: 1,
            playerName: 1,
            archivedAt: 1,
            totalCards: 1,
            wins: 1,
            prizesWon: 1,
          },
        }
      )
      .toArray(),
    prizesTable
      .find(
        { uploaderId },
        {
          projection: {
            _id: 1,
            prize: 1,
            value: 1,
          },
        }
      )
      .toArray(),
    aliasesTable
      .find(
        { createdBy: uploaderId },
        {
          projection: {
            primaryTag: 1,
            aliasTag: 1,
          },
        }
      )
      .toArray(),
    blacklistTable
      .find(
        { createdBy: uploaderId },
        {
          projection: {
            playerTag: 1,
          },
        }
      )
      .toArray(),
    getStatsStyleForUploader(uploaderId, db),
    users.findOne(
      { _id: user._id },
      {
        projection: {
          name: 1,
          username: 1,
        },
      }
    ),
  ]);

  return {
    ok: true,
    displayName: nameDoc?.name ?? user.name ?? user.username ?? dn,
    username: user.username ?? dnNorm,
    uploaderId,
    games: games as ScratchGameRow[],
    prizes: prizes as ScratchPrizeRow[],
    aliases: aliases as AliasRow[],
    blacklist: blacklist as BlacklistRow[],
    style,
  };
}

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function emailLocalPart(email: unknown): string {
  const v = String(email ?? "").trim().toLowerCase();
  return v.split("@")[0] ?? "";
}