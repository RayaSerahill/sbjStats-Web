import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import { generateApiKey, getApiKeyPrefix, hashApiKey, requireAdminRequest } from "@/lib/auth";

export async function GET(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne(
    { _id: new ObjectId(gate.auth.id) },
    { projection: { apiKeyPrefix: 1, apiKeyCreatedAt: 1 } }
  );

  return NextResponse.json({
    ok: true,
    apiKey: user?.apiKeyPrefix
      ? {
          prefix: user.apiKeyPrefix,
          createdAt: user.apiKeyCreatedAt ?? null,
        }
      : null,
  });
}

export async function POST(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);
  const apiKeyPrefix = getApiKeyPrefix(apiKey);
  const apiKeyCreatedAt = new Date();

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  await users.updateOne(
    { _id: new ObjectId(gate.auth.id) },
    {
      $set: {
        apiKeyHash,
        apiKeyPrefix,
        apiKeyCreatedAt,
        updatedAt: apiKeyCreatedAt,
      },
    }
  );

  return NextResponse.json({
    ok: true,
    apiKey,
    prefix: apiKeyPrefix,
    createdAt: apiKeyCreatedAt,
  });
}

export async function DELETE(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  await users.updateOne(
    { _id: new ObjectId(gate.auth.id) },
    {
      $unset: {
        apiKeyHash: "",
        apiKeyPrefix: "",
        apiKeyCreatedAt: "",
      },
      $set: {
        updatedAt: new Date(),
      },
    }
  );

  return NextResponse.json({ ok: true });
}
