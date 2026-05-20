"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  Activity,
  ChartLine,
  Check,
  ChevronDown,
  EyeOff,
  Gamepad2,
  Gift,
  Home as HomeIcon,
  Key,
  Moon,
  Palette,
  Settings,
  ShieldCheck,
  Sun,
  Tags,
  Ticket,
  Upload,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { StatsFooterSection } from "@/app/components/StatsFooterSection";
import {
  DASHBOARD_THEME_OPTIONS,
  normalizeDashboardAccentColor,
  normalizeDashboardTheme,
} from "@/lib/account";
import type { DashboardTheme } from "@/lib/db";
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
  "scratch-settings": "/dashboard/scratch/settings",
  aliases: "/dashboard/aliases",
  "hidden-players": "/dashboard/hidden-players",
  "api-keys": "/dashboard/api-keys",
  "stats-style": "/dashboard/stats-style",
  "global-aliases": "/dashboard/admin/global-aliases",
  "admin-teams": "/dashboard/admin/teams",
  users: "/dashboard/admin/users",
  whitelist: "/dashboard/admin/whitelist",
};

const themeIcons: Record<DashboardTheme, LucideIcon> = {
  dark: Moon,
  mixed: Palette,
  light: Sun,
};

function hexToRgb(hex: string) {
  const normalized = normalizeDashboardAccentColor(hex).slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function colorWithAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorContrast(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? "#18181b" : "#ffffff";
}

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
        { id: "scratch-settings", href: "/dashboard/scratch/settings", label: "Settings", icon: Settings },
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
            className="dashboard-nav-group-button flex w-full items-center justify-between gap-3 px-1 text-left text-[11px] font-semibold uppercase tracking-[0.16em] transition"
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
                      "dashboard-nav-link flex min-h-10 w-full items-center justify-between gap-3 border px-3 py-2 text-left text-sm font-medium transition",
                      active ? "dashboard-nav-link--active" : "",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Icon className="dashboard-nav-icon h-4 w-4 shrink-0" aria-hidden />
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

function DashboardAppearanceControls({
  theme,
  accentColor,
  saving,
  saved,
  error,
  onThemeChange,
  onAccentColorChange,
  onSave,
}: {
  theme: DashboardTheme;
  accentColor: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
  onThemeChange: (theme: DashboardTheme) => void;
  onAccentColorChange: (accentColor: string) => void;
  onSave: () => void;
}) {
  return (
    <form
      className="dashboard-appearance-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="dashboard-appearance-segment" aria-label="Dashboard theme">
        {DASHBOARD_THEME_OPTIONS.map((option) => {
          const Icon = themeIcons[option.key];
          const active = theme === option.key;

          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onThemeChange(option.key)}
              aria-pressed={active}
              className={["dashboard-appearance-option", active ? "dashboard-appearance-option--active" : ""].join(" ")}
              title={`${option.label} theme`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      <label className="dashboard-color-control" title="Dashboard accent color">
        <span className="dashboard-color-label">Accent</span>
        <input
          type="color"
          value={accentColor}
          onChange={(event) => onAccentColorChange(event.target.value)}
          aria-label="Dashboard accent color"
        />
      </label>

      <button type="submit" disabled={saving} className="dashboard-appearance-save" title="Save dashboard appearance">
        {saved ? <Check className="h-4 w-4" aria-hidden /> : <Palette className="h-4 w-4" aria-hidden />}
        <span>{saving ? "Saving" : saved ? "Saved" : "Save"}</span>
      </button>

      {error ? <div className="dashboard-appearance-error">{error}</div> : null}
    </form>
  );
}

export function DashboardShell({
  children,
  userLabel,
  canManageUsers,
  teamInviteCount,
  initialTheme,
  initialAccentColor,
}: {
  children: ReactNode;
  userLabel: string;
  canManageUsers: boolean;
  teamInviteCount: number;
  initialTheme: DashboardTheme;
  initialAccentColor: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentTeamInviteCount, setCurrentTeamInviteCount] = useState(teamInviteCount);
  const [themeDraft, setThemeDraft] = useState<DashboardTheme>(() => normalizeDashboardTheme(initialTheme));
  const [accentColorDraft, setAccentColorDraft] = useState(() => normalizeDashboardAccentColor(initialAccentColor));
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [appearanceSaved, setAppearanceSaved] = useState(false);
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
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
    setThemeDraft(normalizeDashboardTheme(initialTheme));
    setAccentColorDraft(normalizeDashboardAccentColor(initialAccentColor));
  }, [initialAccentColor, initialTheme]);

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
  const dashboardAccentColor = normalizeDashboardAccentColor(accentColorDraft);
  const dashboardStyle = {
    "--dashboard-accent": dashboardAccentColor,
    "--dashboard-accent-soft": colorWithAlpha(dashboardAccentColor, themeDraft === "dark" ? 0.18 : 0.12),
    "--dashboard-accent-ring": colorWithAlpha(dashboardAccentColor, 0.35),
    "--dashboard-accent-contrast": colorContrast(dashboardAccentColor),
    "--dashboard-accent-shadow": colorWithAlpha(dashboardAccentColor, themeDraft === "dark" ? 0.32 : 0.22),
  } as CSSProperties;

  const toggleGroup = (group: NavGroupId) => {
    setOpenGroups((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const saveAppearance = async () => {
    setAppearanceSaving(true);
    setAppearanceSaved(false);
    setAppearanceError(null);

    try {
      const res = await fetch("/api/admin/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dashboardTheme: themeDraft,
          dashboardAccentColor,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to save dashboard appearance");

      setThemeDraft(normalizeDashboardTheme(data.account?.dashboardTheme));
      setAccentColorDraft(normalizeDashboardAccentColor(data.account?.dashboardAccentColor));
      setAppearanceSaved(true);
      router.refresh();
    } catch (err: unknown) {
      setAppearanceError(err instanceof Error ? err.message : "Failed to save dashboard appearance");
    } finally {
      setAppearanceSaving(false);
    }
  };

  return (
    <div
      className={["dashboard-shell-root container-main min-h-screen px-4 py-6 lg:px-8", `dashboard-theme-${themeDraft}`].join(" ")}
      style={dashboardStyle}
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="dashboard-panel sticky top-6 p-4">
            <div className="mb-5">
              <Link href="/dashboard" className="dashboard-brand text-base font-semibold">
                SimpleStats
              </Link>
              <p className="dashboard-muted mt-1 text-xs">Dashboard</p>
            </div>
            <DashboardNav groups={groups} openGroups={openGroups} onToggleGroup={toggleGroup} pathname={pathname} />
          </div>
        </aside>

        <div className="min-w-0">
          <header className="dashboard-panel p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="dashboard-muted text-xs font-semibold uppercase tracking-[0.18em]">
                  {currentItem?.label ?? "Dashboard"}
                </p>
                <h1 className="dashboard-title mt-1 text-xl font-semibold">Dashboard</h1>
                <p className="dashboard-muted mt-1 truncate text-sm">
                  Logged in as <span className="dashboard-title font-medium">{userLabel}</span>
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:items-end">
                <DashboardAppearanceControls
                  theme={themeDraft}
                  accentColor={dashboardAccentColor}
                  saving={appearanceSaving}
                  saved={appearanceSaved}
                  error={appearanceError}
                  onThemeChange={(nextTheme) => {
                    setThemeDraft(nextTheme);
                    setAppearanceSaved(false);
                  }}
                  onAccentColorChange={(nextAccentColor) => {
                    setAccentColorDraft(normalizeDashboardAccentColor(nextAccentColor));
                    setAppearanceSaved(false);
                  }}
                  onSave={() => void saveAppearance()}
                />
                <LogoutButton />
              </div>
            </div>
          </header>

          <div className="dashboard-panel mt-4 p-4 lg:hidden">
            <DashboardNav groups={groups} openGroups={openGroups} onToggleGroup={toggleGroup} pathname={pathname} />
          </div>

          <main className="mt-6 min-w-0">{children}</main>
          <StatsFooterSection />
        </div>
      </div>
    </div>
  );
}
