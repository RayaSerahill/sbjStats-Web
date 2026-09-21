"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  getBackgroundStyleCss,
  getStatsFontFamily,
  type StatsBackgroundStyle,
  type StatsFontStyle,
  type StatsNavItemStyle,
} from "@/lib/statsStyleShared";
import {
  normalizePublicStatsRootGame,
  publicStatsGamePath,
  type PublicStatsGame,
} from "@/lib/publicStatsRoutes";

type StatsPageNavProps = {
  username: string;
  rootGame: PublicStatsGame;
  showBlackjack: boolean;
  showScratch: boolean;
  showWheel?: boolean;
  background: StatsBackgroundStyle;
  borderRadius: number;
  fontColor: string;
  fontSize: number;
  fontStyle: StatsFontStyle;
  inactive: StatsNavItemStyle;
  hover: StatsNavItemStyle;
  active: StatsNavItemStyle;
};

export type StatsNavKey = "blackjack" | "scratch" | "wheel";
export type StatsNavLink = {
  key: StatsNavKey;
  href: string;
  label: string;
  isActive: boolean;
};
type NavKey = StatsNavKey;

/**
 * Which game links a host's public nav shows and which one is current.
 * Shared by every nav skin so they never disagree on the links.
 */
export function useStatsPageNavLinks({
  username,
  rootGame,
  showBlackjack,
  showScratch,
  showWheel = false,
  activeOverride,
}: {
  username: string;
  rootGame: PublicStatsGame;
  showBlackjack: boolean;
  showScratch: boolean;
  showWheel?: boolean;
  /** Force the current link, for pages that are not under the public stats path. */
  activeOverride?: StatsNavKey;
}): StatsNavLink[] {
  const pathname = usePathname();
  const normalizedRootGame = normalizePublicStatsRootGame(rootGame);
  const pathSegments = pathname?.split("/").filter(Boolean) ?? [];
  const lastPathSegment = pathSegments.at(-1);
  const activeKey: StatsNavKey =
    activeOverride ??
    (pathSegments.length >= 2 && (lastPathSegment === "blackjack" || lastPathSegment === "scratch" || lastPathSegment === "wheel")
      ? lastPathSegment
      : normalizedRootGame);

  const games: Array<{ key: StatsNavKey; label: string; show: boolean }> = [
    { key: "blackjack", label: "Blackjack", show: showBlackjack },
    { key: "scratch", label: "Scratch", show: showScratch },
    { key: "wheel", label: "Wheel", show: showWheel },
  ];

  return games
    .filter((game) => game.show)
    .map((game) => ({
      key: game.key,
      href: publicStatsGamePath(username, game.key, normalizedRootGame),
      label: game.label,
      isActive: activeKey === game.key,
    }));
}

export function StatsPageNav({
  username,
  rootGame,
  showBlackjack,
  showScratch,
  showWheel = false,
  background,
  borderRadius,
  fontColor,
  fontSize,
  fontStyle,
  inactive,
  hover,
  active,
}: StatsPageNavProps) {
  const [hovered, setHovered] = useState<NavKey | null>(null);
  const links = useStatsPageNavLinks({ username, rootGame, showBlackjack, showScratch, showWheel });

  const containerStyle = useMemo(
    () => ({
      ...getBackgroundStyleCss(background),
      borderRadius,
      color: fontColor,
      fontSize,
      fontFamily: getStatsFontFamily(fontStyle),
    }),
    [background, borderRadius, fontColor, fontSize, fontStyle]
  );

  if (links.length === 0) {
    return null;
  }

  const getItemStyle = (key: NavKey, isActive: boolean) => {
    const config = isActive ? active : hovered === key ? hover : inactive;
    return {
      ...getBackgroundStyleCss(config.background),
      borderRadius: config.borderRadius,
      color: config.fontColor,
      fontSize: config.fontSize,
      fontFamily: getStatsFontFamily(config.fontStyle),
    };
  };

  return (
    <nav className="mb-6" aria-label="Stats navigation">
      <div className="flex flex-wrap gap-2  p-2 justify-center w-fit m-auto" style={containerStyle}>
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className="inline-flex items-center px-4 py-2 transition"
            style={getItemStyle(link.key, link.isActive)}
            onMouseEnter={() => setHovered(link.key)}
            onMouseLeave={() => setHovered((current) => (current === link.key ? null : current))}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
