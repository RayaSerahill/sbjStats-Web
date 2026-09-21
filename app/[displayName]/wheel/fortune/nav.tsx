"use client";

import Link from "next/link";
import { useStatsPageNavLinks, type StatsNavKey } from "@/app/components/StatsPageNav";
import { getBackgroundStyleCss } from "@/lib/statsStyleShared";
import type { FortuneTheme } from "@/lib/fortuneTheme";
import type { PublicStatsGame } from "@/lib/publicStatsRoutes";

const ICONS: Record<StatsNavKey, string> = {
  blackjack: "🃏",
  scratch: "🎟️",
  wheel: "🎡",
};

/** The shared nav in Fortune clothes: same links, themed pills, no host nav colours. */
export function FortuneNav({
  theme,
  activeOverride,
  inert,
  ...linkProps
}: {
  username: string;
  rootGame: PublicStatsGame;
  showBlackjack: boolean;
  showScratch: boolean;
  showWheel?: boolean;
  theme: FortuneTheme;
  activeOverride?: StatsNavKey;
  /** In the live editor the links must not navigate away. */
  inert?: boolean;
}) {
  const links = useStatsPageNavLinks({ ...linkProps, activeOverride });
  if (links.length === 0) return null;

  return (
    <nav className="fortune-nav" aria-label="Stats navigation">
      <div className="fortune-nav-pills" style={getBackgroundStyleCss(theme.surfaces.nav)} data-edit="nav">
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className={`fortune-nav-pill${link.isActive ? " is-active" : ""}`}
            aria-current={link.isActive ? "page" : undefined}
            onClick={inert ? (e) => e.preventDefault() : undefined}
            {...(link.isActive ? { style: getBackgroundStyleCss(theme.surfaces.navActive), "data-edit": "navActive" } : {})}
          >
            <span aria-hidden>{ICONS[link.key]}</span>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
