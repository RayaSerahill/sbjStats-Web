import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import type { MarblesGameDoc } from "@/lib/marblesIngest";
import { normalizeHiddenMarblesHosts, type MarblesSettingsDoc } from "@/lib/marblesSettings";
import { summarizeMarblesHosts } from "@/lib/marblesStats";

function readHiddenHosts(body: unknown): unknown[] | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).hiddenHosts;
  return Array.isArray(value) ? value : null;
}

/**
 * The dealer's own host characters and whether each one shows on the public
 * marbles page. Hosts are shown unless hidden, so `enabled` is true for a
 * character nobody has touched yet.
 */
export async function GET(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const marblesGames = db.collection<MarblesGameDoc>("marbles_games");
  const marblesSettings = db.collection<MarblesSettingsDoc>("marbles_settings");

  const [games, settings] = await Promise.all([
    marblesGames
      .find(
        { uploaderId: gate.auth.id, mine: true },
        { projection: { _id: 0, mine: 1, status: 1, totalPlayers: 1, creatorName: 1, creatorWorld: 1 } }
      )
      .toArray(),
    marblesSettings.findOne({ uploaderId: gate.auth.id }, { projection: { hiddenHosts: 1, updatedAt: 1 } }),
  ]);

  const hiddenHosts = normalizeHiddenMarblesHosts(settings?.hiddenHosts);

  return NextResponse.json({
    ok: true,
    hiddenHosts,
    updatedAt: settings?.updatedAt ? new Date(settings.updatedAt).toISOString() : null,
    hosts: summarizeMarblesHosts(games, hiddenHosts),
  });
}

export async function PUT(req: Request) {
  await ensureGameCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = readHiddenHosts(body);
  if (!input) {
    return NextResponse.json({ error: "hiddenHosts must be an array" }, { status: 400 });
  }

  const hiddenHosts = normalizeHiddenMarblesHosts(input);
  const db = await getDb();
  const marblesSettings = db.collection<MarblesSettingsDoc>("marbles_settings");
  const now = new Date();

  await marblesSettings.updateOne(
    { uploaderId: gate.auth.id },
    {
      $set: { hiddenHosts, updatedAt: now },
      $setOnInsert: { uploaderId: gate.auth.id, createdAt: now },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true, hiddenHosts, updatedAt: now.toISOString() });
}
