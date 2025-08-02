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

// Raw data from backend
interface RawTemplateUsage {
  TemplateName: string;
  Month: string;
  UsageCount: number;
}

// Grouped data format for chart
type ChartRow = {
  month: string;
  [templateName: string]: string | number;
};

const COLORS = [
  "#82ca9d", "#8884d8", "#ffc658", "#ff8042", "#00C49F",
  "#FFBB28", "#A28DFF", "#FF6699", "#33CC99", "#3399FF"
];

export default function TemplateUsageChart() {
  const [data, setData] = useState<ChartRow[]>([]);
  const [templateNames, setTemplateNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/template-usage");
        if (!res.ok) throw new Error("Failed to fetch template usage data");

        const json: RawTemplateUsage[] = await res.json();

        // Group by month and template
        const grouped: { [month: string]: ChartRow } = {};
        const templateSet = new Set<string>();

        json.forEach(({ Month, TemplateName, UsageCount }) => {
          templateSet.add(TemplateName);
          if (!grouped[Month]) grouped[Month] = { month: Month };
          grouped[Month][TemplateName] = UsageCount;
        });

        const sorted = Object.values(grouped).sort((a, b) =>
          String(a.month).localeCompare(String(b.month))
        );

        setData(sorted);
        setTemplateNames(Array.from(templateSet));
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
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />

        {templateNames.map((name, index) => (
          <Area
            key={name}
            type="monotone"
            dataKey={name}
            name={name}
            stroke={COLORS[index % COLORS.length]}
            fill={COLORS[index % COLORS.length]}
            fillOpacity={0.3}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
