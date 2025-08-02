// src/app/(admin)/dashboard/reports/InventoryContributionChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface ItemDetail {
  itemName: string;
  quantity: number;
}

interface CategoryContribution {
  categoryName: string;
  items: ItemDetail[];
}

interface StackedDataEntry {
  categoryName: string;
  [itemName: string]: string | number;
}

const generateColors = (count: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // golden angle approximation
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

export default function InventoryContributionChart() {
  const [data, setData] = useState<StackedDataEntry[]>([]);
  const [itemNames, setItemNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/reports/inventory-contribution");
        const raw: CategoryContribution[] = await res.json();

        const itemsSet = new Set<string>();
        const transformed: StackedDataEntry[] = raw.map((category) => {
          const entry: StackedDataEntry = {
            categoryName: category.categoryName,
          };
          category.items.forEach((item) => {
            entry[item.itemName] = item.quantity;
            itemsSet.add(item.itemName);
          });
          return entry;
        });

        setData(transformed);
        setItemNames(Array.from(itemsSet));
      } catch (error) {
        console.error("Error loading inventory contribution:", error);
      }
    };

    fetchData();
  }, []);

  const colors = generateColors(itemNames.length);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Inventory Category Contribution</h2>
        <ResponsiveContainer width="100%" height={700}>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 120 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="categoryName"
              angle={-45}
              textAnchor="end"
              interval={0}
              height={100}
            />
            <YAxis />
            <Tooltip />
            <Legend />
            {itemNames.map((name, index) => (
              <Bar
                key={name}
                dataKey={name}
                stackId="a"
                fill={colors[index % colors.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
