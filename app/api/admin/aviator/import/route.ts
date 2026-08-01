import { NextResponse } from "next/server";
import { requireUserRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { ingestAviatorPayloads, isAviatorImportPayload } from "@/lib/aviatorIngest";

export async function POST(req: Request) {
  await ensureGameCollections();

  const gate = await requireUserRequest(req);
  if (!gate.ok) return gate.res;

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const payload = Array.isArray(body) ? body : [body];

  for (const item of payload) {
    if (!isAviatorImportPayload(item)) {
      return NextResponse.json({ ok: false, error: "Invalid Aviator payload" }, { status: 400 });
    }
  }

  const db = await getDb();
  const result = await ingestAviatorPayloads({
    db,
    uploaderId: gate.auth.id,
    payloads: payload,
  });

  return NextResponse.json(result);
}
