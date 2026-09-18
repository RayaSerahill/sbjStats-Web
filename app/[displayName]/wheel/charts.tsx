"use client";

import { Chart, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
} from "chart.js";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend);

type WheelDaily = {
  date: string;
  totalGames: number;
  totalSpins: number;
  totalWinValue: number;
};

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function WheelCharts({
  dailyProfits,
  fontColor,
  elementBackground,
  spinsColor,
  gamesColor,
  valueColor,
}: {
  dailyProfits: WheelDaily[];
  fontColor: string;
  elementBackground: StatsBackgroundStyle;
  spinsColor: string;
  gamesColor: string;
  valueColor: string;
}) {
  const labels = dailyProfits.map((day) => day.date);
  const elementBackgroundStyle = getBackgroundStyleCss(elementBackground);

  const spinsAndGamesData: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Games",
        data: dailyProfits.map((day) => day.totalGames),
        borderColor: gamesColor,
        backgroundColor: hexToRgba(gamesColor, 0.2),
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
      {
        type: "bar" as const,
        label: "Spins",
        data: dailyProfits.map((day) => day.totalSpins),
        backgroundColor: spinsColor,
        borderColor: spinsColor,
        borderWidth: 1,
      },
    ],
  };

  const winValueData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Gil won",
        data: dailyProfits.map((day) => day.totalWinValue),
        borderColor: valueColor,
        backgroundColor: hexToRgba(valueColor, 0.2),
        tension: 0.3,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
    ],
  };

  const axisTicks = (compact: boolean) => ({
    color: fontColor,
    callback(value: string | number) {
      return new Intl.NumberFormat("en-US", compact ? { notation: "compact", maximumFractionDigits: 1 } : { maximumFractionDigits: 0 }).format(
        Number(value)
      );
    },
  });

  const baseOptions = (compact: boolean) => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { labels: { color: fontColor } },
      tooltip: {
        callbacks: {
          label(context: { dataset: { label?: string }; parsed: { y?: number | null } }) {
            const label = context.dataset.label ?? "";
            const value = Number(context.parsed.y ?? 0);
            return `${label}: ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: fontColor }, grid: { color: `${fontColor}22` } },
      y: { beginAtZero: true, ticks: axisTicks(compact), grid: { color: `${fontColor}22` } },
    },
  });

  const spinsOptions = baseOptions(false) as ChartOptions<"bar" | "line">;
  const winValueOptions = baseOptions(true) as ChartOptions<"line">;

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
        <div className="mb-1 text-lg font-semibold" style={{ color: fontColor }}>
          Spins and games by day
        </div>
        <div className="h-[320px]">
          <Chart type="bar" data={spinsAndGamesData} options={spinsOptions} />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
        <div className="mb-1 text-lg font-semibold" style={{ color: fontColor }}>
          Gil won by day
        </div>
        <div className="h-[320px]">
          <Line data={winValueData} options={winValueOptions} />
        </div>
      </div>
    </div>
  );
}
