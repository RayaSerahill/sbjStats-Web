"use client";

import Link from "next/link";
import { useStatsPageNavLinks, type StatsNavKey } from "@/app/components/StatsPageNav";
import type { PublicStatsGame } from "@/lib/publicStatsRoutes";

const ICONS: Record<StatsNavKey, string> = {
  blackjack: "🃏",
  scratch: "🎟️",
  wheel: "🎡",
};

/** The shared nav in Fortune clothes: same links, pastel pills, no host colours. */
export function FortuneNav(props: {
  username: string;
  rootGame: PublicStatsGame;
  showBlackjack: boolean;
  showScratch: boolean;
  showWheel?: boolean;
}) {
  const links = useStatsPageNavLinks(props);
  if (links.length === 0) return null;

  return (
    <nav className="fortune-nav" aria-label="Stats navigation">
      <div className="fortune-nav-pills">
        {links.map((link) => (
          <Link
            key={link.key}
            href={link.href}
            className={`fortune-nav-pill${link.isActive ? " is-active" : ""}`}
            aria-current={link.isActive ? "page" : undefined}
          >
            <span aria-hidden>{ICONS[link.key]}</span>
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
