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

export function ScratchCharts({
                                dailyProfits,
                                fontColor,
                              }: {
  dailyProfits: GamesStatsDailyProfit[];
  fontColor: string;
}) {
  const labels = dailyProfits.map((day) => day.date);

  const cardsAndWinsData: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets: [
      {
        type: "line" as const,
        label: "Winning cards",
        data: dailyProfits.map((day) => day.totalWins),
        borderColor: "rgba(236, 72, 153, 1)",
        backgroundColor: "rgba(236, 72, 153, 0.2)",
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 5,
      },
      {
        type: "bar" as const,
        label: "Scratch cards",
        data: dailyProfits.map((day) => day.totalCards),
        backgroundColor: "rgba(59, 130, 246, 1)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
      },
    ],
  };

  const winValueData = {
    labels,
    datasets: [
      {
        label: "Money won",
        data: dailyProfits.map((day) => day.totalWinValue),
        borderColor: "rgba(34, 197, 94, 1)",
        backgroundColor: "rgba(34, 197, 94, 0.2)",
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
          color: "rgba(255,255,255,0.08)",
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
          color: "rgba(255,255,255,0.08)",
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
          color: "rgba(255,255,255,0.08)",
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
          color: "rgba(255,255,255,0.08)",
        },
      },
    },
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-black/10 p-4 shadow-sm">
        <div className="mb-3 mb-1 text-lg font-semibold" style={{ color: fontColor }}>
          Scratch cards and wins by day
        </div>
        <div className="h-[320px]">
          <Chart type="bar" data={cardsAndWinsData} options={commonOptions} />
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 p-4 shadow-sm">
        <div className="mb-3 font-semibold mb-1 text-lg" style={{ color: fontColor }}>
          Total win value by day
        </div>
        <div className="h-[320px]">
          <Line data={winValueData} options={winValueOptions} />
        </div>
      </div>
    </div>
  );
}
