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
} from "recharts";

type InventoryStockData = {
  itemName: string;
  stock: number;
};

const InventoryStockLevels: React.FC = () => {
  const [data, setData] = useState<InventoryStockData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/inventory-stock");
        if (!res.ok) throw new Error("Failed to fetch inventory stock levels");
        const json = await res.json();
        setData(json);
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
        <Bar dataKey="stock" fill="#82ca9d" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default InventoryStockLevels;
