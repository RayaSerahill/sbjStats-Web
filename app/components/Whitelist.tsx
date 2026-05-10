"use client";

import { useEffect, useMemo, useState } from "react";

type WhitelistType = "email" | "discord";

type WhitelistRow = {
  id: string;
  type: WhitelistType;
  value: string;
  createdAt: string;
  registered: boolean;
};

type WhitelistResponse = {
  whitelist?: WhitelistRow[];
  pending?: WhitelistRow[];
  error?: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function fmtDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function Whitelist() {
  const [type, setType] = useState<WhitelistType>("email");
  const [value, setValue] = useState("");
  const [rows, setRows] = useState<WhitelistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/admin/whitelist", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as WhitelistResponse;
    if (!res.ok) throw new Error(data?.error ?? "Failed to load whitelist");
    setRows(Array.isArray(data.whitelist) ? data.whitelist : []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (error: unknown) {
        setMessage(getErrorMessage(error, "Failed to load whitelist"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pendingRows = useMemo(
    () =>
      rows
        .filter((row) => !row.registered)
        .slice()
        .sort((a, b) => {
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          return a.value.localeCompare(b.value);
        }),
    [rows]
  );

  const totals = useMemo(
    () => ({
      total: rows.length,
      pending: pendingRows.length,
    }),
    [pendingRows.length, rows.length]
  );

  const placeholder = type === "email" ? "user@example.com" : "123456789012345678";
  const addLabel = type === "email" ? "Whitelist email" : "Whitelist Discord ID";

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Whitelist</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Only whitelisted email addresses or Discord IDs can create new accounts.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700">
          {totals.total} total · {totals.pending} pending
        </div>
      </div>

      <form
        className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage(null);
          setBusy(true);
          try {
            const res = await fetch("/api/admin/whitelist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type, value }),
            });
            const data = (await res.json().catch(() => ({}))) as WhitelistResponse;
            if (!res.ok) throw new Error(data?.error ?? "Failed to save whitelist entry");
            setValue("");
            await refresh();
            setMessage(type === "email" ? "Email added to whitelist" : "Discord ID added to whitelist");
          } catch (error: unknown) {
            setMessage(getErrorMessage(error, "Failed to save whitelist entry"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-600">Entry type</label>
            <div className="inline-flex rounded-2xl border border-zinc-200 bg-zinc-50 p-1">
              <button
                type="button"
                onClick={() => setType("email")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  type === "email" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => setType("discord")}
                className={[
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  type === "discord" ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900",
                ].join(" ")}
              >
                Discord ID
              </button>
            </div>
          </div>

          <label className="block text-sm">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-600">Value</span>
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={placeholder}
              className="w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-400"
            />
          </label>

          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="rounded-xl border border-zinc-300 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Saving…" : addLabel}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-600">
          Discord entries use the numeric Discord user ID, not the username.
        </p>
      </form>

      {message ? <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">{message}</div> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Pending registrations</h3>
              <p className="mt-1 text-xs text-zinc-600">Whitelisted entries with no account yet</p>
            </div>
            <button
              type="button"
              onClick={async () => {
                setMessage(null);
                setLoading(true);
                try {
                  await refresh();
                } catch (error: unknown) {
                  setMessage(getErrorMessage(error, "Failed to load whitelist"));
                } finally {
                  setLoading(false);
                }
              }}
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50"
            >
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-[auto_1fr] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-700">
            <div>Type</div>
            <div>Value</div>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-sm text-zinc-600">Loading…</div>
          ) : pendingRows.length ? (
            <div>
              {pendingRows.map((row) => (
                <div key={`pending-${row.id}`} className="grid grid-cols-[auto_1fr] gap-3 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {row.type === "email" ? "Email" : "Discord"}
                  </div>
                  <div className="min-w-0 truncate font-medium text-zinc-900">{row.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-zinc-600">No pending whitelist entries.</div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-200 px-4 py-3">
            <h3 className="text-sm font-semibold text-zinc-900">All whitelist entries</h3>
            <p className="mt-1 text-xs text-zinc-600">Registered entries stay listed.</p>
          </div>

          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-700">
            <div>Type</div>
            <div>Value</div>
            <div>Status</div>
            <div className="text-right">&nbsp;</div>
          </div>

          {loading ? (
            <div className="px-4 py-4 text-sm text-zinc-600">Loading…</div>
          ) : rows.length ? (
            <div>
              {rows.map((row) => (
                <div key={row.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-zinc-100 px-4 py-3 text-sm text-zinc-800 last:border-b-0">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-600">
                    {row.type === "email" ? "Email" : "Discord"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-900">{row.value}</div>
                    <div className="text-xs text-zinc-500">{fmtDate(row.createdAt)}</div>
                  </div>
                  <div className={row.registered ? "text-xs font-medium text-emerald-700" : "text-xs font-medium text-amber-700"}>
                    {row.registered ? "Registered" : "Pending"}
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        setMessage(null);
                        setBusyId(row.id);
                        try {
                          const res = await fetch(`/api/admin/whitelist/${row.id}`, { method: "DELETE" });
                          const data = (await res.json().catch(() => ({}))) as { error?: string };
                          if (!res.ok) throw new Error(data?.error ?? "Failed to remove whitelist entry");
                          await refresh();
                          setMessage("Whitelist entry removed");
                        } catch (error: unknown) {
                          setMessage(getErrorMessage(error, "Failed to remove whitelist entry"));
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId === row.id}
                      className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busyId === row.id ? "Removing…" : "Remove"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-4 text-sm text-zinc-600">No whitelist entries yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
