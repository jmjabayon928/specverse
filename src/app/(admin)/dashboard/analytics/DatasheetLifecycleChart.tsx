// src/app/(admin)/dashboard/analytics/DatasheetLifecycleChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface DatasheetDuration {
  sheetType: string;
  averageDays: number;
}

interface RawDatasheetDuration {
  SheetType: string;
  AverageDays: number;
}

export default function DatasheetLifecycleChart() {
  const [data, setData] = useState<DatasheetDuration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/datasheet-lifecycle");
        if (!res.ok) throw new Error("Failed to fetch lifecycle data");

        const json: RawDatasheetDuration[] = await res.json();

        const mapped: DatasheetDuration[] = json.map((item) => ({
          sheetType: item.SheetType,
          averageDays: Number(item.AverageDays),
        }));

        console.log("Datasheet lifecycle chart data:", mapped);
        setData(mapped);
      } catch (error) {
        console.error("Error fetching lifecycle data:", error);
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
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="sheetType" />
        <YAxis
          label={{ value: "Avg Days", angle: -90, position: "insideLeft" }}
          allowDecimals={false}
        />
        <Tooltip formatter={(value) => `${value} days`} />
        <Legend />
        <Line
          type="monotone"
          dataKey="averageDays"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
          name="Avg Duration (Days)"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
