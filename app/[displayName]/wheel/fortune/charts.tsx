"use client";

import { Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { getBackgroundStyleCss } from "@/lib/statsStyleShared";
import type { FortuneTheme } from "@/lib/fortuneTheme";
import { fmtCompact, fmtInt } from "./format";

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

type Daily = { date: string; totalGames: number; totalSpins: number; totalWinValue: number };

const GRID = "rgba(123, 116, 151, 0.14)";

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function sparkOptions(compact: boolean, muted: string): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label ?? ""}: ${fmtInt(Number(context.parsed.y ?? 0))}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: muted, font: { size: 10 }, maxTicksLimit: 7, maxRotation: 0 },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: muted,
          font: { size: 10 },
          maxTicksLimit: 5,
          callback(value) {
            return compact ? fmtCompact(Number(value)) : fmtInt(Number(value));
          },
        },
        grid: { color: GRID },
      },
    },
  };
}

function Spark({
  label,
  colorKey,
  labels,
  data,
  compact,
  theme,
}: {
  label: string;
  colorKey: "chartGames" | "chartGil";
  labels: string[];
  data: number[];
  compact: boolean;
  theme: FortuneTheme;
}) {
  const color = theme.colors[colorKey];
  const chart: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label,
        data,
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.25),
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderWidth: 2,
      },
    ],
  };
  return (
    <div className="fortune-card fortune-chart-card" style={getBackgroundStyleCss(theme.surfaces.card)} data-edit="card">
      <div className="fortune-chart-label">
        <span className="fortune-chart-dot" style={{ background: color }} />
        {label}
      </div>
      <div className="fortune-chart-box" data-edit={colorKey}>
        <Line data={chart} options={sparkOptions(compact, theme.colors.muted)} />
      </div>
    </div>
  );
}

/** Two little area charts: games per day and gil per day. */
export function FortuneDailyCharts({ days, theme }: { days: Daily[]; theme: FortuneTheme }) {
  const labels = days.map((day) => day.date.slice(5));
  return (
    <div className="fortune-chart-grid">
      <Spark label="Games" colorKey="chartGames" labels={labels} data={days.map((day) => day.totalGames)} compact={false} theme={theme} />
      <Spark label="Gil" colorKey="chartGil" labels={labels} data={days.map((day) => day.totalWinValue)} compact theme={theme} />
    </div>
  );
}

/** Donut of which prizes actually land, with a legend that carries the share. */
export function FortuneOutcomeDonut({ slices, theme }: { slices: Array<{ name: string; count: number }>; theme: FortuneTheme }) {
  const colors = theme.donut;
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const data: ChartData<"doughnut", number[], string> = {
    labels: slices.map((slice) => slice.name),
    datasets: [
      {
        data: slices.map((slice) => slice.count),
        backgroundColor: slices.map((_, i) => colors[i % colors.length]),
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };
  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: { display: false },
      tooltip: {
        bodyColor: "#ffffff",
        titleColor: "#ffffff",
        callbacks: {
          label(context) {
            const count = Number(context.parsed ?? 0);
            const share = total > 0 ? Math.round((count / total) * 100) : 0;
            return `${context.label}: ${fmtInt(count)} (${share}%)`;
          },
        },
      },
    },
  };

  return (
    <div className="fortune-card fortune-donut" style={getBackgroundStyleCss(theme.surfaces.card)} data-edit="card">
      <div className="fortune-donut-box" data-edit="donut">
        <Doughnut data={data} options={options} />
      </div>
      <ul className="fortune-legend" style={{ color: theme.colors.ink }}>
        {slices.map((slice, i) => (
          <li key={slice.name}>
            <span className="fortune-chart-dot" style={{ background: colors[i % colors.length] }} />
            <span className="fortune-legend-name" title={slice.name}>{slice.name}</span>
            <span className="fortune-legend-share">{total > 0 ? Math.round((slice.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
