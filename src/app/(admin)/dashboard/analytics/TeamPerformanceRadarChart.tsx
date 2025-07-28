// src/app/(admin)/dashboard/analytics/TeamPerformanceRadarChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface TeamMetric {
  metric: string;
  Engineer: number;
  Supervisor: number;
  Admin: number;
}

export default function TeamPerformanceRadarChart() {
  const [data, setData] = useState<TeamMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/team-performance");
        if (!res.ok) throw new Error("Failed to fetch team performance data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching performance data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        <Tooltip />
        <Radar
          name="Engineer"
          dataKey="Engineer"
          stroke="#82ca9d"
          fill="#82ca9d"
          fillOpacity={0.5}
        />
        <Radar
          name="Supervisor"
          dataKey="Supervisor"
          stroke="#8884d8"
          fill="#8884d8"
          fillOpacity={0.5}
        />
        <Radar
          name="Admin"
          dataKey="Admin"
          stroke="#ffc658"
          fill="#ffc658"
          fillOpacity={0.5}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
