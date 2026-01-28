// src/app/(admin)/dashboard/reports/RejectedTemplatesChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface RejectionTrendEntry {
  month: string;
  rejectedCount: number;
}

export default function RejectedTemplatesChart() {
  const [data, setData] = useState<RejectionTrendEntry[]>([]);

  useEffect(() => {
    const fetchRejectionData = async () => {
      try {
        const res = await fetch("/api/backend/reports/rejected-templates", {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const json: RejectionTrendEntry[] = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching rejected templates data:", error);
      }
    };

    fetchRejectionData();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">
          Rejected Templates Over Time
        </h2>
        <ResponsiveContainer width="100%" height={500}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="month"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={60}
            />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="rejectedCount"
              fill="#f87171"
              name="Rejected Templates"
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
