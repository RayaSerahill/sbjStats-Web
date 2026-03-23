import type { Db, AnyBulkWriteOperation } from "mongodb";

export type ScratchArchivePayload = {
  archive_id: number;
  player_name: string;
  archived_at?: number | string;
  preset_name?: string;
  theme_name?: string;
  stats: {
    total_cards: number;
    completed_cards?: number;
    wins: number;
    total_prizes?: number;
    prizes_won: string[];
  };
};

export type ScratchSummaryPayload = {
  player_id: number;
  player_name: string;
  archived_at?: number | string;
  wins: number;
  total_cards: number;
  prizes_won: string[];
};

export type NormalizedScratchGame = {
  playerName: string;
  archivedAt: number;
  totalCards: number;
  wins: number;
  prizesWon: string[];
};

export type ScratchGameDoc = {
  uploaderId: string;
  playerName: string;
  archivedAt: number;
  totalCards: number;
  wins: number;
  prizesWon: string[];
};

export function isScratchArchivePayload(value: unknown): value is ScratchArchivePayload {
  if (!value || typeof value !== "object") return false;

  const v = value as ScratchArchivePayload;

  return (
    typeof v.player_name === "string" &&
    !!v.stats &&
    typeof v.stats === "object" &&
    typeof v.stats.total_cards === "number" &&
    typeof v.stats.wins === "number" &&
    Array.isArray(v.stats.prizes_won)
  );
}

export function isScratchSummaryPayload(value: unknown): value is ScratchSummaryPayload {
  if (!value || typeof value !== "object") return false;

  const v = value as ScratchSummaryPayload;

  return (
    typeof v.player_name === "string" &&
    typeof v.total_cards === "number" &&
    typeof v.wins === "number" &&
    Array.isArray(v.prizes_won)
  );
}

function normalizeArchivedAt(value: number | string | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 1_000_000_000_000 ? Math.trunc(value / 1000) : Math.trunc(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        return numeric >= 1_000_000_000_000 ? Math.trunc(numeric / 1000) : Math.trunc(numeric);
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return Math.trunc(parsed.getTime() / 1000);
      }
    }
  }

  return Math.trunc(Date.now() / 1000);
}

function normalizePrizesWon(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter((item) => item.trim().length > 0);
}

export function normalizeScratchPayload(value: ScratchArchivePayload | ScratchSummaryPayload): NormalizedScratchGame {
  if (isScratchArchivePayload(value)) {
    return {
      playerName: value.player_name,
      archivedAt: normalizeArchivedAt(value.archived_at),
      totalCards: Math.trunc(value.stats.total_cards),
      wins: Math.trunc(value.stats.wins),
      prizesWon: normalizePrizesWon(value.stats.prizes_won),
    };
  }

  return {
    playerName: value.player_name,
    archivedAt: normalizeArchivedAt(value.archived_at),
    totalCards: Math.trunc(value.total_cards),
    wins: Math.trunc(value.wins),
    prizesWon: normalizePrizesWon(value.prizes_won),
  };
}

export async function ingestScratchGames(opts: {
  db: Db;
  uploaderId: string;
  games: NormalizedScratchGame[];
}) {
  const scratchGames = opts.db.collection<ScratchGameDoc>("scratch_games");

  const docs = opts.games.map((game) => ({
    uploaderId: opts.uploaderId,
    playerName: game.playerName,
    archivedAt: game.archivedAt,
    totalCards: game.totalCards,
    wins: game.wins,
    prizesWon: game.prizesWon,
  }));

  if (docs.length === 0) {
    return { ok: true as const, inserted: 0, updated: 0 };
  }

  const ops: AnyBulkWriteOperation<ScratchGameDoc>[] = docs.map((doc) => ({
    updateOne: {
      filter: {
        uploaderId: doc.uploaderId,
        playerName: doc.playerName,
        archivedAt: doc.archivedAt,
      },
      update: {
        $set: {
          totalCards: doc.totalCards,
          wins: doc.wins,
          prizesWon: doc.prizesWon,
        },
        $setOnInsert: {
          uploaderId: doc.uploaderId,
          playerName: doc.playerName,
          archivedAt: doc.archivedAt,
        },
      },
      upsert: true,
    },
  }));

  const result = await scratchGames.bulkWrite(ops, { ordered: false });

  return {
    ok: true as const,
    inserted: result.upsertedCount,
    updated: result.matchedCount,
  };
}
