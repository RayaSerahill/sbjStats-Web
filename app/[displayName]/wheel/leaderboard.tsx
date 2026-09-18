"use client";

import { useMemo, useState } from "react";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";
import "../../globals.css";

type LeaderboardPlayer = {
  name: string;
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
};

type Tab = "won" | "spins" | "games";

type LeaderboardProps = {
  fontColor: string;
  elementBackground: StatsBackgroundStyle;
  tableBackground: StatsBackgroundStyle;
  tableHeaderBackground: StatsBackgroundStyle;
  tableHeaderTextColor: string;
  tabContainerBackground: StatsBackgroundStyle;
  tabActiveBackground: StatsBackgroundStyle;
  tabInactiveBackground: StatsBackgroundStyle;
  tabHoverBackground: StatsBackgroundStyle;
  tabActiveTextColor: string;
  tabInactiveTextColor: string;
  tabHoverTextColor: string;
  players: LeaderboardPlayer[];
  leaderboardSize: number;
};

function metricFor(player: LeaderboardPlayer, tab: Tab) {
  return tab === "won" ? player.totalWinValue : tab === "spins" ? player.totalSpins : player.totalGames;
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "won", label: "Gil won" },
  { key: "spins", label: "Spins" },
  { key: "games", label: "Games" },
];

export function WheelLeaderboard({
  fontColor,
  elementBackground,
  tableBackground,
  tableHeaderBackground,
  tableHeaderTextColor,
  tabContainerBackground,
  tabActiveBackground,
  tabInactiveBackground,
  tabHoverBackground,
  tabActiveTextColor,
  tabInactiveTextColor,
  tabHoverTextColor,
  players,
  leaderboardSize,
}: LeaderboardProps) {
  const [tab, setTab] = useState<Tab>("won");
  const [hoveredTab, setHoveredTab] = useState<Tab | null>(null);
  const elementBackgroundStyle = useMemo(() => getBackgroundStyleCss(elementBackground), [elementBackground]);
  const tableBackgroundStyle = useMemo(() => getBackgroundStyleCss(tableBackground), [tableBackground]);
  const tableHeaderBackgroundStyle = useMemo(() => getBackgroundStyleCss(tableHeaderBackground), [tableHeaderBackground]);
  const tabContainerBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabContainerBackground), [tabContainerBackground]);
  const tabActiveBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabActiveBackground), [tabActiveBackground]);
  const tabInactiveBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabInactiveBackground), [tabInactiveBackground]);
  const tabHoverBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabHoverBackground), [tabHoverBackground]);

  const getButtonStyle = (buttonTab: Tab) => {
    if (tab === buttonTab) return { ...tabActiveBackgroundStyle, color: tabActiveTextColor };
    if (hoveredTab === buttonTab) return { ...tabHoverBackgroundStyle, color: tabHoverTextColor };
    return { ...tabInactiveBackgroundStyle, color: tabInactiveTextColor };
  };

  const activeLeaders = useMemo(
    () =>
      players
        .slice()
        .sort(
          (a, b) =>
            metricFor(b, tab) - metricFor(a, tab) ||
            b.totalWinValue - a.totalWinValue ||
            b.totalSpins - a.totalSpins ||
            b.totalGames - a.totalGames ||
            a.name.localeCompare(b.name)
        )
        .slice(0, leaderboardSize),
    [players, leaderboardSize, tab]
  );

  return (
    <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
      <div className="mb-4 grid gap-4 md:flex md:items-center md:justify-between">
        <div className="text-lg font-semibold" style={{ color: fontColor }}>Leaderboards</div>
        <div className="flex rounded-lg border border-black/10 p-1" style={tabContainerBackgroundStyle}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className="rounded-md px-3 py-2 text-sm transition"
              style={getButtonStyle(t.key)}
              onClick={() => setTab(t.key)}
              onMouseEnter={() => setHoveredTab(t.key)}
              onMouseLeave={() => setHoveredTab((current) => (current === t.key ? null : current))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeLeaders.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-black/10" style={tableBackgroundStyle}>
          <table className="w-full text-sm" style={{ color: fontColor }}>
            <thead>
              <tr className="border-b border-black/10 text-left" style={tableHeaderBackgroundStyle}>
                <th className="px-3 py-2 text-xs font-semibold" style={{ color: tableHeaderTextColor, opacity: 0.7 }}>#</th>
                <th className="px-3 py-2 text-xs font-semibold" style={{ color: tableHeaderTextColor, opacity: 0.7 }}>Player</th>
                <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: tableHeaderTextColor, opacity: 0.7 }}>Value</th>
              </tr>
            </thead>
            <tbody>
              {activeLeaders.map((player, idx) => (
                <tr key={player.name} className="border-b border-black/10 last:border-b-0">
                  <td className="px-3 py-2 align-middle">{idx + 1}</td>
                  <td className="px-3 py-2 align-middle font-medium">{player.name}</td>
                  <td className="px-3 py-2 text-right align-middle font-medium">{fmtInt(metricFor(player, tab))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 text-sm" style={{ color: fontColor, opacity: 0.75 }}>No players yet.</div>
      )}
    </div>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
