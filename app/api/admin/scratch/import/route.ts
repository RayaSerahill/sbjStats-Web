import { requireUserRequest } from "@/lib/auth";
import { NextResponse } from "next/server";

type ScratchArchivePayload = {
  archive_id: number;
  player_name: string;
  archived_at?: string;
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

type ScratchSummaryPayload = {
  player_id: number;
  player_name: string;
  archived_at?: string;
  wins: number;
  total_cards: number;
  prizes_won: string[];
};

type NormalizedScratchGame = {
  playerName: string;
  archivedAt: string | null;
  totalCards: number;
  wins: number;
  prizesWon: string[];
};

function isScratchArchivePayload(value: unknown): value is ScratchArchivePayload {
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

function isScratchSummaryPayload(value: unknown): value is ScratchSummaryPayload {
  if (!value || typeof value !== "object") return false;

  const v = value as ScratchSummaryPayload;

  return (
    typeof v.player_name === "string" &&
    typeof v.total_cards === "number" &&
    typeof v.wins === "number" &&
    Array.isArray(v.prizes_won)
  );
}

function normalizeScratchPayload(value: ScratchArchivePayload | ScratchSummaryPayload): NormalizedScratchGame {
  if (isScratchArchivePayload(value)) {
    return {
      playerName: value.player_name,
      archivedAt: value.archived_at ?? null,
      totalCards: value.stats.total_cards,
      wins: value.stats.wins,
      prizesWon: value.stats.prizes_won,
    };
  }

  return {
    playerName: value.player_name,
    archivedAt: value.archived_at ?? new Date().toISOString(),
    totalCards: value.total_cards,
    wins: value.wins,
    prizesWon: value.prizes_won,
  };
}

async function handleGames(game: NormalizedScratchGame) {
  console.log("handleGames", game);

  const { playerName, archivedAt, totalCards, wins, prizesWon } = game;

  void playerName;
  void archivedAt;
  void totalCards;
  void wins;
  void prizesWon;

  // DB Logic
}

export async function POST(req: Request) {
  const gate = await requireUserRequest(req);
  if (!gate.ok) return gate.res;

  const body: unknown = await req.json();

  if (Array.isArray(body)) {
    for (const item of body) {
      if (!isScratchArchivePayload(item) && !isScratchSummaryPayload(item)) {
        return NextResponse.json({ ok: false, error: "Invalid item in payload array" }, { status: 400 });
      }

      await handleGames(normalizeScratchPayload(item));
    }

    return NextResponse.json({ ok: true });
  }

  if (isScratchArchivePayload(body) || isScratchSummaryPayload(body)) {
    await handleGames(normalizeScratchPayload(body));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
}