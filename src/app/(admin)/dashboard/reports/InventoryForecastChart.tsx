// src/app/(admin)/dashboard/reports/InventoryForecastChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface InventoryForecastEntry {
  month: string;
  itemName: string;
  totalQuantity: number;
}

interface GroupedData {
  [month: string]: {
    [itemName: string]: number;
  };
}

interface ChartDataEntry {
  month: string;
  [itemName: string]: number | string;
}

const generateColors = (count: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Use golden angle approximation
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

export default function InventoryForecastChart() {
  const [data, setData] = useState<ChartDataEntry[]>([]);
  const [itemNames, setItemNames] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/backend/reports/inventory-forecast")
      .then((res) => res.json())
      .then((result: InventoryForecastEntry[]) => {
        const grouped: GroupedData = {};
        const uniqueItemNames = new Set<string>();

        result.forEach((entry) => {
          if (!grouped[entry.month]) grouped[entry.month] = {};
          grouped[entry.month][entry.itemName] = entry.totalQuantity ?? 0;
          uniqueItemNames.add(entry.itemName);
        });

        const chartData: ChartDataEntry[] = Object.entries(grouped).map(
          ([month, items]) => ({
            month,
            ...items,
          })
        );

        setData(chartData);
        setItemNames(Array.from(uniqueItemNames));
      })
      .catch((err) => {
        console.error("Failed to fetch inventory forecast data:", err);
        setData([]);
        setItemNames([]);
      });
  }, []);

  const colors = generateColors(itemNames.length);

  return (
    <Card className="shadow-md">
      <CardContent>
        <h2 className="text-xl font-semibold mb-4">Inventory Forecast</h2>
        <div className="overflow-x-auto">
          <ResponsiveContainer width={itemNames.length > 12 ? itemNames.length * 60 : "100%"} height={600}>
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              {itemNames.map((name, index) => (
                <Bar key={name} dataKey={name} fill={colors[index % colors.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
