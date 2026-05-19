"use client";

import { useEffect, useMemo, useState, createContext, useContext } from "react";

export type AdminSection =
  | "home"
  | "traffic"
  | "import"
  | "account"
  | "teams"
  | "games"
  | "scratch-games"
  | "scratch-prizes"
  | "aliases"
  | "hidden-players"
  | "api-keys"
  | "stats-style"
  | "global-aliases"
  | "users"
  | "whitelist"
  | null;

type NavGroup = "general" | "blackjack" | "scratch" | "admin";

type NavItem = {
  id: Exclude<AdminSection, null>;
  label: string;
  badgeCount?: number;
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
                                      teams,
                                      games,
                                      scratchGames,
                                      scratchPrizes,
                                      aliases,
                                      hiddenPlayers,
                                      apiKeys,
                                      statsStyle,
                                      globalAliases,
                                      users,
                                      whitelist,
                                      canManageUsers,
                                      teamInviteCount,
                                    }: {
  home: React.ReactNode;
  traffic: React.ReactNode;
  gameImport: React.ReactNode;
  account: React.ReactNode;
  teams: React.ReactNode;
  games: React.ReactNode;
  scratchGames: React.ReactNode;
  scratchPrizes: React.ReactNode;
  aliases: React.ReactNode;
  hiddenPlayers: React.ReactNode;
  apiKeys: React.ReactNode;
  statsStyle: React.ReactNode;
  globalAliases?: React.ReactNode;
  users?: React.ReactNode;
  whitelist?: React.ReactNode;
  canManageUsers: boolean;
  teamInviteCount?: number;
}) {
  const [activeSection, setActiveSection] = useState<AdminSection>("home");
  const [currentTeamInviteCount, setCurrentTeamInviteCount] = useState(teamInviteCount ?? 0);
  const [openGroups, setOpenGroups] = useState<Record<NavGroup, boolean>>({
    general: true,
    blackjack: true,
    scratch: true,
    admin: true,
  });

  useEffect(() => {
    const onInviteCount = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const count = typeof detail?.count === "number" ? detail.count : 0;
      setCurrentTeamInviteCount(count);
    };
    window.addEventListener("teams:invite-count", onInviteCount);
    return () => window.removeEventListener("teams:invite-count", onInviteCount);
  }, []);

  const groups = useMemo<NavCategory[]>(() => {
    const base: NavCategory[] = [
      {
        id: "general",
        label: "General",
        items: [
          { id: "home", label: "Home" },
          { id: "traffic", label: "Traffic" },
          { id: "account", label: "Account" },
          { id: "teams", label: "Teams", badgeCount: currentTeamInviteCount },
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
          { id: "import", label: "Game Import" },
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
        items: [
          { id: "global-aliases", label: "Global Aliases" },
          { id: "users", label: "Users" },
          { id: "whitelist", label: "Whitelist" },
        ],
      });
    }

    return base;
  }, [canManageUsers, currentTeamInviteCount]);

  const sectionToGroup = useMemo<Record<Exclude<AdminSection, null>, NavGroup>>(
    () => ({
      home: "general",
      traffic: "general",
      account: "general",
      teams: "general",
      aliases: "general",
      "hidden-players": "general",
      "stats-style": "general",
      "api-keys": "general",
      import: "blackjack",
      games: "blackjack",
      "scratch-games": "scratch",
      "scratch-prizes": "scratch",
      "global-aliases": "admin",
      users: "admin",
      whitelist: "admin",
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
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
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
                              aria-label={
                                it.badgeCount
                                  ? `${it.label}, ${it.badgeCount} pending invite${it.badgeCount === 1 ? "" : "s"}`
                                  : it.label
                              }
                              className={[
                                "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left text-sm font-medium text-zinc-900 transition",
                                selected ? "bg-white/80" : "bg-white/55 hover:bg-white/75",
                              ].join(" ")}
                            >
                              <span>{it.label}</span>
                              {it.badgeCount ? (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-none text-white shadow-sm">
                                  {it.badgeCount > 99 ? "99+" : it.badgeCount}
                                </span>
                              ) : null}
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

            <section id="traffic" className={["mt-6 scroll-mt-28", activeSection === "traffic" ? "" : "lg:hidden"].join(" ")}>
              {traffic}
            </section>

            <section id="import" className={["mt-6 scroll-mt-28", activeSection === "import" ? "" : "lg:hidden"].join(" ")}>
              {gameImport}
            </section>

            <section id="account" className={["mt-6 scroll-mt-28", activeSection === "account" ? "" : "lg:hidden"].join(" ")}>
              {account}
            </section>

            <section id="teams" className={["mt-6 scroll-mt-28", activeSection === "teams" ? "" : "lg:hidden"].join(" ")}>
              {teams}
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
              <section id="global-aliases" className={["mt-6 scroll-mt-28", activeSection === "global-aliases" ? "" : "lg:hidden"].join(" ")}>
                {globalAliases}
              </section>
            ) : null}

            {canManageUsers ? (
              <section id="users" className={["mt-6 scroll-mt-28", activeSection === "users" ? "" : "lg:hidden"].join(" ")}>
                {users}
              </section>
            ) : null}

            {canManageUsers ? (
              <section id="whitelist" className={["mt-6 scroll-mt-28", activeSection === "whitelist" ? "" : "lg:hidden"].join(" ")}>
                {whitelist}
              </section>
            ) : null}
          </main>
        </div>
      </>
    </AdminNavContext.Provider>
  );
}
