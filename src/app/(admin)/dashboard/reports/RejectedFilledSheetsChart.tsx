// src/app/(admin)/dashboard/reports/RejectedFilledSheetsChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface RejectedEntry {
  month: string;
  rejectedCount: number;
}

export default function RejectedFilledSheetsChart() {
  const [data, setData] = useState<RejectedEntry[]>([]);

  useEffect(() => {
    const fetchRejectedFilledSheets = async () => {
      try {
        const res = await fetch("/api/backend/reports/rejected-filledsheets");
        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }
        const json: RejectedEntry[] = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch rejected filled sheets:", error);
      }
    };

    fetchRejectedFilledSheets();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">
          Rejected Filled Datasheets Over Time
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
              name="Rejected Filled Sheets"
              fill="#f87171"
              barSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
