"use client";

import { useMemo, useState, createContext, useContext } from "react";

export type AdminSection =
  | "home"
  | "traffic"
  | "import"
  | "account"
  | "games"
  | "scratch-games"
  | "scratch-prizes"
  | "aliases"
  | "hidden-players"
  | "api-keys"
  | "stats-style"
  | "users"
  | null;

type NavGroup = "general" | "blackjack" | "scratch" | "admin";

type NavItem = {
  id: Exclude<AdminSection, null>;
  label: string;
};

type NavCategory = {
  id: NavGroup;
  label: string;
  items: NavItem[];
};

const AdminNavContext = createContext<(section: AdminSection) => void>(() => {});

export function useAdminNav() {
  return useContext(AdminNavContext);
}

export function AdminSectionsClient({
                                      home,
                                      traffic,
                                      gameImport,
                                      account,
                                      games,
                                      scratchGames,
                                      scratchPrizes,
                                      aliases,
                                      hiddenPlayers,
                                      apiKeys,
                                      statsStyle,
                                      users,
                                      canManageUsers,
                                    }: {
  home: React.ReactNode;
  traffic: React.ReactNode;
  gameImport: React.ReactNode;
  account: React.ReactNode;
  games: React.ReactNode;
  scratchGames: React.ReactNode;
  scratchPrizes: React.ReactNode;
  aliases: React.ReactNode;
  hiddenPlayers: React.ReactNode;
  apiKeys: React.ReactNode;
  statsStyle: React.ReactNode;
  users?: React.ReactNode;
  canManageUsers: boolean;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("home");
  const [openGroups, setOpenGroups] = useState<Record<NavGroup, boolean>>({
    general: true,
    blackjack: true,
    scratch: true,
    admin: true,
  });

  const groups = useMemo<NavCategory[]>(() => {
    const base: NavCategory[] = [
      {
        id: "general",
        label: "General",
        items: [
          { id: "home", label: "Home" },
          { id: "account", label: "Account" },
          { id: "aliases", label: "Aliases" },
          { id: "hidden-players", label: "Hidden Players" },
          { id: "stats-style", label: "Stats Style" },
          { id: "api-keys", label: "API Keys" },
        ],
      },
      {
        id: "blackjack",
        label: "Blackjack",
        items: [
          { id: "games", label: "Games" },
        ],
      },
      {
        id: "scratch",
        label: "Scratch",
        items: [
          { id: "scratch-games", label: "Games" },
          { id: "scratch-prizes", label: "Prizes" },
        ],
      },
    ];

    if (canManageUsers) {
      base.push({
        id: "admin",
        label: "Admin",
        items: [{ id: "users", label: "Users" }],
      });
    }

    return base;
  }, [canManageUsers]);

  const sectionToGroup = useMemo<Record<Exclude<AdminSection, null>, NavGroup>>(
    () => ({
      home: "general",
      traffic: "general",
      account: "general",
      aliases: "general",
      "hidden-players": "general",
      "stats-style": "general",
      "api-keys": "general",
      import: "blackjack",
      games: "blackjack",
      "scratch-games": "scratch",
      "scratch-prizes": "scratch",
      users: "admin",
    }),
    []
  );

  const toggleGroup = (group: NavGroup) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const showSection = (id: AdminSection) => {
    setActiveSection(id);

    if (id) {
      const group = sectionToGroup[id];
      setOpenGroups((prev) => ({
        ...prev,
        [group]: true,
      }));
      window.location.hash = id;
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  return (
    <AdminNavContext.Provider value={showSection}>
      <>
        <aside className="hidden lg:block">
          <div className="fixed admin-nav-container left-[max(1rem,calc(50%-36rem))] z-30 w-[245px]">
            <div className="rounded-3xl cute-border admin-item-container admin-nav">
              <nav className="mt-4 space-y-3">
                {groups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="flex w-full items-center justify-between px-1 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"
                    >
                      <span>{group.label}</span>
                      <span className="text-xs">{openGroups[group.id] ? "−" : "+"}</span>
                    </button>

                    {openGroups[group.id] ? (
                      <div className="space-y-2">
                        {group.items.map((it) => {
                          const selected = it.id === activeSection;

                          return (
                            <button
                              key={it.label}
                              type="button"
                              onClick={() => showSection(it.id)}
                              className={[
                                "block w-full rounded-2xl px-3 py-2 text-left text-sm font-medium text-zinc-900 transition",
                                selected ? "bg-white/80" : "bg-white/55 hover:bg-white/75",
                              ].join(" ")}
                            >
                              {it.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <div className="lg:relative">
          <main className="min-w-0">
            <section id="home" className={["mt-6 scroll-mt-28", activeSection === "home" ? "" : "lg:hidden"].join(" ")}>
              {home}
            </section>

            <section id="account" className={["mt-6 scroll-mt-28", activeSection === "account" ? "" : "lg:hidden"].join(" ")}>
              {account}
            </section>

            <section id="games" className={["mt-6 scroll-mt-28", activeSection === "games" ? "" : "lg:hidden"].join(" ")}>
              {games}
            </section>

            <section
              id="scratch-games"
              className={["mt-6 scroll-mt-28", activeSection === "scratch-games" ? "" : "lg:hidden"].join(" ")}
            >
              {scratchGames}
            </section>

            <section
              id="scratch-prizes"
              className={["mt-6 scroll-mt-28", activeSection === "scratch-prizes" ? "" : "lg:hidden"].join(" ")}
            >
              {scratchPrizes}
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

            {canManageUsers ? (
              <section id="users" className={["mt-6 scroll-mt-28", activeSection === "users" ? "" : "lg:hidden"].join(" ")}>
                {users}
              </section>
            ) : null}
          </main>
        </div>
      </>
    </AdminNavContext.Provider>
  );
}