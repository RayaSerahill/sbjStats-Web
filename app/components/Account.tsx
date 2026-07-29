"use client";

import { useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";
import {
  DEFAULT_PUBLIC_STATS_ORIGIN,
  normalizePublicStatsRootGame,
  normalizePublicStatsOrigin,
  PUBLIC_STATS_DOMAIN_OPTIONS,
  PUBLIC_STATS_GAME_OPTIONS,
  publicStatsGamePath,
  type PublicStatsGame,
} from "@/lib/publicStatsRoutes";

type AccountState = {
  email: string;
  username: string | null;
  suggestedUsername: string;
  statsUrl: string;
  name: string | null;
  discord: string | null;
  publicStatsRootGame: PublicStatsGame;
  deleted?: boolean;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function Account() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState<null | "displayName" | "username" | "rootGame" | "email" | "password" | "delete" | "discord">(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [rootGame, setRootGame] = useState<PublicStatsGame>("blackjack");
  const [statsOrigin, setStatsOrigin] = useState<string>(DEFAULT_PUBLIC_STATS_ORIGIN);

  const load = async () => {
    try {
      const res = await fetch("/api/admin/account", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load account");
      setAccount(data.account);
      setDisplayName(data.account.name ?? "");
      setUsername(data.account.username ?? data.account.suggestedUsername ?? "");
      setEmail(data.account.email ?? "");
      setRootGame(normalizePublicStatsRootGame(data.account.publicStatsRootGame));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load account"));
    }
  };

  useEffect(() => {
    void load();
    if (typeof window !== "undefined") {
      setStatsOrigin(normalizePublicStatsOrigin(window.location.origin));
      const params = new URLSearchParams(window.location.search);
      const successParam = params.get("success");
      const errorParam = params.get("error");
      if (successParam) setSuccess(successParam);
      if (errorParam) setError(errorParam);
      if (successParam || errorParam) {
        params.delete("success");
        params.delete("error");
        const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next);
      }
    }
  }, []);

  const saveDisplayName = async () => {
    setBusy("displayName");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update display name");
      setAccount((prev) => prev ? { ...prev, ...data.account } : prev);
      setDisplayName(data.account.name ?? displayName);
      setSuccess("Display name updated");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update display name"));
    } finally {
      setBusy(null);
    }
  };

  const saveUsername = async () => {
    setBusy("username");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update username");
      setAccount((prev) => prev ? { ...prev, ...data.account, suggestedUsername: data.account.username } : prev);
      setUsername(data.account.username ?? username);
      setSuccess("Username updated");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update username"));
    } finally {
      setBusy(null);
    }
  };

  const saveRootGame = async () => {
    setBusy("rootGame");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicStatsRootGame: rootGame }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update stats root game");
      const nextRootGame = normalizePublicStatsRootGame(data.account.publicStatsRootGame);
      setAccount((prev) => prev ? { ...prev, ...data.account, publicStatsRootGame: nextRootGame } : prev);
      setRootGame(nextRootGame);
      setSuccess("Stats main game updated");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update stats root game"));
    } finally {
      setBusy(null);
    }
  };

  const saveEmail = async () => {
    setBusy("email");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update email");
      setAccount((prev) => prev ? { ...prev, ...data.account } : prev);
      setEmail(data.account.email ?? email);
      setSuccess("Email updated");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update email"));
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async () => {
    setBusy("password");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, newPasswordConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update password");
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setSuccess("Password updated");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to update password"));
    } finally {
      setBusy(null);
    }
  };

  const connectDiscord = () => {
    setBusy("discord");
    setError(null);
    setSuccess(null);
    window.location.href = "/api/auth/discord/start?mode=connect";
  };

  const deleteAccount = async () => {
    if (!window.confirm("Are you sure")) return;
    if (!window.confirm("This is a permanent operation")) return;

    setBusy("delete");
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAccount: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete account");
      window.location.href = "/dashboard/login";
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to delete account"));
      setBusy(null);
    }
  };

  const publicName = username || account?.username || account?.suggestedUsername || "username";
  const normalizedRootGame = normalizePublicStatsRootGame(rootGame);
  const publicGameUrl = (game: PublicStatsGame) => `${statsOrigin}${publicStatsGamePath(publicName, game, normalizedRootGame)}`;

  const sharePublicUrl = async (game: PublicStatsGame) => {
    const url = publicGameUrl(game);
    const label = PUBLIC_STATS_GAME_OPTIONS.find((option) => option.key === game)?.label ?? game;
    setError(null);
    setSuccess(null);

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${label} stats`, url });
        setSuccess(`${label} stats link shared`);
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setSuccess(`${label} stats URL copied`);
    } catch {
      setError(`Copy this URL: ${url}`);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <DashboardPageHeader
        title="Account"
        description="Update the title shown on your stats page, the public stats URL, email address, password, and connected Discord account."
      />

      {account?.deleted ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This account is marked as deleted.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      ) : null}

      <div className="mt-6 space-y-6">
      <DashboardSection title="Profile and sign-in" bodyClassName="p-4">
      <div className="grid account-container gap-4">
        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveDisplayName();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Display name</h3>
          <p className="mt-1 text-xs text-zinc-500">This is the title shown on your stats page.</p>

          <label className="mt-4 block text-xs font-medium text-zinc-700">Display name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            placeholder="Your public display name"
            maxLength={80}
            required
          />

          <button
            type="submit"
            disabled={busy === "displayName" || busy === "delete" || busy === "discord"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "displayName" ? "Saving…" : "Save display name"}
          </button>
        </form>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveRootGame();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Game shown on main page</h3>
          <p className="mt-1 text-xs text-zinc-500">Choose which game opens from your base public URL.</p>

          <div className="mt-4">
            <div className="text-xs font-medium text-zinc-700">Share domain</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Public stats domain">
              {PUBLIC_STATS_DOMAIN_OPTIONS.map((option) => {
                const active = statsOrigin === option.origin;
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatsOrigin(option.origin)}
                    className={[
                      "rounded-xl border px-3 py-2 text-sm font-medium transition",
                      active
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
                    ].join(" ")}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-zinc-500">Both stats.serahill.net and stats.gamba.pro open the same public stats pages.</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Stats root game">
            {PUBLIC_STATS_GAME_OPTIONS.map((option) => {
              const active = normalizedRootGame === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRootGame(option.key)}
                  disabled={busy === "rootGame" || busy === "delete" || busy === "discord"}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm font-medium transition disabled:opacity-60",
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-3 text-xs text-zinc-700">
            {PUBLIC_STATS_GAME_OPTIONS.map((option, index) => (
              <div
                key={option.key}
                className={[
                  "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                  index > 0 ? "mt-2" : "",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900">{option.label}</div>
                  <div className="break-all font-mono">{publicGameUrl(option.key)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void sharePublicUrl(option.key)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:border-zinc-400 hover:bg-zinc-50"
                  aria-label={`Share ${option.label} stats URL`}
                >
                  <Share2 aria-hidden="true" size={14} />
                  Share
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={busy === "rootGame" || busy === "delete" || busy === "discord"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "rootGame" ? "Saving…" : "Save main game"}
          </button>
        </form>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveUsername();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Stats URL</h3>
          <p className="mt-1 text-xs text-zinc-500">This controls the path of your stats page. Use the selected share domain above when sharing it.</p>

          <label className="mt-4 block text-xs font-medium text-zinc-700">Public URL</label>
          <div className="mt-2 flex flex-col rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-3 text-sm text-zinc-900 sm:flex-row sm:items-center sm:gap-1">
            <span className="shrink-0 text-zinc-500">{statsOrigin}/</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              className="min-w-0 flex-1 bg-transparent font-medium outline-none"
              placeholder={account?.suggestedUsername ?? "username"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">Allowed: lowercase letters, numbers, hyphens, underscores. 3 to 32 characters.</p>

          <button
            type="submit"
            disabled={busy === "username" || busy === "delete" || busy === "discord"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "username" ? "Saving…" : "Save username"}
          </button>
        </form>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveEmail();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Email address</h3>
          <p className="mt-1 text-xs text-zinc-500">Change your email.</p>

          <label className="mt-4 block text-xs font-medium text-zinc-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            required
          />

          <button
            type="submit"
            disabled={busy === "email" || busy === "delete" || busy === "discord"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "email" ? "Saving…" : "Save email"}
          </button>
        </form>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void savePassword();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Change password</h3>
          <p className="mt-1 text-xs text-zinc-500">For safety, your current password is required before changing it.</p>

          <label className="mt-4 block text-xs font-medium text-zinc-700">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            autoComplete="current-password"
            required
          />

          <label className="mt-3 block text-xs font-medium text-zinc-700">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label className="mt-3 block text-xs font-medium text-zinc-700">Repeat new password</label>
          <input
            type="password"
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <button
            type="submit"
            disabled={busy === "password" || busy === "delete" || busy === "discord"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "password" ? "Saving…" : "Change password"}
          </button>
        </form>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-900">Discord</h3>
          <p className="mt-1 text-xs text-zinc-500">Connect your Discord account, in the future you can login with the discord account.</p>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-3 text-sm text-zinc-900">
            {account?.discord ? (
              <>
                <div className="text-xs uppercase tracking-wide text-zinc-500">Connected Discord ID</div>
                <div className="mt-1 font-medium">{account.discord}</div>
              </>
            ) : (
              <div className="text-zinc-600">No Discord account connected yet.</div>
            )}
          </div>

          {!account?.discord ? (
            <button
              type="button"
              onClick={connectDiscord}
              disabled={busy === "discord" || busy === "delete"}
              className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {busy === "discord" ? "Redirecting…" : "Connect Discord"}
            </button>
          ) : (
            <p className="mt-4 text-xs text-zinc-500">Logging in with this Discord account will now sign you into this user.</p>
          )}
        </div>
      </div>
      </DashboardSection>

      <DashboardSection title="Delete account" className="border-red-200" bodyClassName="bg-red-50 p-4">
        <p className="text-xs text-red-700">
          Delete your account! Note, this is a permanent operation. Your stats page will no longer be accessible, and you will need to register a new account to use the admin dashboard again.
        </p>
        <button
          type="button"
          onClick={() => void deleteAccount()}
          disabled={busy === "delete" || busy === "discord"}
          className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {busy === "delete" ? "Deleting…" : "Delete account"}
        </button>
      </DashboardSection>
      </div>
    </div>
  );
}
