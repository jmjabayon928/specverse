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
  Cell,
} from "recharts";

// Incoming data format from backend
type RawPendingVerification = {
  Type: string;  // e.g., "Template" or "Filled Sheet"
  Total: number;
};

// Transformed data format for chart
type PendingVerification = {
  category: string; // e.g., "Template" or "Filled Sheet"
  total: number;
};

const COLORS = ["#f97316", "#3b82f6", "#10b981", "#eab308", "#ef4444"];

const PendingVerifications: React.FC = () => {
  const [data, setData] = useState<PendingVerification[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/stats/pending-verifications", {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch pending verifications");

        const json: RawPendingVerification[] = await res.json();

        const mapped: PendingVerification[] = json.map((item) => ({
          category: item.Type,
          total: item.Total,
        }));

        console.log("Pending verification chart data:", mapped);
        setData(mapped);
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
        <Bar dataKey="total" name="Pending">
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default PendingVerifications;
