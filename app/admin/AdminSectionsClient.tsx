"use client";

import { useMemo, useState } from "react";

type AdminSection = "import" | "account" | "aliases" | "hidden-players" | "api-keys" | "stats-style" | null;

export function AdminSectionsClient({
  gameImport,
  account,
  aliases,
  hiddenPlayers,
  apiKeys,
  statsStyle,
}: {
  gameImport: React.ReactNode;
  account: React.ReactNode;
  aliases: React.ReactNode;
  hiddenPlayers: React.ReactNode;
  apiKeys: React.ReactNode;
  statsStyle: React.ReactNode;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("import");

  const items = useMemo(
    () => [
      { id: "account" as const, label: "Account" },
      { id: "import" as const, label: "Game Import" },
      { id: "aliases" as const, label: "Aliases" },
      { id: "hidden-players" as const, label: "Hidden Players" },
      { id: "stats-style" as const, label: "Stats Style" },
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
    <>
      <aside className="hidden lg:block">
        <div className="fixed admin-nav-container left-[max(1rem,calc(50%-36rem))] z-30 w-[245px]">
          <div className="rounded-3xl cute-border admin-item-container admin-nav">
            <nav className="mt-4 space-y-2">
              {items.map((it) => {
                const selected = it.id === activeSection;

                return (
                  <button
                    key={it.label}
                    type="button"
                    onClick={() => showSection(it.id as AdminSection)}
                    className={[
                      "block w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-zinc-900 transition",
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
      <div className="lg:relative">
        <main className="min-w-0">
          <section id="import" className={["mt-6 scroll-mt-28", activeSection === "import" ? "" : "lg:hidden"].join(" ")}>
            {gameImport}
          </section>

          <section id="account" className={["mt-6 scroll-mt-28", activeSection === "account" ? "" : "lg:hidden"].join(" ")}>
            {account}
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

          <section id="stats-style" className={["mt-6 scroll-mt-28", activeSection === "stats-style" ? "" : "lg:hidden"].join(" ")}>
            {statsStyle}
          </section>
        </main>
      </div>
    </>
  );
}
