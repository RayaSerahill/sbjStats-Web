"use client";

import { useEffect, useMemo, useState } from "react";

type AliasRow = {
  id: string;
  primaryTag: string;
  aliasTag: string;
  createdAt?: string;
  createdBy?: string;
};

type AliasDraft = {
  primaryTag: string;
  aliasTag: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function Aliases() {
  const [primaryTag, setPrimaryTag] = useState("");
  const [aliasTag, setAliasTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<AliasRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AliasDraft>>({});

  const sorted = useMemo(() => rows.slice().sort((a, b) => (a.primaryTag + a.aliasTag).localeCompare(b.primaryTag + b.aliasTag)), [rows]);

  const refresh = async () => {
    const res = await fetch("/api/admin/aliases", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Failed to load aliases");
    const nextRows: AliasRow[] = Array.isArray(data?.aliases) ? (data.aliases as AliasRow[]) : [];
    setRows(nextRows);
    const nextDrafts: Record<string, AliasDraft> = {};
    nextRows.forEach((row) => {
      nextDrafts[row.id] = { primaryTag: row.primaryTag, aliasTag: row.aliasTag };
    });
    setDrafts(nextDrafts);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } catch (error: unknown) {
        setMessage(getErrorMessage(error, "Failed to load aliases"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="section section-aliases mt-6 cute-border admin-item-container">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-zinc-900">Aliases</h2>
        <p className="text-xs text-zinc-600">Connect 2 player tags so they can be treated as the same player later</p>
      </div>

      <form
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault();
          setMessage(null);
          setBusy(true);
          try {
            const res = await fetch("/api/admin/aliases", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ primaryTag, aliasTag }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.error ?? "Failed to create alias");
            setPrimaryTag("");
            setAliasTag("");
            await refresh();
            setMessage("Alias saved");
          } catch (error: unknown) {
            setMessage(getErrorMessage(error, "Failed to create alias"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label className="block text-xs font-medium text-zinc-800">Primary playerTag</label>
          <input
            value={primaryTag}
            onChange={(e) => setPrimaryTag(e.target.value)}
            placeholder="Raya Serahill@Sagittarius"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
          />
          <p className="mt-2 text-xs text-zinc-600">One primary player can have multiple aliases.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-800">Alias playerTag</label>
          <input
            value={aliasTag}
            onChange={(e) => setAliasTag(e.target.value)}
            placeholder="Raya Serahill@Alpha"
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
          />
        </div>

        <button
          type="submit"
          disabled={busy || !primaryTag.trim() || !aliasTag.trim()}
          className="h-10 rounded-xl bg-[#FF9FC6] px-4 text-sm font-medium text-zinc-900 shadow-[0_12px_28px_rgba(255,159,198,0.40)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/35 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Saving…" : "Add alias"}
        </button>
      </form>

      {message ? <p className="mt-3 text-xs text-zinc-700">{message}</p> : null}

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">Existing aliases</h3>
          <button
            type="button"
            onClick={async () => {
              setMessage(null);
              setLoading(true);
              try {
                await refresh();
              } catch (error: unknown) {
                setMessage(getErrorMessage(error, "Failed to load aliases"));
              } finally {
                setLoading(false);
              }
            }}
            className="rounded-xl border border-[#FF9FC6]/35 bg-white px-3 py-2 text-xs font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(255,159,198,0.10)] transition hover:bg-[#FF9FC6]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/25 hover:cursor-pointer"
          >
            Refresh
          </button>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-0 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
            <div>Primary</div>
            <div>Alias</div>
            <div className="text-right">&nbsp;</div>
          </div>

          {loading ? (
            <div className="px-3 py-3 text-xs text-zinc-600">Loading…</div>
          ) : sorted.length ? (
            <div>
              {sorted.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border-b border-zinc-100 px-3 py-2 text-xs text-zinc-800 last:border-b-0">
                  <input
                    value={drafts[r.id]?.primaryTag ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [r.id]: {
                          primaryTag: e.target.value,
                          aliasTag: prev[r.id]?.aliasTag ?? r.aliasTag,
                        },
                      }))
                    }
                    className="min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
                  />
                  <input
                    value={drafts[r.id]?.aliasTag ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [r.id]: {
                          primaryTag: prev[r.id]?.primaryTag ?? r.primaryTag,
                          aliasTag: e.target.value,
                        },
                      }))
                    }
                    className="min-w-0 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const draft = drafts[r.id] ?? { primaryTag: r.primaryTag, aliasTag: r.aliasTag };
                        setMessage(null);
                        setSavingId(r.id);
                        try {
                          const res = await fetch(`/api/admin/aliases/${r.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify(draft),
                          });
                          const data = await res.json().catch(() => ({}));
                          if (!res.ok) throw new Error(data?.error ?? "Failed to update alias");
                          await refresh();
                          setMessage("Alias updated");
                        } catch (error: unknown) {
                          setMessage(getErrorMessage(error, "Failed to update alias"));
                        } finally {
                          setSavingId(null);
                        }
                      }}
                      disabled={
                        busy ||
                        removingId === r.id ||
                        savingId === r.id ||
                        !(drafts[r.id]?.primaryTag ?? r.primaryTag).trim() ||
                        !(drafts[r.id]?.aliasTag ?? r.aliasTag).trim() ||
                        (
                          (drafts[r.id]?.primaryTag ?? r.primaryTag).trim() === r.primaryTag &&
                          (drafts[r.id]?.aliasTag ?? r.aliasTag).trim() === r.aliasTag
                        )
                      }
                      className="rounded-xl border border-[#FF9FC6]/35 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-[#FF9FC6]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/25 disabled:cursor-not-allowed disabled:opacity-60 hover:cursor-pointer"
                    >
                      {savingId === r.id ? "Saving..." : "Save"}
                    </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setMessage(null);
                      setRemovingId(r.id);
                      try {
                        const res = await fetch(`/api/admin/aliases/${r.id}`, { method: "DELETE" });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error ?? "Failed to delete");
                        await refresh();
                      } catch (error: unknown) {
                        setMessage(getErrorMessage(error, "Failed to delete"));
                      } finally {
                        setRemovingId(null);
                      }
                    }}
                    disabled={busy || savingId === r.id || removingId === r.id}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/25 disabled:cursor-not-allowed disabled:opacity-60 hover:cursor-pointer"
                  >
                    {removingId === r.id ? "Removing..." : "Remove"}
                  </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-xs text-zinc-600">No aliases yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
