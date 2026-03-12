"use client";

import { useMemo, useState } from "react";

type AdminSection = "aliases" | "hidden-players" | "api-keys" | null;

export function AdminSectionsClient({
  gameImport,
  aliases,
  hiddenPlayers,
  apiKeys,
}: {
  userLabel: string;
  gameImport: React.ReactNode;
  aliases: React.ReactNode;
  hiddenPlayers: React.ReactNode;
  apiKeys: React.ReactNode;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>(null);

  const items = useMemo(
    () => [
      { id: null, label: "Game Import" },
      { id: "aliases" as const, label: "Aliases" },
      { id: "hidden-players" as const, label: "Hidden Players" },
      { id: "api-keys" as const, label: "API Keys" },
    ],
    []
  );

  const showSection = (id: AdminSection) => {
    setActiveSection(id);
    if (id) window.location.hash = id;
    else history.replaceState(null, "", window.location.pathname + window.location.search);
  };

  return (
    <div className="lg:relative">
      <aside className="hidden lg:block">
        <div className="fixed top-24 left-[max(1rem,calc(50%-36rem))] z-30 w-[245px]">
          <div className="rounded-3xl border border-[#FF9FC6]/35 bg-gradient-to-b from-white to-[#FF9FC6]/90 p-5 shadow-[0_0_0_1px_rgba(255,159,198,0.18),0_18px_60px_rgba(255,159,198,0.22)]">
            <div className="text-sm font-semibold text-zinc-900">Categories</div>

            <nav className="mt-4 space-y-2">
              {items.map((it) => {
                const selected = (it.id ?? null) === activeSection;

                return (
                  <button
                    key={it.label}
                    type="button"
                    onClick={() => showSection(it.id)}
                    className={[
                      "block w-full rounded-2xl border border-white/40 px-3 py-2 text-left text-sm font-medium text-zinc-900 shadow-[0_0_0_1px_rgba(255,159,198,0.10)] backdrop-blur transition",
                      selected ? "bg-white/80" : "bg-white/55 hover:bg-white/75",
                    ].join(" ")}
                  >
                    {it.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </aside>

      <main className="min-w-0">
        <section id="game-import" className="mt-6 scroll-mt-28">
          {gameImport}
        </section>

        <section id="aliases" className={["mt-6 scroll-mt-28", activeSection === "aliases" ? "" : "lg:hidden"].join(" ")}>
          {aliases}
        </section>

        <section
          id="hidden-players"
          className={["mt-6 scroll-mt-28", activeSection === "hidden-players" ? "" : "lg:hidden"].join(" ")}
        >
          {hiddenPlayers}
        </section>

        <section id="api-keys" className={["mt-6 scroll-mt-28", activeSection === "api-keys" ? "" : "lg:hidden"].join(" ")}>
          {apiKeys}
        </section>
      </main>
    </div>
  );
}
