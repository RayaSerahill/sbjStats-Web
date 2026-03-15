"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from "chart.js";
import { Pie, Bar } from "react-chartjs-2";
import type { ChartOptions } from "chart.js";
import { getBackgroundStyleCss, type StatsBackgroundStyle } from "@/lib/statsStyleShared";
import type { DailyRow, DealerRow } from "@/lib/dealerStats";

type DealerStatsProps = {
  rows: DealerRow[];
  daily: DailyRow[];
  pieChartColors: string[];
  barChartProfitColor: string;
  barChartLossColor: string;
  barChartDays: number;
  fontColor: string;
  containerBackground: StatsBackgroundStyle;
  elementBackground: StatsBackgroundStyle;
};

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export function DealerStats({
  rows,
  daily,
  pieChartColors,
  barChartProfitColor,
  barChartLossColor,
  barChartDays,
  fontColor,
  containerBackground,
  elementBackground,
}: DealerStatsProps) {
  const totalHands = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.count) || 0), 0), [rows]);
  const containerBackgroundStyle = useMemo(() => getBackgroundStyleCss(containerBackground), [containerBackground]);
  const elementBackgroundStyle = useMemo(() => getBackgroundStyleCss(elementBackground), [elementBackground]);

  const safePieColors = useMemo(() => {
    const colors = pieChartColors.length ? pieChartColors : ["#ff0000", "#d52d00", "#ff9a56", "#ffffff", "#d162a4", "#a30262"];
    return rows.map((_, i) => colors[i % colors.length]);
  }, [rows, pieChartColors]);

  const pieOptions = useMemo<ChartOptions<"pie">>(
    () => ({
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = String(ctx.label ?? "");
              const value = Number(ctx.parsed) || 0;
              const dataArr = (ctx.dataset?.data ?? []) as Array<number | string>;
              const total = dataArr.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
              const pct = total > 0 ? (value / total) * 100 : 0;
              return `${label}: ${value} (${pct.toFixed(1)}%)`;
            },
          },
        },
        legend: {
          display: true,
          labels: {
            color: fontColor,
          },
        },
      },
    }),
    [fontColor]
  );

  const pieData = useMemo(
    () => ({
      labels: rows.map((r) => (Number(r.total) === 0 ? "bust" : String(r.total))),
      datasets: [
        {
          label: "Count",
          data: rows.map((r) => r.count),
          backgroundColor: safePieColors,
          borderColor: safePieColors,
          borderWidth: 1,
        },
      ],
    }),
    [rows, safePieColors]
  );

  const dailyLabels = useMemo(() => daily.map((d) => d.day), [daily]);
  const dailyBarColors = useMemo(() => daily.map((d) => (Number(d.profit) >= 0 ? barChartProfitColor : barChartLossColor)), [daily, barChartProfitColor, barChartLossColor]);

  const dailyBarData = useMemo(
    () => ({
      labels: dailyLabels,
      datasets: [
        {
          label: "Dealer profit",
          data: daily.map((d) => Number(d.profit) || 0),
          backgroundColor: dailyBarColors,
          borderColor: dailyBarColors,
          borderWidth: 1,
        },
      ],
    }),
    [daily, dailyLabels, dailyBarColors]
  );

  return (
    <div className="my-12">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold" style={{ color: fontColor }}>Dealer totals</div>
          <div className="text-sm opacity-70" style={{ color: fontColor }}>
            {`${totalHands} dealer hands`}
          </div>
        </div>
      </div>

      {rows.length > 0 || daily.length > 0 ? (
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {rows.length > 0 ? (
            <div className="w-full rounded-2xl border border-black/10 p-3 md:w-1/2" style={elementBackgroundStyle}>
              <Pie data={pieData} options={pieOptions} />
            </div>
          ) : null}

          {daily.length > 0 ? (
            <div className="w-full rounded-2xl border border-black/10 p-3 md:w-1/2" style={elementBackgroundStyle}>
              <div className="mb-1 text-lg font-semibold" style={{ color: fontColor }}>
                Daily dealer profit (last {barChartDays} dealing days)
              </div>
              <Bar
                data={dailyBarData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true },
                  },
                  scales: {
                    x: { ticks: { maxRotation: 0, autoSkip: true, color: fontColor }, grid: { color: `${fontColor}22` } },
                    y: { beginAtZero: false, ticks: { color: fontColor }, grid: { color: `${fontColor}22` } },
                  },
                }}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 p-4 text-sm" style={{ ...containerBackgroundStyle, color: fontColor }}>
          No dealer stats yet.
        </div>
      )}
    </div>
  );
}
