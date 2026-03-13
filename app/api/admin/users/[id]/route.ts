import { NextResponse } from "next/server";
import { Collection, ObjectId } from "mongodb";
import { requireRoles } from "@/lib/auth";
import { ensureAuthCollections, getDb, type UserDoc, type UserRole } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { getAvailableUsername, isValidUsername, normalizeUsername, usernameValidationMessage } from "@/lib/account";

function basicEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isRole(value: unknown): value is UserRole {
  return value === "owner" || value === "admin" || value === "dealer";
}

async function ownerCount(users: Collection<UserDoc>) {
  return users.countDocuments({ role: "owner", deleted: { $ne: true } });
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  await ensureAuthCollections();
  const gate = await requireRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  let body: {
    email?: string;
    username?: string;
    name?: string;
    role?: UserRole;
    newPassword?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const userId = new ObjectId(id);
  const target = await users.findOne({ _id: userId });

  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.role === "owner" && gate.auth.role !== "owner") {
    return NextResponse.json({ error: "Only owners can edit owner accounts" }, { status: 403 });
  }

  const set: Partial<UserDoc> & Record<string, unknown> = {};

  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });
    if (!basicEmailValid(email)) return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing?._id && existing._id.toHexString() !== userId.toHexString()) {
      return NextResponse.json({ error: "That email is already in use" }, { status: 409 });
    }
    set.email = email;
  }

  if (typeof body.username === "string") {
    const normalized = normalizeUsername(body.username);
    const validation = usernameValidationMessage(normalized);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
    if (!isValidUsername(normalized)) return NextResponse.json({ error: "Invalid username" }, { status: 400 });
    const available = await getAvailableUsername(db, normalized, userId);
    if (available !== normalized) return NextResponse.json({ error: "That username is already taken" }, { status: 409 });
    set.username = normalized;
  }

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ error: "Display name must be 80 characters or less" }, { status: 400 });
    set.name = name;
  }

  if (typeof body.newPassword === "string") {
    const password = body.newPassword;
    if (password.length < 8) return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    set.passwordHash = await hashPassword(password);
  }

  if (typeof body.role === "string") {
    if (!isRole(body.role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    if (gate.auth.role !== "owner" && body.role === "owner") {
      return NextResponse.json({ error: "Only owners can assign the owner role" }, { status: 403 });
    }
    if (target.role === "owner" && body.role !== "owner") {
      const owners = await ownerCount(users);
      if (owners <= 1) return NextResponse.json({ error: "At least one active owner must remain" }, { status: 400 });
    }
    set.role = body.role;
  }

  if (!Object.keys(set).length) return NextResponse.json({ error: "No changes submitted" }, { status: 400 });

  set.updatedAt = new Date();
  await users.updateOne({ _id: userId }, { $set: set });

  const updated = await users.findOne(
    { _id: userId },
    { projection: { _id: 1, email: 1, role: 1, username: 1, name: 1, createdAt: 1, deleted: 1 } }
  );

  return NextResponse.json({
    ok: true,
    user: {
      id: updated?._id?.toString(),
      email: updated?.email,
      role: updated?.role,
      username: updated?.username ?? null,
      name: updated?.name ?? null,
      deleted: updated?.deleted === true,
      createdAt: updated?.createdAt instanceof Date ? updated.createdAt.toISOString() : new Date(updated?.createdAt ?? Date.now()).toISOString(),
    },
  });
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  await ensureAuthCollections();
  const gate = await requireRoles(req, ["owner", "admin"]);
  if (!gate.ok) return gate.res;

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const userId = new ObjectId(id);
  const target = await users.findOne({ _id: userId }, { projection: { _id: 1, role: 1, deleted: 1 } });

  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.deleted === true) return NextResponse.json({ ok: true, deleted: true });
  if (target.role === "owner" && gate.auth.role !== "owner") {
    return NextResponse.json({ error: "Only owners can delete owner accounts" }, { status: 403 });
  }

  if (target.role === "owner") {
    const owners = await ownerCount(users);
    if (owners <= 1) return NextResponse.json({ error: "At least one active owner must remain" }, { status: 400 });
  }

  await users.updateOne(
    { _id: userId },
    { $set: { deleted: true, deletedAt: new Date(), updatedAt: new Date() } }
  );

  return NextResponse.json({ ok: true, deleted: true });
}
