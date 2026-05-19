"use client";

import { useEffect, useMemo, useState } from "react";
import { DEFAULT_TEAM_ACCENT_COLOR, TEAM_GAME_OPTIONS, TEAM_THEME_OPTIONS, slugFromTeamName } from "@/lib/teams";
import type { TeamGameKey, TeamMemberRole, TeamTheme } from "@/lib/db";

type TeamMember = {
  userId: string;
  role: TeamMemberRole;
  name: string;
  username: string | null;
  joinedAt: string;
};

type OwnedTeam = {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: TeamTheme;
  accentColor: string;
  url: string;
  enabledGames: TeamGameKey[];
  memberCount: number;
  members: TeamMember[];
};

type TeamMembership = {
  id: string;
  name: string;
  slug: string;
  description: string;
  theme: TeamTheme;
  accentColor: string;
  url: string;
  role: TeamMemberRole;
  memberCount: number;
  joinedAt: string;
};

type TeamInvite = {
  id: string;
  teamName: string;
  teamSlug: string;
  teamUrl: string;
  inviterName: string;
  createdAt: string;
};

type TeamsState = {
  pendingInviteCount: number;
  ownedTeam: OwnedTeam | null;
  teams: TeamMembership[];
  invites: TeamInvite[];
};

const emptyState: TeamsState = {
  pendingInviteCount: 0,
  ownedTeam: null,
  teams: [],
  invites: [],
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString();
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isHexColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function Teams() {
  const [state, setState] = useState<TeamsState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [leavingTeam, setLeavingTeam] = useState<TeamMembership | null>(null);
  const [kickingMember, setKickingMember] = useState<TeamMember | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const [teamName, setTeamName] = useState("");
  const [teamSlug, setTeamSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [inviteUsername, setInviteUsername] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [themeDraft, setThemeDraft] = useState<TeamTheme>("light");
  const [accentColorDraft, setAccentColorDraft] = useState(DEFAULT_TEAM_ACCENT_COLOR);
  const [enabledGamesDraft, setEnabledGamesDraft] = useState<TeamGameKey[]>(["blackjack"]);

  const ownedTeam = state.ownedTeam;
  const teamUrl = useMemo(() => {
    if (!ownedTeam) return "";
    return `${origin || ""}${ownedTeam.url}`;
  }, [origin, ownedTeam]);
  const colorInputValue = isHexColor(accentColorDraft) ? accentColorDraft : DEFAULT_TEAM_ACCENT_COLOR;

  const load = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/teams", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load teams");
      const pendingInviteCount = Number(data.pendingInviteCount) || 0;
      setState({
        pendingInviteCount,
        ownedTeam: data.ownedTeam ?? null,
        teams: Array.isArray(data.teams) ? data.teams : [],
        invites: Array.isArray(data.invites) ? data.invites : [],
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teams:invite-count", { detail: { count: pendingInviteCount } }));
      }
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load teams"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (ownedTeam) {
      setEnabledGamesDraft(ownedTeam.enabledGames.length ? ownedTeam.enabledGames : ["blackjack"]);
      setDescriptionDraft(ownedTeam.description ?? "");
      setThemeDraft(ownedTeam.theme ?? "light");
      setAccentColorDraft(ownedTeam.accentColor ?? DEFAULT_TEAM_ACCENT_COLOR);
    }
  }, [ownedTeam]);

  const updateTeamName = (value: string) => {
    setTeamName(value);
    if (!slugEdited) {
      setTeamSlug(slugFromTeamName(value));
    }
  };

  const createTeam = async () => {
    setBusy("create");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName, slug: teamSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to create team");
      setTeamName("");
      setTeamSlug("");
      setSlugEdited(false);
      setSuccess("Team created");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to create team"));
    } finally {
      setBusy(null);
    }
  };

  const toggleGame = (game: TeamGameKey) => {
    setEnabledGamesDraft((prev) => {
      if (prev.includes(game)) {
        const next = prev.filter((item) => item !== game);
        return next.length ? next : prev;
      }
      return [...prev, game];
    });
  };

  const saveEnabledGames = async () => {
    if (!ownedTeam) return;
    setBusy("games");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${ownedTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledGames: enabledGamesDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save team games");
      setSuccess("Team games updated");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save team games"));
    } finally {
      setBusy(null);
    }
  };

  const saveDescription = async () => {
    if (!ownedTeam) return;
    setBusy("description");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${ownedTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descriptionDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save team description");
      setSuccess("Team description updated");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save team description"));
    } finally {
      setBusy(null);
    }
  };

  const saveAppearance = async () => {
    if (!ownedTeam) return;
    setBusy("appearance");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${ownedTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeDraft, accentColor: accentColorDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save team appearance");
      setSuccess("Team appearance updated");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to save team appearance"));
    } finally {
      setBusy(null);
    }
  };

  const inviteDealer = async () => {
    if (!ownedTeam) return;
    setBusy("invite");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${ownedTeam.id}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: inviteUsername }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to send invite");
      setInviteUsername("");
      setSuccess("Invite sent");
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to send invite"));
    } finally {
      setBusy(null);
    }
  };

  const respondToInvite = async (inviteId: string, action: "accept" | "decline") => {
    setBusy(`${action}-${inviteId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/team-invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update invite");
      setSuccess(action === "accept" ? "Invite accepted" : "Invite declined");
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to update invite"));
    } finally {
      setBusy(null);
    }
  };

  const leaveTeam = async () => {
    if (!leavingTeam) return;
    setBusy(`leave-${leavingTeam.id}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${leavingTeam.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to leave team");
      setSuccess(`Left ${leavingTeam.name}`);
      setLeavingTeam(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to leave team"));
    } finally {
      setBusy(null);
    }
  };

  const kickMember = async () => {
    if (!ownedTeam || !kickingMember) return;
    setBusy(`kick-${kickingMember.userId}`);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/teams/${ownedTeam.id}/members/${kickingMember.userId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to kick member");
      setSuccess(`Removed ${kickingMember.name} from ${ownedTeam.name}`);
      setKickingMember(null);
      await load();
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to kick member"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Teams</h2>
          <p className="mt-1 text-sm text-zinc-600">Create one team, invite dealers, and manage what appears on the public team page.</p>
        </div>
        {state.pendingInviteCount ? (
          <div className="rounded-full border border-[#FF9FC6]/50 bg-[#fff7fb] px-3 py-1 text-xs font-medium text-zinc-900">
            {state.pendingInviteCount} invite{state.pendingInviteCount === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      ) : null}

      {loading ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600">Loading teams…</div>
      ) : null}

      {!loading && !ownedTeam ? (
        <form
          className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void createTeam();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Create team</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Team name</label>
              <input
                type="text"
                value={teamName}
                onChange={(event) => updateTeamName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="Team name"
                maxLength={80}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700">Team URL</label>
              <div className="mt-2 flex flex-col rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-3 text-sm text-zinc-900 sm:flex-row sm:items-center sm:gap-1">
                <span className="shrink-0 text-zinc-500">{origin || ""}/t/</span>
                <input
                  type="text"
                  value={teamSlug}
                  onChange={(event) => {
                    setSlugEdited(true);
                    setTeamSlug(event.target.value.toLowerCase());
                  }}
                  className="min-w-0 flex-1 bg-transparent font-medium outline-none"
                  placeholder="team_name"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>
              <p className="mt-2 text-xs text-zinc-500">Allowed: lowercase letters, numbers, hyphens, underscores. 3 to 32 characters.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy === "create"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "create" ? "Creating…" : "Create team"}
          </button>
        </form>
      ) : null}

      {ownedTeam ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{ownedTeam.name}</h3>
                {ownedTeam.description ? (
                  <p className="mt-1 max-w-xl text-sm text-zinc-600">{ownedTeam.description}</p>
                ) : null}
                <a className="mt-1 block break-all text-sm font-medium text-zinc-700 hover:text-zinc-950" href={ownedTeam.url}>
                  {teamUrl}
                </a>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className="capitalize">{ownedTeam.theme ?? "light"} theme</span>
                  <span className="h-3 w-3 rounded-full border border-zinc-300" style={{ backgroundColor: ownedTeam.accentColor ?? DEFAULT_TEAM_ACCENT_COLOR }} />
                  <span>{ownedTeam.accentColor ?? DEFAULT_TEAM_ACCENT_COLOR}</span>
                </div>
              </div>
              <div className="rounded-full border border-zinc-200 bg-[#fff7fb] px-3 py-1 text-xs font-medium text-zinc-700">
                {ownedTeam.memberCount} dealer{ownedTeam.memberCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <form
            className="rounded-2xl border border-zinc-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveDescription();
            }}
          >
            <h3 className="text-sm font-semibold text-zinc-900">Description</h3>
            <label className="mt-4 block text-xs font-medium text-zinc-700">Team description</label>
            <textarea
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              className="mt-2 min-h-28 w-full resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
              placeholder="Short public description shown on the team page"
              maxLength={280}
            />
            <div className="mt-2 text-xs text-zinc-500">{descriptionDraft.length}/280 characters</div>
            <button
              type="submit"
              disabled={busy === "description"}
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === "description" ? "Saving…" : "Save description"}
            </button>
          </form>

          <form
            className="rounded-2xl border border-zinc-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveAppearance();
            }}
          >
            <h3 className="text-sm font-semibold text-zinc-900">Theme</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Page theme</label>
                <div className="mt-2 grid grid-cols-2 rounded-2xl border border-zinc-200 bg-[#fff7fb] p-1">
                  {TEAM_THEME_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setThemeDraft(option.key)}
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-medium transition",
                        themeDraft === option.key ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-600 hover:text-zinc-950",
                      ].join(" ")}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">Accent color</label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-2">
                  <input
                    type="color"
                    value={colorInputValue}
                    onChange={(event) => setAccentColorDraft(event.target.value.toUpperCase())}
                    className="h-9 w-11 cursor-pointer rounded border border-zinc-200 bg-white p-1"
                    aria-label="Accent color"
                  />
                  <input
                    type="text"
                    value={accentColorDraft}
                    onChange={(event) => setAccentColorDraft(event.target.value.toUpperCase())}
                    className="min-w-0 flex-1 bg-transparent font-mono text-sm text-zinc-900 outline-none"
                    placeholder={DEFAULT_TEAM_ACCENT_COLOR}
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy === "appearance"}
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === "appearance" ? "Saving…" : "Save theme"}
            </button>
          </form>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Team page games</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {TEAM_GAME_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={enabledGamesDraft.includes(option.key)}
                    onChange={() => toggleGame(option.key)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium text-zinc-900">{option.label}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => void saveEnabledGames()}
              disabled={busy === "games"}
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === "games" ? "Saving…" : "Save games"}
            </button>
          </div>

          <form
            className="rounded-2xl border border-zinc-200 bg-white p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void inviteDealer();
            }}
          >
            <h3 className="text-sm font-semibold text-zinc-900">Invite dealer</h3>
            <label className="mt-4 block text-xs font-medium text-zinc-700">Username URL ending</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={inviteUsername}
                onChange={(event) => setInviteUsername(event.target.value.toLowerCase())}
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
                placeholder="dealer_username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
              <button
                type="submit"
                disabled={busy === "invite"}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {busy === "invite" ? "Sending…" : "Send invite"}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Members</h3>
            <div className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
              {ownedTeam.members.map((member) => (
                <div key={member.userId} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-zinc-900">{member.name}</div>
                    <div className="text-xs text-zinc-500">{member.username ? `/${member.username}` : "No public username"}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">{member.role}</div>
                    {member.role === "member" ? (
                      <button
                        type="button"
                        onClick={() => setKickingMember(member)}
                        disabled={busy === `kick-${member.userId}`}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {busy === `kick-${member.userId}` ? "Kicking…" : "Kick"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Invites</h3>
            {state.invites.length ? (
              <div className="mt-3 space-y-3">
                {state.invites.map((invite) => (
                  <div key={invite.id} className="rounded-2xl border border-zinc-200 bg-[#fff7fb] p-4 text-sm">
                    <div className="font-medium text-zinc-900">{invite.teamName}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Invited by {invite.inviterName} {formatDate(invite.createdAt) ? `on ${formatDate(invite.createdAt)}` : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToInvite(invite.id, "accept")}
                        disabled={busy === `accept-${invite.id}` || busy === `decline-${invite.id}`}
                        className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
                      >
                        {busy === `accept-${invite.id}` ? "Accepting…" : "Accept"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToInvite(invite.id, "decline")}
                        disabled={busy === `accept-${invite.id}` || busy === `decline-${invite.id}`}
                        className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        {busy === `decline-${invite.id}` ? "Declining…" : "Decline"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-4 py-3 text-sm text-zinc-600">No pending invites.</div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-zinc-900">Your teams</h3>
            {state.teams.length ? (
              <div className="mt-3 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                {state.teams.map((team) => (
                  <div key={team.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <a className="font-medium text-zinc-900 hover:text-zinc-700" href={team.url}>{team.name}</a>
                      <div className="text-xs text-zinc-500">
                        {team.memberCount} dealer{team.memberCount === 1 ? "" : "s"} · {team.role}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <a className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50" href={team.url}>Open</a>
                      {team.role === "member" ? (
                        <button
                          type="button"
                          onClick={() => setLeavingTeam(team)}
                          disabled={busy === `leave-${team.id}`}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                        >
                          {busy === `leave-${team.id}` ? "Leaving…" : "Leave"}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">Owner</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-4 py-3 text-sm text-zinc-600">You are not in any teams yet.</div>
            )}
          </div>
        </div>
      ) : null}

      {leavingTeam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              You will leave <span className="font-medium text-zinc-900">{leavingTeam.name}</span>. You will need a new invite to join again.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setLeavingTeam(null)}
                disabled={busy === `leave-${leavingTeam.id}`}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void leaveTeam()}
                disabled={busy === `leave-${leavingTeam.id}`}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy === `leave-${leavingTeam.id}` ? "Leaving…" : "Leave team"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {kickingMember && ownedTeam ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-zinc-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              You will kick <span className="font-medium text-zinc-900">{kickingMember.name}</span> from{" "}
              <span className="font-medium text-zinc-900">{ownedTeam.name}</span>. They will need a new invite to join again.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setKickingMember(null)}
                disabled={busy === `kick-${kickingMember.userId}`}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void kickMember()}
                disabled={busy === `kick-${kickingMember.userId}`}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy === `kick-${kickingMember.userId}` ? "Kicking…" : "Kick member"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
