"use client";
import {StatsBackgroundMode, StatsFontStyle, StatsGradientDirection, StatsImageFit} from "@/lib/statsStyleShared";
import { useState } from "react";
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
  fontColor: string,
  containerBackground: StatsBackgroundStyle,
  elementBackground: StatsBackgroundStyle,
  data: LeaderboardData,
  leaderboardSize: number,
};

export function LeaderboardElement({
                                     fontColor,
                                     containerBackground,
                                     elementBackground,
                                     data,
                                     leaderboardSize,
                                   } : LeaderboardProps) {
  const [tab, setTab] = useState<"won" | "cards" | "wins">("won");
  const getButtonClassName = (buttonTab: "won" | "cards" | "wins") =>
    `sc-lb-btn${tab === buttonTab ? " active-lb-btn" : ""}`;

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

  const activeLeaders =
    tab === "won" ? leadersByWon :
    tab === "cards" ? leadersByCards :
    leadersByWins;

  const metricLabel =
    tab === "won" ? "by gil won" :
    tab === "cards" ? "by cards" :
    "by winning cards";

  const renderMetric = (player: LeaderboardPlayer) => {
    if (tab === "won") {
      return fmtInt(player.totalWinValue);
    }

    if (tab === "cards") {
      return fmtInt(player.totalCards);
    }

    return fmtInt(player.totalWins);
  };

  return (
    <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackground}>
      <div className={"grid gap-4 md:flex md:items-center md:justify-between mb-4"}>
        <div className="mb-3 mb-1 text-lg font-semibold" style={{ color:fontColor }}>Leaderboards</div>
        <div className={"sc-lb-btn-ctn flex bg-[#f5dae6] rounded-lg justify-end"}>
          <button className={getButtonClassName("won") + " p-2"} onClick={() => setTab("won")}>Gil won</button>
          <button className={getButtonClassName("cards") + " p-2"} onClick={() => setTab("cards")}>Cards</button>
          <button className={getButtonClassName("wins") + " p-2"} onClick={() => setTab("wins")}>Winning cards</button>
        </div>
      </div>
      {activeLeaders.length ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-black/10">
          <table className="w-full text-sm bg-[#fdedf4]" style={{ color: fontColor }}>
            <thead>
              <tr className="border-b border-black/10 text-left bg-[#ffd7e8]">
                <th className="px-3 py-2 text-xs font-semibold" style={{ color: fontColor, opacity: 0.7 }}>#</th>
                <th className="px-3 py-2 text-xs font-semibold" style={{ color: fontColor, opacity: 0.7 }}>Player</th>
                <th className="px-3 py-2 text-right text-xs font-semibold" style={{ color: fontColor, opacity: 0.7 }}>Value</th>
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

export type StatsBackgroundStyle = {
  mode: StatsBackgroundMode;
  color: string;
  imageUrl: string;
  imageFit: StatsImageFit;
  gradientColors: string[];
  gradientDirection: StatsGradientDirection;
};

export type NormalizedStatsStyle = {
  background: StatsBackgroundStyle;
  containerBackground: StatsBackgroundStyle;
  elementBackground: StatsBackgroundStyle;
  fontColor: string;
  fontStyle: StatsFontStyle;
  leaderboardSize: number;
  pieChartColors: string[];
  barChartProfitColor: string;
  barChartLossColor: string;
  barChartDays: number;
};
