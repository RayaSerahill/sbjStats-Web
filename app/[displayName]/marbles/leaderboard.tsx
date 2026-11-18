"use client";

import { useMemo, useState } from "react";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";

type LeaderboardPlayer = {
  key: string;
  name: string;
  games: number;
  races: number;
  racesWon: number;
  tournamentsWon: number;
  won: number;
};

export type MarblesLeaderboardTab = "won" | "racesWon" | "tournamentsWon" | "games";
type Tab = MarblesLeaderboardTab;

type LeaderboardProps = {
  title: string;
  /** Which boards this card offers, in order. A single one is shown without a tab bar. */
  tabs: Tab[];
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

const TAB_LABELS: Record<Tab, string> = {
  won: "Gil won",
  racesWon: "Races won",
  tournamentsWon: "Tournaments",
  games: "Games",
};

/** Player leaderboard for the marbles page, in the scratch leaderboard's clothes. */
export function MarblesLeaderboard({
  title,
  tabs,
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
  const [selected, setTab] = useState<Tab>(tabs[0] ?? "won");
  const tab = tabs.includes(selected) ? selected : (tabs[0] ?? "won");
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

  const leaders = useMemo(
    () =>
      players
        .filter((player) => player[tab] > 0)
        .sort(
          (a, b) =>
            b[tab] - a[tab] || b.won - a.won || b.racesWon - a.racesWon || b.games - a.games || a.name.localeCompare(b.name)
        )
        .slice(0, leaderboardSize),
    [players, leaderboardSize, tab]
  );

  const headerCell = { color: tableHeaderTextColor, opacity: 0.7 };

  return (
    <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
      <div className="mb-4 grid gap-4">
        <div className="text-lg font-semibold" style={{ color: fontColor }}>{title}</div>
        {tabs.length > 1 ? (
          <div className="flex w-fit flex-wrap rounded-lg border border-black/10 p-1" style={tabContainerBackgroundStyle}>
            {tabs.map((key) => (
              <button
                key={key}
                className="rounded-md px-3 py-2 text-sm transition"
                style={getButtonStyle(key)}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
                onMouseEnter={() => setHoveredTab(key)}
                onMouseLeave={() => setHoveredTab((current) => (current === key ? null : current))}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {leaders.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-black/10" style={tableBackgroundStyle}>
          <table className="w-full text-sm" style={{ color: fontColor }}>
            <thead>
              <tr className="border-b border-black/10 text-left" style={tableHeaderBackgroundStyle}>
                <th className="px-3 py-2 text-xs font-semibold" style={headerCell}>#</th>
                <th className="px-3 py-2 text-xs font-semibold" style={headerCell}>Player</th>
                <th className="px-3 py-2 text-right text-xs font-semibold" style={headerCell}>Races</th>
                <th className="px-3 py-2 text-right text-xs font-semibold" style={headerCell}>
                  {TAB_LABELS[tab]}
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((player, idx) => (
                <tr key={player.key} className="border-b border-black/10 last:border-b-0">
                  <td className="px-3 py-2 align-middle">{idx + 1}</td>
                  <td className="px-3 py-2 align-middle font-medium">{player.name}</td>
                  <td className="px-3 py-2 text-right align-middle tabular-nums">{fmtInt(player.races)}</td>
                  <td className="px-3 py-2 text-right align-middle font-medium tabular-nums">{fmtInt(player[tab])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 text-sm" style={{ color: fontColor, opacity: 0.75 }}>Nobody on this board yet.</div>
      )}
    </div>
  );
}

function fmtInt(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}
