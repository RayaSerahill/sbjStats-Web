"use client";

import { useEffect, useState } from "react";

type ApiKeyState = {
  prefix: string;
  createdAt: string | null;
} | null;

export function ApiKeys() {
  const [apiKey, setApiKey] = useState<ApiKeyState>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await fetch("/api/admin/api-key", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load API key");
      setApiKey(data.apiKey ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load API key");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const createOrRegenerate = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/api-key", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to generate API key");
      setFreshKey(data.apiKey ?? null);
      setApiKey({ prefix: data.prefix, createdAt: data.createdAt ?? null });
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate API key");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/admin/api-key", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete API key");
      setFreshKey(null);
      setApiKey(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to delete API key");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-3xl cute-border admin-item-container">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">API Key</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Generate one personal key for scripts and uploads. Regenerating immediately invalidates the old one.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[#FF9FC6]/30 bg-[#fff7fb] p-4 text-sm text-zinc-700">
        <div className="font-medium text-zinc-900">Accepted auth headers</div>
        <div className="mt-2 font-mono text-xs text-zinc-700">Authorization: Bearer YOUR_API_KEY</div>
        <div className="mt-1 font-mono text-xs text-zinc-700">x-api-key: YOUR_API_KEY</div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700">
          {apiKey ? (
            <>
              <div>
                Active key prefix: <span className="font-mono text-zinc-900">{apiKey.prefix}…</span>
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Created {apiKey.createdAt ? new Date(apiKey.createdAt).toLocaleString() : "just now"}
              </div>
            </>
          ) : (
            <div>No API key generated yet.</div>
          )}
        </div>

        {freshKey ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <div className="font-medium">New API key</div>
            <div className="mt-2 break-all rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-zinc-900">
              {freshKey}
            </div>
            <div className="mt-2 text-xs text-emerald-800">
              This is the only time the full key is shown. Copy it somewhere safe before leaving this page.
            </div>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(freshKey);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1600);
              }}
              className="mt-3 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-medium text-emerald-900 transition hover:bg-emerald-100"
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void createOrRegenerate()}
          disabled={busy}
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {busy ? "Working…" : apiKey ? "Regenerate key" : "Generate key"}
        </button>

        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy || !apiKey}
          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50"
        >
          Delete key
        </button>
      </div>
    </div>
  );
}
