import type { ObjectId } from "mongodb";
import type { TeamDoc, TeamGameKey, UserDoc } from "@/lib/db";

const TEAM_SLUG_RE = /^[a-z0-9_-]{3,32}$/;
const RESERVED_TEAM_SLUGS = new Set([
  "admin",
  "administrator",
  "api",
  "dashboard",
  "help",
  "privacy",
  "stats",
  "support",
  "team",
  "teams",
  "terms",
]);

export const TEAM_GAME_OPTIONS: Array<{ key: TeamGameKey; label: string; description: string }> = [
  {
    key: "blackjack",
    label: "Blackjack",
    description: "Dealer profit and hosted game activity.",
  },
  {
    key: "scratch",
    label: "Scratch",
    description: "Prize value and scratch archive activity.",
  },
];

export function normalizeTeamSlug(value: string) {
  return value.trim().toLowerCase();
}

export function slugFromTeamName(value: string) {
  return normalizeTeamSlug(value)
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 32);
}

export function teamNameValidationMessage(value: string) {
  const name = value.trim();
  if (!name) return "Team name is required";
  if (name.length < 2) return "Team name must be at least 2 characters";
  if (name.length > 80) return "Team name must be 80 characters or less";
  return null;
}

export function teamSlugValidationMessage(value: string) {
  const slug = normalizeTeamSlug(value);
  if (!slug) return "Team URL is required";
  if (slug.length < 3) return "Team URL must be at least 3 characters";
  if (slug.length > 32) return "Team URL must be 32 characters or less";
  if (!TEAM_SLUG_RE.test(slug)) return "Team URL can only use lowercase letters, numbers, hyphens, and underscores";
  if (RESERVED_TEAM_SLUGS.has(slug)) return "That team URL is reserved";
  return null;
}

export function normalizeTeamDescription(value: unknown) {
  return String(value ?? "").trim();
}

export function teamDescriptionValidationMessage(value: unknown) {
  const description = normalizeTeamDescription(value);
  if (description.length > 280) return "Description must be 280 characters or less";
  return null;
}

export function normalizeEnabledGames(value: unknown): TeamGameKey[] {
  const allowed = new Set<TeamGameKey>(TEAM_GAME_OPTIONS.map((option) => option.key));
  const raw = Array.isArray(value) ? value : [];
  const enabled = raw.filter((item): item is TeamGameKey => allowed.has(item as TeamGameKey));
  return enabled.length ? Array.from(new Set(enabled)) : ["blackjack"];
}

export function serializeTeam(team: TeamDoc, memberCount = 0) {
  return {
    id: team._id?.toHexString() ?? "",
    name: team.name,
    slug: team.slug,
    description: team.description ?? "",
    url: `/t/${team.slug}`,
    ownerId: team.ownerId,
    enabledGames: normalizeEnabledGames(team.enabledGames),
    memberCount,
    createdAt: team.createdAt instanceof Date ? team.createdAt.toISOString() : new Date(team.createdAt).toISOString(),
    updatedAt: team.updatedAt instanceof Date ? team.updatedAt.toISOString() : new Date(team.updatedAt).toISOString(),
  };
}

export function displayUserName(user: Pick<UserDoc, "email" | "name" | "username"> | null | undefined) {
  if (!user) return "Unknown user";
  return user.name || user.username || user.email;
}

export function objectIdToString(id: ObjectId | undefined) {
  return id?.toHexString() ?? "";
}

export function mongoErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error ? (error as { code?: unknown }).code : undefined;
}
