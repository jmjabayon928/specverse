"use client";

import React, { useEffect, useState } from "react";

interface EstimateComparison {
  itemName: string;
  quantity: number;
  estimatedUnitCost: number;
  quotedUnitCost: number;
  costDifference: number;
  variancePercent: number;
}

interface Props {
  estimationId: number;
}

export default function EstimateVsActualTable({ estimationId }: Props) {
  const [data, setData] = useState<EstimateComparison[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchComparison() {
      try {
        const res = await fetch(`/api/backend/reports/estimate-vs-actual?estimationId=${estimationId}`);
        if (!res.ok) throw new Error("Failed to fetch comparison data");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Error loading estimate vs actual data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchComparison();
  }, [estimationId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading comparison data...</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left border">
        <thead>
          <tr className="bg-gray-100 text-xs uppercase border-b">
            <th className="p-2">Item</th>
            <th className="p-2 text-right">Quantity</th>
            <th className="p-2 text-right">Estimated Unit Cost</th>
            <th className="p-2 text-right">Quoted Unit Cost</th>
            <th className="p-2 text-right">Difference</th>
            <th className="p-2 text-right">Variance %</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, idx) => (
            <tr
              key={idx}
              className={`border-b ${
                item.variancePercent > 0 ? "bg-red-50" : item.variancePercent < 0 ? "bg-green-50" : ""
              }`}
            >
              <td className="p-2">{item.itemName}</td>
              <td className="p-2 text-right">{item.quantity}</td>
              <td className="p-2 text-right">${item.estimatedUnitCost.toFixed(2)}</td>
              <td className="p-2 text-right">${item.quotedUnitCost.toFixed(2)}</td>
              <td className="p-2 text-right">
                ${item.costDifference.toFixed(2)}
              </td>
              <td
                className={`p-2 text-right font-semibold ${
                  item.variancePercent > 0 ? "text-red-600" : item.variancePercent < 0 ? "text-green-600" : ""
                }`}
              >
                {item.variancePercent.toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
