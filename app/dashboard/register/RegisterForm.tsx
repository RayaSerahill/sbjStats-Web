"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PUBLIC_STATS_ORIGIN, PUBLIC_STATS_DOMAIN_OPTIONS } from "@/lib/publicStatsRoutes";

export default function RegisterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const oauthError = useMemo(() => searchParams.get("error"), [searchParams]);

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [statsOrigin, setStatsOrigin] = useState<string>(DEFAULT_PUBLIC_STATS_ORIGIN);
    const [error, setError] = useState<string | null>(oauthError);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setError(oauthError);
    }, [oauthError]);

    return (
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h1 className="text-xl font-semibold">Create dashboard account</h1>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Register for SBJ Stats with email and password or with Discord. New registrations require a whitelisted email address or Discord ID.
            </p>

            <button
                type="button"
                onClick={() => {
                    window.location.href = "/api/auth/discord/start";
                }}
                className="mt-6 flex w-full items-center justify-center rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
                Continue with Discord
            </button>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-zinc-400">
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                <span>or</span>
                <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
            </div>

            <form
                className="space-y-4"
                onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    setBusy(true);
                    try {
                        const res = await fetch("/api/auth/register", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email, password, name, username }),
                        });

                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) throw new Error(data?.error ?? "Registration failed");

                        router.replace("/dashboard");
                        router.refresh();
                    } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : "Registration failed");
                    } finally {
                        setBusy(false);
                    }
                }}
            >
                <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Display name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        placeholder="How your account should be displayed"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Username</label>
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                        Your public page works on both stats.serahill.net and stats.gamba.pro. Select the domain you prefer to share.
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Public stats domain">
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
                                            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                                            : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-600",
                                    ].join(" ")}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                    <div className="mt-2 flex items-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950">
                        <span className="whitespace-nowrap border-r border-zinc-200 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">{statsOrigin}/</span>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value.toLowerCase())}
                            autoComplete="username"
                            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none dark:text-zinc-100"
                            placeholder="enter-your-username"
                        />
                    </div>
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">3 to 32 characters. Use lowercase letters, numbers, hyphens, or underscores.</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
                        minLength={8}
                        required
                    />
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">Minimum 8 characters.</p>
                </div>

                {error ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                        {error}
                    </div>
                ) : null}

                <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                >
                    {busy ? "Creating…" : "Create account"}
                </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
                <Link href="/dashboard/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Back to login
                </Link>
                <Link href="/" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                    Back to site
                </Link>
            </div>
        </div>
    );
}
