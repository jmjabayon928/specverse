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

interface RawEngineerMetrics {
  Engineer: string;
  OnTimeRate: number;
  VerificationRate: number;
  RejectionRate: number;
}

interface TransformedMetric {
  metric: string;
  [engineer: string]: number | string;
}

export default function TeamPerformanceRadarChart() {
  const [data, setData] = useState<TransformedMetric[]>([]);
  const [engineers, setEngineers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/team-performance");
        if (!res.ok) throw new Error("Failed to fetch team performance data");

        const json: RawEngineerMetrics[] = await res.json();

        const engineerNames = json.map((entry) => entry.Engineer);

        const metrics: TransformedMetric[] = [
          { metric: "On Time Rate" },
          { metric: "Verification Rate" },
          { metric: "Rejection Rate" },
        ];

        json.forEach((engineer) => {
          metrics[0][engineer.Engineer] = engineer.OnTimeRate;
          metrics[1][engineer.Engineer] = engineer.VerificationRate;
          metrics[2][engineer.Engineer] = engineer.RejectionRate;
        });

        setData(metrics);
        setEngineers(engineerNames);
      } catch (error) {
        console.error("Error fetching performance data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-[300px] w-full" />;

  const colors = ["#82ca9d", "#8884d8", "#ffc658", "#ff8042", "#00C49F"];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="metric" />
        <PolarRadiusAxis angle={30} domain={[0, 100]} />
        <Tooltip />

        {engineers.map((engineer, index) => (
          <Radar
            key={engineer}
            name={engineer}
            dataKey={engineer}
            stroke={colors[index % colors.length]}
            fill={colors[index % colors.length]}
            fillOpacity={0.5}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
