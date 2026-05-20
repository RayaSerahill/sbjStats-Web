"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ChartLine,
  ChevronDown,
  EyeOff,
  Gamepad2,
  Gift,
  Home as HomeIcon,
  Key,
  Palette,
  ShieldCheck,
  Tags,
  Ticket,
  Upload,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import { LogoutButton } from "./LogoutButton";

type NavGroupId = "general" | "blackjack" | "scratch" | "admin";

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  badgeCount?: number;
};

type NavGroup = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

const legacyHashToPath: Record<string, string> = {
  home: "/dashboard",
  traffic: "/dashboard/traffic",
  import: "/dashboard/blackjack/import",
  account: "/dashboard/account",
  teams: "/dashboard/teams",
  games: "/dashboard/blackjack/games",
  "scratch-games": "/dashboard/scratch/games",
  "scratch-prizes": "/dashboard/scratch/prizes",
  aliases: "/dashboard/aliases",
  "hidden-players": "/dashboard/hidden-players",
  "api-keys": "/dashboard/api-keys",
  "stats-style": "/dashboard/stats-style",
  "global-aliases": "/dashboard/admin/global-aliases",
  "admin-teams": "/dashboard/admin/teams",
  users: "/dashboard/admin/users",
  whitelist: "/dashboard/admin/whitelist",
};

function buildNavGroups(canManageUsers: boolean, teamInviteCount: number): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: "general",
      label: "General",
      items: [
        { id: "home", href: "/dashboard", label: "Home", icon: HomeIcon },
        { id: "traffic", href: "/dashboard/traffic", label: "Traffic", icon: Activity },
        { id: "account", href: "/dashboard/account", label: "Account", icon: User },
        { id: "teams", href: "/dashboard/teams", label: "Teams", icon: Users, badgeCount: teamInviteCount },
        { id: "aliases", href: "/dashboard/aliases", label: "Aliases", icon: Tags },
        { id: "hidden-players", href: "/dashboard/hidden-players", label: "Hidden Players", icon: EyeOff },
        { id: "stats-style", href: "/dashboard/stats-style", label: "Stats Style", icon: Palette },
        { id: "api-keys", href: "/dashboard/api-keys", label: "API Keys", icon: Key },
      ],
    },
    {
      id: "blackjack",
      label: "Blackjack",
      items: [
        { id: "import", href: "/dashboard/blackjack/import", label: "Game Import", icon: Upload },
        { id: "games", href: "/dashboard/blackjack/games", label: "Games", icon: Gamepad2 },
      ],
    },
    {
      id: "scratch",
      label: "Scratch",
      items: [
        { id: "scratch-games", href: "/dashboard/scratch/games", label: "Games", icon: Ticket },
        { id: "scratch-prizes", href: "/dashboard/scratch/prizes", label: "Prizes", icon: Gift },
      ],
    },
  ];

  if (canManageUsers) {
    groups.push({
      id: "admin",
      label: "Admin",
      items: [
        { id: "global-aliases", href: "/dashboard/admin/global-aliases", label: "Global Aliases", icon: ShieldCheck },
        { id: "admin-teams", href: "/dashboard/admin/teams", label: "Teams", icon: Users },
        { id: "users", href: "/dashboard/admin/users", label: "Users", icon: UserCog },
        { id: "whitelist", href: "/dashboard/admin/whitelist", label: "Whitelist", icon: ChartLine },
      ],
    });
  }

  return groups;
}

function itemIsActive(pathname: string, item: NavItem) {
  return pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
}

