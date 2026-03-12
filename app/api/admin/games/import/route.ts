import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/auth";
import { ensureGameCollections, getDb } from "@/lib/db";
import { ingestRound } from "@/lib/gameIngest";
import { ingestReportCsv } from "@/lib/reportCsvIngest";

export async function POST(req: Request) {
  await ensureGameCollections();

  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const contentType = req.headers.get("content-type") ?? "";
  const db = await getDb();

  if (contentType.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      const file = form.get("file");

      if (!file || typeof file === "string") {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }

      const csvText = await file.text();
      const result = await ingestReportCsv({ db, uploaderId: gate.auth.id, csvText });

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        inserted: result.inserted,
        skipped: result.skipped,
        invalid: result.invalid,
      });
    } catch (err) {
      console.error("Failed to parse multipart form data:", err);
      return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    }
  }

  let body: {
    payload?: string;
    createdAt?: string;
    sourceDateTime?: string;
    csvText?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const csvText = (body.csvText ?? "").trim();
  if (csvText) {
    const result = await ingestReportCsv({ db, uploaderId: gate.auth.id, csvText });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      skipped: result.skipped,
      invalid: result.invalid,
    });
  }

  const payload = (body.payload ?? "").trim();
  if (!payload) {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const createdAt = body.createdAt ? new Date(body.createdAt) : undefined;
  if (body.createdAt && Number.isNaN(createdAt?.getTime())) {
    return NextResponse.json({ error: "createdAt must be an ISO date string" }, { status: 400 });
  }

  const sourceDateTime =
      (body.sourceDateTime ?? (createdAt ? createdAt.toISOString() : undefined))?.toString();

  const result = await ingestRound({
    db,
    uploaderId: gate.auth.id,
    payload,
    createdAt,
    sourceDateTime,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (result.skipped) return NextResponse.json({ ok: true, skipped: true });
  return NextResponse.json({ ok: true, gameId: result.gameId });
}