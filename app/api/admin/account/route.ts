import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME, authCookieOptions, requireAdminRequest, signAuthToken } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getAvailableUsername, isValidUsername, normalizeUsername, usernameFromEmail, usernameValidationMessage } from "@/lib/account";

function basicEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function GET(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne(
    { _id: new ObjectId(gate.auth.id) },
    { projection: { email: 1, username: 1, name: 1, deleted: 1 } }
  );

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const suggestedUsername = user.username || usernameFromEmail(user.email);

  return NextResponse.json({
    ok: true,
    account: {
      email: user.email,
      username: user.username ?? null,
      suggestedUsername,
      name: user.name ?? null,
      deleted: user.deleted === true,
      statsUrl: `/stats/${user.username ?? suggestedUsername}`,
    },
  });
}

export async function PATCH(req: Request) {
  await ensureAuthCollections();
  const gate = await requireAdminRequest(req);
  if (!gate.ok) return gate.res;

  let body: {
    name?: string;
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    newPasswordConfirm?: string;
    deleteAccount?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const userId = new ObjectId(gate.auth.id);
  const user = await users.findOne({ _id: userId });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.deleteAccount === true) {
    await users.updateOne(
      { _id: userId },
      {
        $set: {
          deleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    const res = NextResponse.json({ ok: true, deleted: true });
    if (gate.method === "cookie") {
      res.cookies.set(AUTH_COOKIE_NAME, "", {
        ...authCookieOptions(),
        maxAge: 0,
      });
    }
    return res;
  }

  const set: Partial<UserDoc> & Record<string, unknown> = {};
  let updatedEmail = user.email;

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }
    if (name.length > 80) {
      return NextResponse.json({ error: "Display name must be 80 characters or less" }, { status: 400 });
    }
    set.name = name;
  }

  if (typeof body.username === "string") {
    const normalized = normalizeUsername(body.username);
    const validation = usernameValidationMessage(normalized);
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 });
    }
    if (!isValidUsername(normalized)) {
      return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    }
    const available = await getAvailableUsername(db, normalized, userId);
    if (available !== normalized) {
      return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    }
    set.username = normalized;
  }

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }
    if (!basicEmailValid(email)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (email !== user.email) {
      const existing = await users.findOne({ email }, { projection: { _id: 1 } });
      if (existing?._id && existing._id.toHexString() !== userId.toHexString()) {
        return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
      }
    }
    set.email = email;
    updatedEmail = email;
  }

  const wantsPasswordChange =
    typeof body.currentPassword === "string" ||
    typeof body.newPassword === "string" ||
    typeof body.newPasswordConfirm === "string";

  if (wantsPasswordChange) {
    const currentPassword = body.currentPassword ?? "";
    const newPassword = body.newPassword ?? "";
    const newPasswordConfirm = body.newPasswordConfirm ?? "";

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return NextResponse.json({ error: "Fill in current password and both new password fields" }, { status: 400 });
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
    }

    set.passwordHash = await hashPassword(newPassword);
  }

  if (!Object.keys(set).length) {
    return NextResponse.json({ error: "No changes submitted" }, { status: 400 });
  }

  set.updatedAt = new Date();
  await users.updateOne({ _id: userId }, { $set: set });

  const latestUsername = typeof set.username === "string" ? set.username : user.username ?? usernameFromEmail(updatedEmail);
  const latestName = typeof set.name === "string" ? set.name : user.name ?? null;
  const res = NextResponse.json({
    ok: true,
    account: {
      email: updatedEmail,
      username: latestUsername,
      name: latestName,
      deleted: false,
      statsUrl: `/stats/${latestUsername}`,
    },
  });

  if (gate.method === "cookie") {
    const token = await signAuthToken({ id: userId.toHexString(), email: updatedEmail, role: "admin" });
    res.cookies.set(AUTH_COOKIE_NAME, token, authCookieOptions());
  }

  return res;
}
