import { NextResponse } from "next/server";
import { ensureAuthCollections, getDb, type UserDoc, type UserRole } from "@/lib/db";
import { AUTH_COOKIE_NAME, authCookieOptions, signAuthToken } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { getAvailableUsername, isValidUsername, normalizeUsername, usernameValidationMessage } from "@/lib/account";
import { findRegistrationWhitelistMatch } from "@/lib/whitelist";

function basicEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return (error as { code?: unknown }).code;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "";
}

export async function POST(req: Request) {
  await ensureAuthCollections();

  let body: { email?: string; password?: string; name?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();
  const usernameInput = typeof body.username === "string" ? normalizeUsername(body.username) : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (!basicEmailValid(email)) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json({ error: "Display name must be 80 characters or less" }, { status: 400 });
  }

  const bannedUsernames = [
    // Reserved words
    "admin",
    "administrator",
    "privacy",
    "terms",
    "support",
    "contact",
    "help",
    "stats",
    "dashboard",
    // Common words to prevent impersonation
  ]

  if (usernameInput) {
    const validation = usernameValidationMessage(usernameInput);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    if (!isValidUsername(usernameInput)) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    if (bannedUsernames.includes(usernameInput)) return NextResponse.json({ error: "That username is not allowed" }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const whitelistMatch = await findRegistrationWhitelistMatch(db, { email });

  if (!whitelistMatch) {
    return NextResponse.json({ error: "That email address is not whitelisted for registration" }, { status: 403 });
  }

  const existingCount = await users.countDocuments({}, { limit: 2 });
  const role: UserRole = existingCount === 0 ? "owner" : "dealer";

  const passwordHash = await hashPassword(password);
  let username: string | undefined = undefined;
  if (usernameInput) {
    const available = await getAvailableUsername(db, usernameInput);
    if (available !== usernameInput) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    username = usernameInput;
  }

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

    const res = NextResponse.json({ user: { id, email, username: username ?? null, name: name || null, role } });
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
    return res;
  } catch (error: unknown) {
    if (getErrorCode(error) === 11000) {
      const dupField = getErrorMessage(error).includes("email") ? "That email is already registered" : "That username is already taken";
      return NextResponse.json({ error: dupField }, { status: 409 });
    }
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
