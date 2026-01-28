// src/app/(admin)/dashboard/reports/EstimationCostChart.tsx
"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";

// Define the data structure
interface EstimationCostEntry {
  estimationId: number;
  projectName: string;
  vendor: number;
  labor: number;
}

interface RawEstimationCostEntry {
  EstimationID: number;
  projectName: string;
  vendor: number;
  labor: number;
}

export default function EstimationCostChart() {
  const [data, setData] = useState<EstimationCostEntry[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/backend/reports/estimation-cost", {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Error: ${res.status}`);
        const result: RawEstimationCostEntry[] = await res.json();

        if (Array.isArray(result)) {
          const transformed: EstimationCostEntry[] = result.map((entry) => ({
            estimationId: entry.EstimationID,
            projectName: entry.projectName,
            vendor: entry.vendor || 0,
            labor: entry.labor || 0,
          }));
          setData(transformed);
        } else {
          console.error("Expected an array from API but got:", result);
          setData([]);
        }
      } catch (error) {
        console.error("Failed to fetch estimation cost data:", error);
        setData([]);
      }
    };

    fetchData();
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart layout="vertical" data={data}>
            <XAxis type="number" />
            <YAxis dataKey="projectName" type="category" />
            <Tooltip />
            <Legend />
            <Bar dataKey="vendor" name="Vendor Cost" fill="#8884d8" />
            <Bar dataKey="labor" name="Labor Cost" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
