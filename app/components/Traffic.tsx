"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import { DashboardPageHeader, DashboardSection } from "@/app/components/DashboardSection";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

type TrafficRow = {
    _id: string;
    count: number;
};

const options = {
    responsive: true,
    plugins: {
        legend: {
            display: false
        }
    },
    scales: {
        y: {
            ticks: {
                callback: (value: string | number) =>
                  Number.isInteger(Number(value)) ? value : null
            }
        }
    }
};

export function Traffic() {
    const [data, setData] = useState<TrafficRow[]>([]);

    useEffect(() => {
        fetch("/api/admin/traffic")
          .then(r => r.json())
          .then((rows: unknown) => setData(Array.isArray(rows) ? rows as TrafficRow[] : []));
    }, []);

    const chartData = {
        labels: data.map((d) => d._id),
        datasets: [
            {
                label: "Visits",
                data: data.map((d) => d.count)
            }
        ]
    };

    return (
      <div className="rounded-3xl cute-border admin-item-container">
          <DashboardPageHeader title="Traffic" description="Amount of traffic on your stats website :3" />

          <div className="mt-6 space-y-6">
              <DashboardSection title="Visits over time">
                  <Line data={chartData} options={options} />
              </DashboardSection>
          </div>
      </div>
    );
}
