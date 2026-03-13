"use client";

import { useEffect, useState } from "react";

type AccountState = {
  email: string;
  username: string | null;
  suggestedUsername: string;
  statsUrl: string;
  name: string | null;
};

export function Account() {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [busy, setBusy] = useState<null | "displayName" | "username" | "email" | "password">(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [visibleUrlPrefix, setVisibleUrlPrefix] = useState("/stats/");

  const load = async () => {
    try {
      const res = await fetch("/api/admin/account", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load account");
      setAccount(data.account);
      setDisplayName(data.account.name ?? "");
      setUsername(data.account.username ?? data.account.suggestedUsername ?? "");
      setEmail(data.account.email ?? "");
    } catch (err: any) {
      setError(err?.message ?? "Failed to load account");
    }
  };

  useEffect(() => {
    void load();
    if (typeof window !== "undefined") {
      setVisibleUrlPrefix(`${window.location.origin}/stats/`);
    }
  }, []);

  const previewUsername = (username || account?.suggestedUsername || "").trim().toLowerCase();

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
    } catch (err: any) {
      setError(err?.message ?? "Failed to update display name");
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to update username");
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to update email");
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
    } catch (err: any) {
      setError(err?.message ?? "Failed to update password");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Account</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Update the title shown on your stats page, the public stats URL, email address, and password for this account.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
      ) : null}

      <div className="mt-4 grid account-container">
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
            disabled={busy === "displayName"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "displayName" ? "Saving…" : "Save display name"}
          </button>
        </form>

        <form
          className="rounded-2xl border border-zinc-200 bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveUsername();
          }}
        >
          <h3 className="text-sm font-semibold text-zinc-900">Username / stats URL</h3>
          <p className="mt-1 text-xs text-zinc-500">This controls the suffix used in your public stats page URL.</p>

          <label className="mt-4 block text-xs font-medium text-zinc-700">Public URL</label>
          <div className="mt-2 flex flex-col rounded-2xl border border-zinc-200 bg-[#fff7fb] px-3 py-3 text-sm text-zinc-900 sm:flex-row sm:items-center sm:gap-1">
            <span className="shrink-0 text-zinc-500">{visibleUrlPrefix}</span>
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
          <p className="mt-2 text-xs text-zinc-500">Preview: {visibleUrlPrefix}{previewUsername || "username"}</p>

          <button
            type="submit"
            disabled={busy === "username"}
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
          <p className="mt-1 text-xs text-zinc-500">No verification step yet. The new address becomes your login email immediately.</p>

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
            disabled={busy === "email"}
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
            disabled={busy === "password"}
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy === "password" ? "Saving…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
