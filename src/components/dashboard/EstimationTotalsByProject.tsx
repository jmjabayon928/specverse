// src/components/dashboard/EstimationTotalsByProject.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";

type EstimationTotals = {
  category: string;
  total: number;
};

type RawEstimationTotals = {
  project: string;
  total: number;
};

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F",
  "#FFBB28", "#A28DFF", "#FF6699", "#33CC99", "#3399FF"
];

const EstimationTotalsByProject: React.FC = () => {
  const [data, setData] = useState<EstimationTotals[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/estimation-totals", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch estimation totals");

        const json: RawEstimationTotals[] = await res.json();

        const mapped: EstimationTotals[] = json.map((item) => ({
          category: item.project,
          total: Number(item.total),
        }));

        console.log("Estimation totals by project:", mapped);
        setData(mapped);
      } catch (error) {
        console.error("Estimation totals chart fetch error:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis
          tickFormatter={(value) => `${value / 1_000_000}M`}
          domain={[0, "auto"]}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value) => `$${Number(value).toLocaleString()}`}
        />
        <Legend />
        <Bar dataKey="total" name="Total Cost">
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default EstimationTotalsByProject;
