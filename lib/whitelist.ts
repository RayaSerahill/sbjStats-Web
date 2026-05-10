import type { Db } from "mongodb";
import { isWhitelistEntryType, type WhitelistEntryDoc, type WhitelistEntryType } from "./db";

function basicEmailValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function normalizeWhitelistValue(type: WhitelistEntryType, value: string) {
  const trimmed = value.trim();
  return type === "email" ? trimmed.toLowerCase() : trimmed;
}

export function validateWhitelistValue(type: WhitelistEntryType, value: string) {
  const normalized = normalizeWhitelistValue(type, value);

  if (!normalized) {
    return type === "email" ? "Email is required" : "Discord ID is required";
  }

  if (type === "email" && !basicEmailValid(normalized)) {
    return "Please enter a valid email address";
  }

  if (type === "discord" && !/^\d{5,32}$/.test(normalized)) {
    return "Discord ID must contain only digits";
  }

  return null;
}

export async function findRegistrationWhitelistMatch(
  db: Db,
  input: { email?: string | null; discord?: string | null }
) {
  const filters: Array<{ type: WhitelistEntryType; value: string }> = [];

  if (input.email) {
    filters.push({ type: "email", value: normalizeWhitelistValue("email", input.email) });
  }

  if (input.discord) {
    filters.push({ type: "discord", value: normalizeWhitelistValue("discord", input.discord) });
  }

  if (!filters.length) return null;

  const whitelist = db.collection<WhitelistEntryDoc>("whitelist");
  const match = await whitelist.findOne(
    { $or: filters },
    { projection: { _id: 0, type: 1, value: 1 } }
  );

  if (!match || !isWhitelistEntryType(match.type)) return null;
  return { type: match.type, value: match.value };
}
