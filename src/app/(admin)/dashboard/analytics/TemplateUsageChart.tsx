// src/app/(admin)/dashboard/analytics/TemplateUsageChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface TemplateUsage {
  templateName: string;
  month: string;
  filledCount: number;
}

export default function TemplateUsageChart() {
  const [data, setData] = useState<TemplateUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/template-usage");
        if (!res.ok) throw new Error("Failed to fetch template usage data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching template usage data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-[300px] w-full rounded-xl" />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" />
        <YAxis />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip />
        <Legend />
        <Area
          type="monotone"
          dataKey="filledCount"
          stroke="#82ca9d"
          fillOpacity={1}
          fill="url(#colorCount)"
          name="Filled Datasheets"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
