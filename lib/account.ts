import type { Db, ObjectId } from "mongodb";
import type { UserDoc } from "@/lib/db";

const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string) {
  return USERNAME_RE.test(normalizeUsername(value));
}

export function usernameValidationMessage(value: string) {
  const username = normalizeUsername(value);
  if (!username) return "Username is required";
  if (username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 32) return "Username must be 32 characters or less";
  if (!USERNAME_RE.test(username)) return "Username can only use lowercase letters, numbers, hyphens, and underscores";
  return null;
}

export function usernameFromEmail(email: string) {
  const local = String(email ?? "").trim().toLowerCase().split("@")[0] ?? "";
  const cleaned = local.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
  return cleaned || "user";
}

export async function getAvailableUsername(db: Db, desired: string, excludeUserId?: ObjectId | null) {
  const users = db.collection<UserDoc>("users");
  const baseRaw = normalizeUsername(desired) || "user";
  const base = baseRaw.slice(0, 32);

  const isFree = async (candidate: string) => {
    const existing = await users.findOne(
      excludeUserId
        ? { username: candidate, _id: { $ne: excludeUserId } as any }
        : { username: candidate },
      { projection: { _id: 1 } }
    );
    return !existing;
  };

  if (await isFree(base)) return base;

  for (let i = 2; i < 1000; i += 1) {
    const suffix = String(i);
    const trimmedBase = base.slice(0, Math.max(1, 32 - suffix.length));
    const candidate = `${trimmedBase}${suffix}`;
    if (await isFree(candidate)) return candidate;
  }

  throw new Error("Could not find a free username");
}
