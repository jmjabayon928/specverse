// src/components/dashboard/PendingVerifications.tsx
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

type PendingVerification = {
  category: string; // e.g., "Templates" or "Filled Sheets"
  total: number;
};

const PendingVerifications: React.FC = () => {
  const [data, setData] = useState<PendingVerification[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/pending-verifications");
        if (!res.ok) throw new Error("Failed to fetch pending verifications");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Pending verifications chart fetch error:", error);
      }
    };
    fetchData();
  }, []);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="category" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar dataKey="total" fill="#f97316" name="Pending" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default PendingVerifications;
