import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  await ensureAuthCollections();
  const gate = await requireRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const q = (url.searchParams.get("q") ?? "").trim();

  const filter: Record<string, unknown> = {};
  if (q) {
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");
    filter.$or = [{ email: regex }, { name: regex }];
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const skip = (page - 1) * PAGE_SIZE;

  const rows = await users
    .find(filter, {
      projection: { _id: 1, email: 1, role: 1, username: 1, name: 1, createdAt: 1, deleted: 1 },
      sort: { createdAt: -1 },
      skip,
      limit: PAGE_SIZE + 1,
    })
    .toArray();

  const hasMore = rows.length > PAGE_SIZE;
  const pageRows = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return NextResponse.json({
    ok: true,
    page,
    hasMore,
    users: pageRows.map((user) => ({
      id: user._id?.toString(),
      email: user.email,
      role: user.role,
      username: user.username ?? null,
      name: user.name ?? null,
      deleted: user.deleted === true,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString(),
    })),
  });
}
