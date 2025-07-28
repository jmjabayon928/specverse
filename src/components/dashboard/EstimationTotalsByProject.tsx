// src/components/dashboard/EstimationTotalsByProject.tsx
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

type EstimationTotals = {
  category: string;
  total: number;
};

const EstimationTotalsByProject: React.FC = () => {
  const [data, setData] = useState<EstimationTotals[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/estimation-totals");
        if (!res.ok) throw new Error("Failed to fetch estimation totals");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Estimation totals chart fetch error:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default EstimationTotalsByProject;
