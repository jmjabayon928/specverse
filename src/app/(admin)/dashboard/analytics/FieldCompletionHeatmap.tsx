"use client";

import React, { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface CompletionData {
  fieldLabel: string;
  month: string;
  completionRate: number; // Percentage 0 to 100
}

export default function FieldCompletionHeatmap() {
  const [data, setData] = useState<CompletionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/backend/stats/field-completion");
        if (!res.ok) throw new Error("Failed to fetch field completion data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error fetching field completion trends:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <Skeleton className="h-[400px] w-full" />;

  // Ensure months and fields are unique and valid (non-empty)
  const months = [...new Set(data.map((d) => d.month).filter(Boolean))];
  const fields = [...new Set(data.map((d) => d.fieldLabel).filter(Boolean))];

  return (
    <div className="overflow-x-auto">
      <table className="table-fixed border-collapse w-full text-xs text-center">
        <thead>
          <tr>
            <th className="border p-2">Field</th>
            {months.map((month) => (
              <th key={`month-${month}`} className="border p-2">
                {month}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={`row-${field}`}>
              <td className="border p-2 font-medium text-left">{field}</td>
              {months.map((month) => {
                const cell = data.find(
                  (d) => d.fieldLabel === field && d.month === month
                );
                const rate = cell?.completionRate ?? 0;
                return (
                  <td
                    key={`${field}-${month}`}
                    className={`border p-2 ${
                      rate >= 80
                        ? "bg-green-500"
                        : rate >= 60
                        ? "bg-green-400"
                        : rate >= 40
                        ? "bg-green-300"
                        : rate >= 20
                        ? "bg-green-200"
                        : "bg-green-100"
                    } text-white`}
                  >
                    {rate}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
