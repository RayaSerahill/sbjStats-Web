"use client";

import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

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

const options = {
    responsive: true,
    plugins: {
        legend: {
            display: false
        }
    }
};

export function Traffic() {
    const [data, setData] = useState([]);

    useEffect(() => {
        fetch("/api/admin/traffic")
          .then(r => r.json())
          .then(setData);
    }, []);

    const chartData = {
        labels: data.map((d:any) => d._id),
        datasets: [
            {
                label: "Visits",
                data: data.map((d:any) => d.count)
            }
        ]
    };

    return (
      <div className="rounded-3xl cute-border admin-item-container">
          <p className={"mt-1 text-sm text-zinc-600"}>
              Amount of traffic on your stats website :3
          </p>
          <br />
          <h3 className={"text-sm font-semibold text-zinc-900"}>
              Traffic
          </h3>
          <Line data={chartData} options={options} />
      </div>
    );
}