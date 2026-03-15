"use client";

import { useEffect, useMemo, useState } from "react";

type UserRole = "owner" | "admin" | "dealer";

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  username: string | null;
  name: string | null;
  deleted: boolean;
  createdAt: string;
};

type UsersResponse = {
  users: UserRow[];
  page: number;
  hasMore: boolean;
};

function fmtDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const emptyEditor = {
  id: "",
  email: "",
  username: "",
  name: "",
  role: "dealer" as UserRole,
  newPassword: "",
};

export function Users() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<UserRow | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState(emptyEditor);

  const buildUrl = (nextPage: number, search = appliedSearch) => {
    const params = new URLSearchParams();
    params.set("page", String(nextPage));
    if (search.trim()) params.set("q", search.trim());
    return `/api/admin/users?${params.toString()}`;
  };

  const load = async (nextPage: number, search = appliedSearch) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(buildUrl(nextPage, search), { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as Partial<UsersResponse> & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Failed to load users");
      setUsers(Array.isArray(data.users) ? data.users : []);
      setPage(typeof data.page === "number" ? data.page : nextPage);
      setHasMore(Boolean(data.hasMore));
    } catch (err: any) {
      setUsers([]);
      setMessage(err?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1, "");
  }, []);

  const title = useMemo(() => {
    const start = (page - 1) * 20 + 1;
    const end = start + Math.max(users.length - 1, 0);
    const base = users.length ? `Showing ${start}-${end}` : "No users found";
    return appliedSearch ? `${base} · search “${appliedSearch}”` : base;
  }, [appliedSearch, page, users.length]);

  const openEditor = (user: UserRow) => {
    setEditingId(user.id);
    setEditor({
      id: user.id,
      email: user.email,
      username: user.username ?? "",
      name: user.name ?? "",
      role: user.role,
      newPassword: "",
    });
  };

  const closeEditor = () => {
    setEditingId(null);
    setEditor(emptyEditor);
  };

  const saveUser = async () => {
    if (!editingId) return;
    setBusyId(editingId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editor.email,
          username: editor.username,
          name: editor.name,
          role: editor.role,
          newPassword: editor.newPassword || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to update user");
      setUsers((prev) => prev.map((row) => (row.id === editingId ? data.user : row)));
      setMessage("User updated");
      closeEditor();
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to update user");
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (user: UserRow) => {
    setBusyId(user.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete user");
      setConfirming(null);
      setUsers((prev) => prev.map((row) => (row.id === user.id ? { ...row, deleted: true } : row)));
      setMessage("User deleted");
      await load(page);
    } catch (err: any) {
      setMessage(err?.message ?? "Failed to delete user");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Users</h2>
          <p className="mt-1 text-sm text-zinc-600">List of all users and functions to edit their information or delete them, only visible to admins. </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">{title}</div>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Search by name or email</span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search users"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </label>

          <div className="flex gap-2 md:justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setAppliedSearch("");
                void load(1, "");
              }}
              disabled={loading || (!searchInput && !appliedSearch)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setAppliedSearch(searchInput.trim());
                void load(1, searchInput.trim());
              }}
              disabled={loading}
              className="rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="grid grid-cols-[1.3fr_.7fr_.8fr_1fr_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
          <div>Email</div>
          <div>Role</div>
          <div>Username</div>
          <div>Created</div>
          <div className="text-right">&nbsp;</div>
        </div>

        {loading ? (
          <div className="px-3 py-4 text-sm text-zinc-600">Loading…</div>
        ) : users.length ? (
          <div>
            {users.map((user) => (
              <div key={user.id} className="border-b border-zinc-100 last:border-b-0">
                <div className="grid grid-cols-[1.3fr_.7fr_.8fr_1fr_auto] items-center gap-3 px-3 py-2 text-sm text-zinc-800">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900">{user.email}</div>
                    <div className="truncate text-xs text-zinc-500">{user.name || "No display name"}{user.deleted ? " · Deleted" : ""}</div>
                  </div>
                  <div className="capitalize">{user.role}</div>
                  <div className="truncate">{user.username || "—"}</div>
                  <div className="text-xs text-zinc-600">{fmtDate(user.createdAt)}</div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openEditor(user)}
                      disabled={busyId === user.id}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(user)}
                      disabled={busyId === user.id || user.deleted}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {editingId === user.id ? (
                  <div className="border-t border-zinc-100 bg-zinc-50 px-3 py-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Email</span>
                        <input value={editor.email} onChange={(e) => setEditor((prev) => ({ ...prev, email: e.target.value }))} type="email" className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Username</span>
                        <input value={editor.username} onChange={(e) => setEditor((prev) => ({ ...prev, username: e.target.value.toLowerCase() }))} type="text" className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Display name</span>
                        <input value={editor.name} onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))} type="text" className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400" />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">Role</span>
                        <select value={editor.role} onChange={(e) => setEditor((prev) => ({ ...prev, role: e.target.value as UserRole }))} className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400">
                          <option value="owner">owner</option>
                          <option value="admin">admin</option>
                          <option value="dealer">dealer</option>
                        </select>
                      </label>
                      <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-600">New password</span>
                        <input value={editor.newPassword} onChange={(e) => setEditor((prev) => ({ ...prev, newPassword: e.target.value }))} type="password" minLength={8} placeholder="Leave blank to keep current password" className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400" />
                      </label>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => void saveUser()} disabled={busyId === user.id} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60">{busyId === user.id ? "Saving…" : "Save user"}</button>
                      <button type="button" onClick={closeEditor} disabled={busyId === user.id} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60">Cancel</button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-4 text-sm text-zinc-600">No users matched your search.</div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => void load(page - 1)} disabled={loading || page <= 1} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">Previous</button>
        <div className="text-xs text-zinc-500">Page {page}</div>
        <button type="button" onClick={() => void load(page + 1)} disabled={loading || !hasMore} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-zinc-900">Delete user</h3>
            <p className="mt-2 text-sm text-zinc-600">Are you sure you want to delete <span className="font-medium text-zinc-900">{confirming.email}</span>? This marks the account as deleted and blocks future access.</p>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setConfirming(null)} disabled={busyId === confirming.id} className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-60">Cancel</button>
              <button type="button" onClick={() => void deleteUser(confirming)} disabled={busyId === confirming.id} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60">{busyId === confirming.id ? "Deleting…" : "Delete user"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
