"use client";

import { useMemo, useState } from "react";
import { avatarFor, fmtGil, fmtInt } from "./format";

type Player = {
  name: string;
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
};

type Metric = "won" | "spins" | "games";

const TABS: Array<{ key: Metric; label: string; icon: string }> = [
  { key: "won", label: "Top Gil", icon: "💰" },
  { key: "spins", label: "Most Spins", icon: "🎡" },
  { key: "games", label: "Most Active", icon: "🎮" },
];

const COLUMNS: Array<{ key: Metric; label: string }> = [
  { key: "won", label: "Total Gil Won" },
  { key: "spins", label: "Total Spins" },
  { key: "games", label: "Games" },
];

function metricOf(player: Player, metric: Metric) {
  return metric === "won" ? player.totalWinValue : metric === "spins" ? player.totalSpins : player.totalGames;
}

function fmtMetric(value: number, metric: Metric) {
  return metric === "won" ? fmtGil(value) : fmtInt(value);
}

function rank(players: Player[], metric: Metric, size: number) {
  return players
    .slice()
    .sort(
      (a, b) =>
        metricOf(b, metric) - metricOf(a, metric) ||
        b.totalWinValue - a.totalWinValue ||
        b.totalSpins - a.totalSpins ||
        b.totalGames - a.totalGames ||
        a.name.localeCompare(b.name)
    )
    .slice(0, size);
}

const PODIUM = ["is-first", "is-second", "is-third"];

/**
 * Tabs drive the compact list on the left; the sort picker drives the
 * full table on the right, so a reader can eyeball two rankings at once.
 */
export function FortuneLeaderboard({ players, size }: { players: Player[]; size: number }) {
  const [tab, setTab] = useState<Metric>("won");
  const [sortBy, setSortBy] = useState<Metric>("won");

  const listed = useMemo(() => rank(players, tab, size), [players, tab, size]);
  const tabled = useMemo(() => rank(players, sortBy, size), [players, sortBy, size]);

  if (!players.length) {
    return <div className="fortune-empty">No spinners on the board yet.</div>;
  }

  return (
    <div className="fortune-card fortune-board">
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
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <label className="fortune-sort">
          Sort by
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as Metric)}>
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
            <li key={player.name} className={`fortune-rank-row ${PODIUM[i] ?? ""}`.trim()}>
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
                <th>#</th>
                <th>Player</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} className={`is-num${sortBy === column.key ? " is-sorted" : ""}`}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabled.map((player, i) => (
                <tr key={player.name}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="fortune-player">
                      <span className="fortune-avatar" aria-hidden>{avatarFor(player.name)}</span>
                      {player.name}
                    </span>
                  </td>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className={`is-num${sortBy === column.key ? " is-sorted" : ""}`}>
                      {fmtMetric(metricOf(player, column.key), column.key)}
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
