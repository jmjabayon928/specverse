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
  totalQuantity: number;
  items: ItemDetail[];
}

export default function InventoryContributionChart() {
  const [data, setData] = useState<CategoryContribution[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/reports/inventory-contribution");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error loading inventory contribution:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <h2 className="text-lg font-semibold mb-4">Inventory Category Contribution</h2>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="categoryName" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalQuantity" fill="#82ca9d" name="Total Quantity" />
          </BarChart>
        </ResponsiveContainer>
        {/* Optionally: map data to modals or expandable list per category here */}
      </CardContent>
    </Card>
  );
}
