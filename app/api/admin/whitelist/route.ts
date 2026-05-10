import { NextResponse } from "next/server";
import { requireSessionRoles } from "@/lib/auth";
import { ensureAuthCollections, getDb, isWhitelistEntryType, type UserDoc, type WhitelistEntryDoc } from "@/lib/db";
import { normalizeWhitelistValue, validateWhitelistValue } from "@/lib/whitelist";

type WhitelistRow = {
  id: string;
  type: "email" | "discord";
  value: string;
  createdAt: string;
  registered: boolean;
};

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return (error as { code?: unknown }).code;
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const whitelist = db.collection<WhitelistEntryDoc>("whitelist");
  const users = db.collection<UserDoc>("users");

  const entries = await whitelist
    .find({}, { projection: { type: 1, value: 1, createdAt: 1 } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  const emails = entries.filter((entry) => entry.type === "email").map((entry) => entry.value);
  const discordIds = entries.filter((entry) => entry.type === "discord").map((entry) => entry.value);

  const [emailUsers, discordUsers] = await Promise.all([
    emails.length
      ? users.find({ email: { $in: emails } }, { projection: { _id: 0, email: 1 } }).toArray()
      : Promise.resolve([]),
    discordIds.length
      ? users.find({ discord: { $in: discordIds } }, { projection: { _id: 0, discord: 1 } }).toArray()
      : Promise.resolve([]),
  ]);

  const registeredEmails = new Set(emailUsers.map((user) => user.email.toLowerCase()));
  const registeredDiscordIds = new Set(
    discordUsers.map((user) => (typeof user.discord === "string" ? user.discord : "")).filter(Boolean)
  );

  const rows: WhitelistRow[] = entries
    .filter((entry): entry is WhitelistEntryDoc & { _id: NonNullable<WhitelistEntryDoc["_id"]> } => {
      return Boolean(entry._id) && isWhitelistEntryType(entry.type);
    })
    .map((entry) => {
      const registered = entry.type === "email"
        ? registeredEmails.has(entry.value)
        : registeredDiscordIds.has(entry.value);

      return {
        id: entry._id.toHexString(),
        type: entry.type,
        value: entry.value,
        createdAt: entry.createdAt instanceof Date ? entry.createdAt.toISOString() : new Date(entry.createdAt).toISOString(),
        registered,
      };
    });

  return NextResponse.json({
    ok: true,
    whitelist: rows,
    pending: rows.filter((row) => !row.registered),
  });
}

export async function POST(req: Request) {
  await ensureAuthCollections();
  const gate = await requireSessionRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  let body: { type?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isWhitelistEntryType(body.type)) {
    return NextResponse.json({ error: "Invalid whitelist type" }, { status: 400 });
  }

  const validation = validateWhitelistValue(body.type, body.value ?? "");
  if (validation) {
    return NextResponse.json({ error: validation }, { status: 400 });
  }

  const type = body.type;
  const value = normalizeWhitelistValue(type, body.value ?? "");
  const createdAt = new Date();

  const db = await getDb();
  const whitelist = db.collection<WhitelistEntryDoc>("whitelist");

  try {
    const result = await whitelist.insertOne({
      type,
      value,
      createdBy: gate.auth.id,
      createdAt,
    });

    return NextResponse.json({
      ok: true,
      entry: {
        id: result.insertedId.toHexString(),
        type,
        value,
        createdAt: createdAt.toISOString(),
        registered: false,
      },
    });
  } catch (error: unknown) {
    if (getErrorCode(error) === 11000) {
      return NextResponse.json({ error: "That entry is already on the whitelist" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to add whitelist entry" }, { status: 500 });
  }
}
