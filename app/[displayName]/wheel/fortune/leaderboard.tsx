"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { FortuneSurfaceKey, FortuneTheme } from "@/lib/fortuneTheme";
import { avatarFor, fmtGil, fmtInt, surfaceCss } from "./format";

type Player = {
  name: string;
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
  bankrupts: number;
  lostToBankrupt: number;
};

type Metric = "won" | "spins" | "games";
type Detail = "bankrupts" | "lost" | "perSpin";

const TABS: Array<{ key: Metric; label: string; icon: string }> = [
  { key: "won", label: "Top Gil", icon: "💰" },
  { key: "spins", label: "Most Spins", icon: "🎡" },
  { key: "games", label: "Most Active", icon: "🎮" },
];

const COLUMNS: Array<{ key: Detail; label: string; icon: string }> = [
  { key: "bankrupts", label: "Bankrupts", icon: "💣" },
  { key: "lost", label: "Lost to Bankrupts", icon: "💸" },
  { key: "perSpin", label: "Gil / Spin", icon: "🍀" },
];

function metricOf(player: Player, metric: Metric) {
  return metric === "won" ? player.totalWinValue : metric === "spins" ? player.totalSpins : player.totalGames;
}

function detailOf(player: Player, detail: Detail) {
  if (detail === "bankrupts") return player.bankrupts;
  if (detail === "lost") return player.lostToBankrupt;
  return player.totalSpins > 0 ? player.totalWinValue / player.totalSpins : 0;
}

function fmtMetric(value: number, metric: Metric) {
  return metric === "won" ? fmtGil(value) : fmtInt(value);
}

function fmtDetail(value: number, detail: Detail) {
  return detail === "bankrupts" ? fmtInt(value) : fmtGil(Math.round(value));
}

function tieBreak(a: Player, b: Player) {
  return b.totalWinValue - a.totalWinValue || b.totalSpins - a.totalSpins || b.totalGames - a.totalGames || a.name.localeCompare(b.name);
}

function rank(players: Player[], metric: Metric, size: number) {
  return players
    .slice()
    .sort((a, b) => metricOf(b, metric) - metricOf(a, metric) || tieBreak(a, b))
    .slice(0, size);
}

function rankDetail(players: Player[], detail: Detail, size: number) {
  return players
    .slice()
    .sort((a, b) => detailOf(b, detail) - detailOf(a, detail) || tieBreak(a, b))
    .slice(0, size);
}

const PODIUM = ["is-first", "is-second", "is-third"];

/**
 * Tabs drive the headline ranking on the left. The table on the right
 * holds the more obscure numbers (bankrupts, gil lost to them, gil per
 * spin) and the sort picker decides which of those leads.
 */
export function FortuneLeaderboard({ players, size, theme }: { players: Player[]; size: number; theme: FortuneTheme }) {
  const [tab, setTab] = useState<Metric>("won");
  const [sortBy, setSortBy] = useState<Detail>("bankrupts");

  const surface = (key: FortuneSurfaceKey): { style: CSSProperties; "data-edit": FortuneSurfaceKey } => ({
    style: surfaceCss(theme.surfaces[key]),
    "data-edit": key,
  });
  const sortedCell = (key: Detail) => (sortBy === key ? surface("tableSorted") : {});

  const listed = useMemo(() => rank(players, tab, size), [players, tab, size]);
  const tabled = useMemo(() => rankDetail(players, sortBy, size), [players, sortBy, size]);

  if (!players.length) {
    return <div className="fortune-empty">No spinners on the board yet.</div>;
  }

  return (
    <div className="fortune-card fortune-board" {...surface("card")}>
      <div className="fortune-board-top">
        <div className="fortune-tabs" role="tablist" aria-label="Leaderboard ranking">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`fortune-tab${tab === t.key ? " is-active" : ""}`}
              onClick={() => setTab(t.key)}
              {...(tab === t.key ? surface("tabActive") : {})}
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <label className="fortune-sort">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as Detail)}>
            {COLUMNS.map((column) => (
              <option key={column.key} value={column.key}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fortune-board-grid">
        <ol className="fortune-rank-list">
          {listed.map((player, i) => (
            <li key={player.name} className={`fortune-rank-row ${PODIUM[i] ?? ""}`.trim()} {...(i === 0 ? surface("podium") : {})}>
              <span className="fortune-rank-num">{i + 1}</span>
              <span className="fortune-avatar" aria-hidden>{avatarFor(player.name)}</span>
              <span className="fortune-rank-name" title={player.name}>{player.name}</span>
              <span className="fortune-rank-metric">{fmtMetric(metricOf(player, tab), tab)}</span>
            </li>
          ))}
        </ol>

        <div className="fortune-table-wrap">
          <table className="fortune-table">
            <thead>
              <tr>
                <th {...surface("tableHead")}>#</th>
                <th {...surface("tableHead")}>Player</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className={`is-num${sortBy === column.key ? " is-sorted" : ""}`} {...(sortBy === column.key ? sortedCell(column.key) : surface("tableHead"))}>
                    <span aria-hidden>{column.icon}</span> {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabled.map((player, i) => (
                <tr key={player.name}>
                  <td {...(i === 0 ? surface("podium") : {})}>{i + 1}</td>
                  <td {...(i === 0 ? surface("podium") : {})}>
                    <span className="fortune-player">
                      <span className="fortune-avatar" aria-hidden>{avatarFor(player.name)}</span>
                      {player.name}
                    </span>
                  </td>
                  {COLUMNS.map((column) => (
                    <td
                      key={column.key}
                      className={`is-num${sortBy === column.key ? " is-sorted" : ""}`}
                      {...(sortBy === column.key ? sortedCell(column.key) : i === 0 ? surface("podium") : {})}
                    >
                      {fmtDetail(detailOf(player, column.key), column.key)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
