// src/components/dashboard/InventoryStockLevels.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

type InventoryStockData = {
  itemName: string; // what the chart expects on X-axis
  stock: number;    // what the chart expects on Y-axis
};

type RawInventoryStockData = {
  CategoryName: string;
  TotalStock: number;
};

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F",
  "#FFBB28", "#A28DFF", "#FF6699", "#33CC99", "#3399FF"
];

const InventoryStockLevels: React.FC = () => {
  const [data, setData] = useState<InventoryStockData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/inventory-stock", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch inventory stock levels");

        const json: RawInventoryStockData[] = await res.json();

        const mapped: InventoryStockData[] = json.map((item) => ({
          itemName: item.CategoryName,
          stock: item.TotalStock,
        }));

        console.log("Inventory stock levels data:", mapped);
        setData(mapped);
      } catch (error) {
        console.error("Inventory stock levels chart fetch error:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="itemName" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="stock" name="Stock">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default InventoryStockLevels;
