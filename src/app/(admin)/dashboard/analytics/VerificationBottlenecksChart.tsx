// src/app/(admin)/dashboard/analytics/VerificationBottlenecksChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface BottleneckData {
  area: string;
  averageVerificationDays: number;
}

interface RawBottleneckData {
  AreaName: string;
  AvgVerificationDays: number;
}

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F",
  "#FFBB28", "#A28DFF", "#FF6699", "#33CC99", "#3399FF"
];

export default function VerificationBottlenecksChart() {
  const [data, setData] = useState<BottleneckData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/verification-bottlenecks");
        if (!res.ok) throw new Error("Failed to fetch bottleneck data");

        const json: RawBottleneckData[] = await res.json();

        const mapped: BottleneckData[] = json.map((item) => ({
          area: item.AreaName,
          averageVerificationDays: Number(item.AvgVerificationDays),
        }));

        console.log("Verification bottlenecks chart data:", mapped);
        setData(mapped);
      } catch (error) {
        console.error("Error fetching bottleneck data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <Skeleton width="100%" height="300px" shape="rectangle" animated />;
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="area" />
        <YAxis
          label={{ value: "Avg Days", angle: -90, position: "insideLeft" }}
          allowDecimals={false}
        />
        <Tooltip formatter={(value) => `${value} days`} />
        <Legend />
        <Bar
          dataKey="averageVerificationDays"
          name="Avg Verification Time (Days)"
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
