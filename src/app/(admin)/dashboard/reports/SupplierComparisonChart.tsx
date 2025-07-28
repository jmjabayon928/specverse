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
  Cell,
} from "recharts";

type SupplierComparison = {
  supplierName: string;
  totalQuoted: number;
  itemCount: number;
  acceptedCount: number;
};

export default function SupplierComparisonChart() {
  const [data, setData] = useState<SupplierComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/reports/supplier-comparison");
        if (!res.ok) throw new Error("Failed to load supplier data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Error fetching supplier comparison:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const processedData = data.map((s) => ({
    ...s,
    acceptanceRate:
      s.itemCount > 0 ? (s.acceptedCount / s.itemCount) * 100 : 0,
  }));

  const getBarColor = (rate: number) => {
    if (rate >= 75) return "#34d399"; // green
    if (rate >= 50) return "#facc15"; // yellow
    return "#f87171"; // red
  };

  return (
    <div className="w-full h-80">
      <h3 className="text-md font-semibold mb-2">Supplier Comparison</h3>
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading supplier data...</p>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={processedData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
          >
            <XAxis type="number" />
            <YAxis dataKey="supplierName" type="category" width={150} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "totalQuoted") return [`$${value.toFixed(2)}`, "Total Quoted"];
                if (name === "itemCount") return [value, "Items Quoted"];
                if (name === "acceptedCount") return [value, "Quotes Accepted"];
                if (name === "acceptanceRate")
                  return [`${value.toFixed(1)}%`, "Acceptance Rate"];
                return [value, name];
              }}
            />
            <Bar dataKey="totalQuoted" fill="#8884d8">
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.acceptanceRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
