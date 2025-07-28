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
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface BottleneckData {
  area: string;
  averageVerificationDays: number;
}

export default function VerificationBottlenecksChart() {
  const [data, setData] = useState<BottleneckData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/verification-bottlenecks");
        if (!res.ok) throw new Error("Failed to fetch bottleneck data");
        const json = await res.json();
        setData(json);
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
        <YAxis label={{ value: "Avg Days", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="averageVerificationDays" fill="#82ca9d" name="Avg Verification Time (Days)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
