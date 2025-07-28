// src/components/dashboard/TemplatesOverTimeChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type TemplateMonthlyCount = {
  month: string; // Example: "2025-07"
  total: number;
};

const TemplatesOverTimeChart: React.FC = () => {
  const [data, setData] = useState<TemplateMonthlyCount[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/templates-over-time");
        if (!res.ok) throw new Error("Failed to fetch templates data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Templates over time chart fetch error:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" stroke="#82ca9d" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default TemplatesOverTimeChart;
