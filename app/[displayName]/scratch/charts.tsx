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

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type GamesStatsDailyProfit = {
  date: string;
  totalCards: number;
  totalWins: number;
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

export function ScratchCharts({
  dailyProfits,
  fontColor,
  elementBackground,
  cardsColor,
  winsColor,
  valueColor,
}: {
  dailyProfits: GamesStatsDailyProfit[];
  fontColor: string;
  elementBackground: StatsBackgroundStyle;
  cardsColor: string;
  winsColor: string;
  valueColor: string;
}) {
  const labels = dailyProfits.map((day) => day.date);
  const elementBackgroundStyle = getBackgroundStyleCss(elementBackground);

  const cardsAndWinsData: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Winning cards",
        data: dailyProfits.map((day) => day.totalWins),
        borderColor: winsColor,
        backgroundColor: hexToRgba(winsColor, 0.2),
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
      {
        type: "bar" as const,
        label: "Scratch cards",
        data: dailyProfits.map((day) => day.totalCards),
        backgroundColor: cardsColor,
        borderColor: cardsColor,
        borderWidth: 1,
      },
    ],
  };

  const winValueData: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      {
        label: "Money won",
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

  const commonOptions: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: fontColor,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const label = context.dataset.label ?? "";
            const value = Number(context.parsed.y ?? 0);
            return `${label}: ${new Intl.NumberFormat("en-US").format(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: fontColor,
        },
        grid: {
          color: `${fontColor}22`,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: fontColor,
          callback(value) {
            return new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 0,
            }).format(Number(value));
          },
        },
        grid: {
          color: `${fontColor}22`,
        },
      },
    },
  };

  const winValueOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: fontColor,
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            const label = context.dataset.label ?? "";
            const value = Number(context.parsed.y ?? 0);
            return `${label}: ${new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 0,
            }).format(value)}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: fontColor,
        },
        grid: {
          color: `${fontColor}22`,
        },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: fontColor,
          callback(value) {
            return new Intl.NumberFormat("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(Number(value));
          },
        },
        grid: {
          color: `${fontColor}22`,
        },
      },
    },
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
        <div className="mb-1 text-lg font-semibold" style={{ color: fontColor }}>
          Scratch cards and wins by day
        </div>
        <div className="h-[320px]">
          <Chart type="bar" data={cardsAndWinsData} options={commonOptions} />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 p-4 shadow-sm" style={elementBackgroundStyle}>
        <div className="mb-1 text-lg font-semibold" style={{ color: fontColor }}>
          Total win value by day
        </div>
        <div className="h-[320px]">
          <Line data={winValueData} options={winValueOptions} />
        </div>
      </div>
    </div>
  );
}
