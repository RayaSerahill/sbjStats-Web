import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  signAuthToken,
} from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  await ensureAuthCollections();

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");

  const user = await users.findOne({ email, deleted: { $ne: true } });
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const id = user._id instanceof ObjectId ? user._id.toHexString() : String(user._id);
  const token = await signAuthToken({ id, email: user.email, role: "admin" });

  const res = NextResponse.json({ user: { id, email: user.email, role: "admin" } });
  res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  return res;
}
