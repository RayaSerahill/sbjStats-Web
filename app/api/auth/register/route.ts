import { NextResponse } from "next/server";
import { ensureAuthCollections, getDb, type UserDoc, type UserRole } from "@/lib/db";
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  signAuthToken,
} from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getAvailableUsername, usernameFromEmail } from "@/lib/account";

const canRegister = async () => {
  if (process.env.ALLOW_ADMIN_REGISTER === "true") return true;
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const count = await users.countDocuments({}, { limit: 1 });
  return count === 0;
};

export async function POST(req: Request) {
  await ensureAuthCollections();

  if (!(await canRegister())) {
    return NextResponse.json(
      { error: "Registration is disabled" },
      { status: 403 }
    );
  }

  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");

  const existingCount = await users.countDocuments({}, { limit: 2 });
  const role: UserRole = existingCount === 0 ? "owner" : process.env.ALLOW_ADMIN_REGISTER === "true" ? "admin" : "user";

  const passwordHash = await hashPassword(password);
  const username = await getAvailableUsername(db, usernameFromEmail(email));
  const now = new Date();

  try {
    const insert = await users.insertOne({
      email,
      passwordHash,
      name: name || undefined,
      username,
      role,
      deleted: false,
      createdAt: now,
      updatedAt: now,
    });

    const id = insert.insertedId.toHexString();
    const token = await signAuthToken({ id, email, role });

    const res = NextResponse.json({ user: { id, email, username, role } });
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res;
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "That email is already registered" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