function DashboardNav({
  groups,
  openGroups,
  onToggleGroup,
  pathname,
}: {
  groups: NavGroup[];
  openGroups: Record<NavGroupId, boolean>;
  onToggleGroup: (group: NavGroupId) => void;
  pathname: string;
}) {
  return (
    <nav className="space-y-3" aria-label="Dashboard navigation">
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <button
            type="button"
            onClick={() => onToggleGroup(group.id)}
            className="flex w-full items-center justify-between gap-3 px-1 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 transition hover:text-zinc-900"
          >
            <span>{group.label}</span>
            <ChevronDown
              className={["h-4 w-4 transition-transform", openGroups[group.id] ? "rotate-0" : "-rotate-90"].join(" ")}
              aria-hidden
            />
          </button>

          {openGroups[group.id] ? (
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = itemIsActive(pathname, item);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={
                      item.badgeCount
                        ? `${item.label}, ${item.badgeCount} pending invite${item.badgeCount === 1 ? "" : "s"}`
                        : item.label
                    }
                    className={[
                      "flex min-h-10 w-full items-center justify-between gap-3 border px-3 py-2 text-left text-sm font-medium text-zinc-900 transition",
                      active
                        ? "border-[#FF9FC6] bg-[#fff1f7] shadow-[0_0_0_1px_rgba(255,159,198,0.20)]"
                        : "border-transparent bg-white/65 hover:border-[#FF9FC6]/40 hover:bg-white",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badgeCount ? (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-none text-white">
                        {item.badgeCount > 99 ? "99+" : item.badgeCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

export function DashboardShell({
  children,
  userLabel,
  canManageUsers,
  teamInviteCount,
}: {
  children: ReactNode;
  userLabel: string;
  canManageUsers: boolean;
  teamInviteCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentTeamInviteCount, setCurrentTeamInviteCount] = useState(teamInviteCount);
  const [openGroups, setOpenGroups] = useState<Record<NavGroupId, boolean>>({
    general: true,
    blackjack: true,
    scratch: true,
    admin: true,
  });

  const groups = useMemo(
    () => buildNavGroups(canManageUsers, currentTeamInviteCount),
    [canManageUsers, currentTeamInviteCount]
  );

  useEffect(() => {
    const legacyPath = legacyHashToPath[window.location.hash.slice(1)];
    if (pathname === "/dashboard" && legacyPath && legacyPath !== pathname) {
      router.replace(legacyPath);
    }
  }, [pathname, router]);

  useEffect(() => {
    const onInviteCount = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      const count = typeof detail?.count === "number" ? detail.count : 0;
      setCurrentTeamInviteCount(count);
    };

    window.addEventListener("teams:invite-count", onInviteCount);
    return () => window.removeEventListener("teams:invite-count", onInviteCount);
  }, []);

  const currentItem = groups.flatMap((group) => group.items).find((item) => itemIsActive(pathname, item));

  const toggleGroup = (group: NavGroupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  return (
    <div className="container-main min-h-screen bg-[#1c1b1b] px-4 py-6 text-zinc-900 lg:px-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-6 border border-[#FF9FC6] bg-white p-4">
            <div className="mb-5">
              <Link href="/dashboard" className="text-base font-semibold text-zinc-950">
                sbjStats
              </Link>
              <p className="mt-1 text-xs text-zinc-500">Dashboard</p>
            </div>
            <DashboardNav groups={groups} openGroups={openGroups} onToggleGroup={toggleGroup} pathname={pathname} />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border border-[#FF9FC6] bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {currentItem?.label ?? "Dashboard"}
                </p>
                <h1 className="mt-1 text-xl font-semibold text-zinc-950">Dashboard</h1>
                <p className="mt-1 truncate text-sm text-zinc-600">
                  Logged in as <span className="font-medium text-zinc-950">{userLabel}</span>
                </p>
              </div>
              <LogoutButton />
            </div>
          </header>

          <div className="mt-4 border border-[#FF9FC6] bg-white p-4 lg:hidden">
            <DashboardNav groups={groups} openGroups={openGroups} onToggleGroup={toggleGroup} pathname={pathname} />
          </div>

          <main className="mt-6 min-w-0">{children}</main>
          <StatsFooterSection />
        </div>
      </div>
    </div>
  );
}
