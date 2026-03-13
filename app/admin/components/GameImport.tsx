"use client";

import { useState } from "react";

export function GameImport() {
    const [payload, setPayload] = useState("");
    const [createdAt, setCreatedAt] = useState("");
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    return (
        <div className="mt-6 rounded-2xl cute-border admin-item-container">
            <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-zinc-900">Import a session</h2>
                <p className="text-xs text-zinc-600">Select the CSV file ^^</p>
            </div>

            <form className="mt-4 space-y-3">
                <div>
                    <label className="block text-xs font-medium text-zinc-800">Import CSV report</label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                            type="file"
                            accept=".csv,text/csv"
                            onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-[#FF9FC6] focus:ring-4 focus:ring-[#FF9FC6]/25"
                        />
                        <button
                            type="button"
                            disabled={busy || !csvFile}
                            className="rounded-xl bg-[#FF9FC6] px-4 py-2 text-sm font-medium text-zinc-900 shadow-[0_12px_28px_rgba(255,159,198,0.40)] transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF9FC6]/35 disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={async () => {
                                setMessage(null);
                                setBusy(true);
                                try {
                                    const fd = new FormData();
                                    fd.append("file", csvFile as File);
                                    const res = await fetch("/api/admin/games/import", { method: "POST", body: fd });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) throw new Error(data?.error ?? "CSV import failed");
                                    setMessage(`CSV imported. inserted=${data?.inserted ?? 0}, skipped=${data?.skipped ?? 0}, invalid=${data?.invalid ?? 0}`);
                                    setCsvFile(null);
                                } catch (err: any) {
                                    setMessage(err?.message ?? "CSV import failed");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            {busy ? "Importing…" : "Import CSV"}
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-zinc-600">Duplicates are skipped ^^</p>
                </div>
            </form>
        </div>
    );
}
