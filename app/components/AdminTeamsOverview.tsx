"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TeamGameKey, TeamMemberRole, TeamTheme } from "@/lib/db";

type AdminTeamMember = {
  userId: string;
  role: TeamMemberRole;
  name: string;
  username: string | null;
  email: string | null;
  deleted: boolean;
  joinedAt: string | null;
};

type AdminTeamInvite = {
  id: string;
  inviteeId: string;
  inviteeName: string;
  inviteeUsername: string | null;
  inviterName: string;
  createdAt: string | null;
};

type AdminTeamRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  url: string;
  ownerId: string;
  theme: TeamTheme;
  accentColor: string;
  enabledGames: TeamGameKey[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    username: string | null;
    email: string | null;
    deleted: boolean;
  };
  members: AdminTeamMember[];
  pendingInvites: AdminTeamInvite[];
};

type AdminTeamsResponse = {
  teams?: AdminTeamRow[];
  error?: string;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fmtDate(value: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function userLine(username: string | null, email: string | null) {
  if (username && email) return `/${username} · ${email}`;
  if (username) return `/${username}`;
  return email ?? "No account details";
}

export function AdminTeamsOverview() {
  const [teams, setTeams] = useState<AdminTeamRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/teams/overview", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as AdminTeamsResponse;
      if (!res.ok) throw new Error(data?.error ?? "Failed to load teams");
      setTeams(Array.isArray(data.teams) ? data.teams : []);
    } catch (error: unknown) {
      setTeams([]);
      setMessage(errorMessage(error, "Failed to load teams"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const title = useMemo(() => {
    if (loading) return "Loading teams";
    return teams.length === 1 ? "1 team" : `${teams.length} teams`;
  }, [loading, teams.length]);

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Teams</h2>
          <p className="mt-1 text-sm text-zinc-600">Admin overview of every team, owner, public URL, settings, members, and pending invites.</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">{title}</div>
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
          <div>Name</div>
          <div>URL</div>
          <div>Creator</div>
          <div className="text-right">&nbsp;</div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
        ) : teams.length ? (
          <div>
            {teams.map((team) => {
              const expanded = expandedId === team.id;

              return (
                <div key={team.id} className="border-b border-zinc-100 last:border-b-0">
                  <div className="grid grid-cols-[1.1fr_1fr_1fr_auto] items-center gap-3 px-3 py-2 text-sm text-zinc-800">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900">{team.name}</div>
                      <div className="truncate text-xs text-zinc-500">
                        {team.memberCount} member{team.memberCount === 1 ? "" : "s"} · {team.enabledGames.join(", ")}
                      </div>
                    </div>
                    <a className="min-w-0 truncate font-medium text-zinc-700 hover:text-zinc-950" href={team.url} target="_blank" rel="noopener noreferrer">
                      {team.url}
                    </a>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-zinc-900">{team.creator.name}{team.creator.deleted ? " · Deleted" : ""}</div>
                      <div className="truncate text-xs text-zinc-500">{userLine(team.creator.username, team.creator.email)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : team.id)}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                    >
                      {expanded ? "Close" : "Details"}
                    </button>
                  </div>

                  {expanded ? (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-4">
                      <div className="grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <h3 className="text-sm font-semibold text-zinc-900">Settings</h3>
                          <div className="mt-3 grid gap-3 text-sm text-zinc-700 sm:grid-cols-2">
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Theme</div>
                              <div className="mt-1 capitalize text-zinc-900">{team.theme}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Accent</div>
                              <div className="mt-1 flex items-center gap-2 text-zinc-900">
                                <span className="h-4 w-4 rounded-full border border-zinc-300" style={{ backgroundColor: team.accentColor }} />
                                <span className="font-mono text-xs">{team.accentColor}</span>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Enabled games</div>
                              <div className="mt-1 capitalize text-zinc-900">{team.enabledGames.join(", ")}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Created</div>
                              <div className="mt-1 text-zinc-900">{fmtDate(team.createdAt)}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Updated</div>
                              <div className="mt-1 text-zinc-900">{fmtDate(team.updatedAt)}</div>
                            </div>
                            <div>
                              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Team ID</div>
                              <div className="mt-1 break-all font-mono text-xs text-zinc-900">{team.id}</div>
                            </div>
                          </div>
                          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                            <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">Description</div>
                            <div className="mt-1 text-sm text-zinc-700">{team.description || "No description set."}</div>
                          </div>
                          <a
                            href={team.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
                          >
                            <ExternalLink aria-hidden="true" size={14} />
                            Open public page
                          </a>
                        </div>

                        <div className="space-y-4">
                          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Members</h3>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                              {team.members.length ? (
                                team.members.map((member) => (
                                  <div key={member.userId} className="flex flex-col gap-1 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                      <div className="truncate font-medium text-zinc-900">{member.name}{member.deleted ? " · Deleted" : ""}</div>
                                      <div className="truncate text-xs text-zinc-500">{userLine(member.username, member.email)}</div>
                                    </div>
                                    <div className="shrink-0 text-xs uppercase tracking-wide text-zinc-500">{member.role}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-3 text-sm text-zinc-600">No members.</div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                            <h3 className="text-sm font-semibold text-zinc-900">Pending invites</h3>
                            <div className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                              {team.pendingInvites.length ? (
                                team.pendingInvites.map((invite) => (
                                  <div key={invite.id} className="px-3 py-3 text-sm">
                                    <div className="font-medium text-zinc-900">{invite.inviteeName}</div>
                                    <div className="mt-1 text-xs text-zinc-500">
                                      Invited by {invite.inviterName} · {fmtDate(invite.createdAt)}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="px-3 py-3 text-sm text-zinc-600">No pending invites.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-zinc-600">No teams found.</div>
        )}
      </div>
    </div>
  );
}
