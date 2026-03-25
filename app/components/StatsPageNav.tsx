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

type StatsPageNavProps = {
  username: string;
  showBlackjack: boolean;
  showScratch: boolean;
  background: StatsBackgroundStyle;
  borderRadius: number;
  fontColor: string;
  fontSize: number;
  fontStyle: StatsFontStyle;
  inactive: StatsNavItemStyle;
  hover: StatsNavItemStyle;
  active: StatsNavItemStyle;
};

type NavKey = "blackjack" | "scratch";
type NavLink = {
  key: NavKey;
  href: string;
  label: string;
  isActive: boolean;
};

export function StatsPageNav({
  username,
  showBlackjack,
  showScratch,
  background,
  borderRadius,
  fontColor,
  fontSize,
  fontStyle,
  inactive,
  hover,
  active,
}: StatsPageNavProps) {
  const pathname = usePathname();
  const [hovered, setHovered] = useState<NavKey | null>(null);

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

  const links: NavLink[] = [
    showBlackjack
      ? {
          key: "blackjack" as const,
          href: `/${encodeURIComponent(username)}`,
          label: "Blackjack",
          isActive: !pathname?.endsWith("/scratch"),
        }
      : null,
    showScratch
      ? {
          key: "scratch" as const,
          href: `/${encodeURIComponent(username)}/scratch`,
          label: "Scratch",
          isActive: Boolean(pathname?.endsWith("/scratch")),
        }
      : null,
  ].filter((link): link is NavLink => link !== null);

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
