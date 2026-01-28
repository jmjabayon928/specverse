// src/components/dashboard/DatasheetsByStatus.tsx
"use client";

import React, { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#00C49F", "#FFBB28"];

type StatusData = {
  status: string;
  total: number;
};

const DatasheetsByStatus: React.FC = () => {
  const [data, setData] = useState<StatusData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/datasheets-by-status", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch datasheets by status");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Datasheets by status fetch error:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="total"
          nameKey="status"
          cx="50%"
          cy="50%"
          outerRadius={100}
          label
        >
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default DatasheetsByStatus;
