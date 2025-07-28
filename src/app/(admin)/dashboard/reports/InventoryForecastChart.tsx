// src/app/(admin)/dashboard/reports/InventoryForecastChart.tsx

"use client";

import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface ForecastEntry {
  month: string;
  itemName: string;
  totalQuantity: number;
}

interface ForecastChartData {
  month: string;
  [itemName: string]: string | number;
}

export default function InventoryForecastChart() {
  const [data, setData] = useState<ForecastChartData[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const res = await fetch("/api/backend/reports/inventory-forecast");
        if (!res.ok) throw new Error("Failed to fetch inventory forecast");
        const raw: ForecastEntry[] = await res.json();

        // Group entries by month and item
        const grouped: Record<string, Record<string, number>> = {};

        raw.forEach((entry) => {
          if (!grouped[entry.month]) grouped[entry.month] = {};
          grouped[entry.month][entry.itemName] = entry.totalQuantity;
        });

        // Convert to recharts-compatible format
        const chartData: ForecastChartData[] = Object.entries(grouped).map(
          ([month, items]) => ({
            month,
            ...items,
          })
        );

        setData(chartData);
        setError(null);
      } catch (error) {
        console.error("Error loading inventory forecast:", error);
        setError("Failed to load inventory forecast data.");
      }
    };

    fetchForecast();
  }, []);

  const itemKeys = Array.from(
    new Set(data.flatMap((d) => Object.keys(d).filter((k) => k !== "month")))
  );

  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff7300",
    "#d0ed57",
    "#a4de6c",
    "#d88884",
    "#84d8d8",
    "#d8b784",
  ];

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Inventory Usage Forecast</h2>

        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            {itemKeys.map((key, index) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stackId="1"
                stroke={colors[index % colors.length]}
                fill={colors[index % colors.length]}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
