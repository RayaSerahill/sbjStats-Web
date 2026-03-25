"use client";

import { useMemo, useState } from "react";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";
import "../../globals.css";

type LeaderboardPlayer = {
  name: string;
  totalCards: number;
  totalWins: number;
  totalWinValue: number;
};

type LeaderboardData = {
  players: LeaderboardPlayer[];
};

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
  data: LeaderboardData;
  leaderboardSize: number;
};

export function LeaderboardElement({
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
  data,
  leaderboardSize,
}: LeaderboardProps) {
  const [tab, setTab] = useState<"won" | "cards" | "wins">("won");
  const [hoveredTab, setHoveredTab] = useState<"won" | "cards" | "wins" | null>(null);
  const elementBackgroundStyle = useMemo(() => getBackgroundStyleCss(elementBackground), [elementBackground]);
  const tableBackgroundStyle = useMemo(() => getBackgroundStyleCss(tableBackground), [tableBackground]);
  const tableHeaderBackgroundStyle = useMemo(() => getBackgroundStyleCss(tableHeaderBackground), [tableHeaderBackground]);
  const tabContainerBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabContainerBackground), [tabContainerBackground]);
  const tabActiveBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabActiveBackground), [tabActiveBackground]);
  const tabInactiveBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabInactiveBackground), [tabInactiveBackground]);
  const tabHoverBackgroundStyle = useMemo(() => getBackgroundStyleCss(tabHoverBackground), [tabHoverBackground]);

  const getButtonStyle = (buttonTab: "won" | "cards" | "wins") => {
    if (tab === buttonTab) {
      return { ...tabActiveBackgroundStyle, color: tabActiveTextColor };
    }

    if (hoveredTab === buttonTab) {
      return { ...tabHoverBackgroundStyle, color: tabHoverTextColor };
    }

    return { ...tabInactiveBackgroundStyle, color: tabInactiveTextColor };
  };

  const leadersByWon = data.players
    .slice()
    .sort((a, b) =>
      b.totalWinValue - a.totalWinValue ||
      b.totalWins - a.totalWins ||
      b.totalCards - a.totalCards ||
      a.name.localeCompare(b.name)
    )
    .slice(0, leaderboardSize);

  const leadersByCards = data.players
    .slice()
    .sort((a, b) =>
      b.totalCards - a.totalCards ||
      b.totalWinValue - a.totalWinValue ||
      b.totalWins - a.totalWins ||
      a.name.localeCompare(b.name)
    )
    .slice(0, leaderboardSize);

  const leadersByWins = data.players
    .slice()
    .sort((a, b) =>
      b.totalWins - a.totalWins ||
      b.totalWinValue - a.totalWinValue ||
      b.totalCards - a.totalCards ||
      a.name.localeCompare(b.name)
    )
    .slice(0, leaderboardSize);

  const activeLeaders = tab === "won" ? leadersByWon : tab === "cards" ? leadersByCards : leadersByWins;

  const renderMetric = (player: LeaderboardPlayer) => {
    if (tab === "won") return fmtInt(player.totalWinValue);
    if (tab === "cards") return fmtInt(player.totalCards);
    return fmtInt(player.totalWins);
  };

  return (
    <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
      <div className="mb-4 grid gap-4 md:flex md:items-center md:justify-between">
        <div className="text-lg font-semibold" style={{ color: fontColor }}>Leaderboards</div>
        <div className="flex rounded-lg border border-black/10 p-1" style={tabContainerBackgroundStyle}>
          <button
            className="rounded-md px-3 py-2 text-sm transition"
            style={getButtonStyle("won")}
            onClick={() => setTab("won")}
            onMouseEnter={() => setHoveredTab("won")}
            onMouseLeave={() => setHoveredTab((current) => (current === "won" ? null : current))}
          >
            Gil won
          </button>
          <button
            className="rounded-md px-3 py-2 text-sm transition"
            style={getButtonStyle("cards")}
            onClick={() => setTab("cards")}
            onMouseEnter={() => setHoveredTab("cards")}
            onMouseLeave={() => setHoveredTab((current) => (current === "cards" ? null : current))}
          >
            Cards
          </button>
          <button
            className="rounded-md px-3 py-2 text-sm transition"
            style={getButtonStyle("wins")}
            onClick={() => setTab("wins")}
            onMouseEnter={() => setHoveredTab("wins")}
            onMouseLeave={() => setHoveredTab((current) => (current === "wins" ? null : current))}
          >
            Winning cards
          </button>
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
                  <td className="px-3 py-2 text-right align-middle font-medium">{renderMetric(player)}</td>
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
