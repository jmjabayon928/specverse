// src/app/(admin)/dashboard/reports/SupplierComparisonChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
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

interface GroupedBarDataEntry {
  itemName: string;
  [categoryName: string]: string | number;
}

const generateColors = (count: number): string[] => {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360;
    colors.push(`hsl(${hue}, 70%, 60%)`);
  }
  return colors;
};

export default function InventoryContributionChart() {
  const [data, setData] = useState<GroupedBarDataEntry[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/reports/inventory-contribution");
        const raw: CategoryContribution[] = await res.json();

        const categories = raw.map((c) => c.categoryName);
        const itemMap: Record<string, GroupedBarDataEntry> = {};

        raw.forEach((category) => {
          category.items.forEach((item) => {
            if (!itemMap[item.itemName]) {
              itemMap[item.itemName] = { itemName: item.itemName };
            }
            itemMap[item.itemName][category.categoryName] = item.quantity;
          });
        });

        setData(Object.values(itemMap));
        setCategoryNames(categories);
      } catch (error) {
        console.error("Error loading inventory contribution:", error);
      }
    };

    fetchData();
  }, []);

  const colors = generateColors(categoryNames.length);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Inventory Category Contribution</h2>
        <div className="w-full overflow-x-auto">
          <div className="min-w-[1200px] h-[600px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="itemName" angle={-45} textAnchor="end" interval={0} height={120} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                {categoryNames.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    name={category}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}