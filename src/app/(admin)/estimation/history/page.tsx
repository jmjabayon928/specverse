"use client";
import { useEffect, useState } from "react";

interface PastEstimation {
  EstimationID: number;
  Title: string;
  Status: string;
  CreatedAt: string;
  CreatedBy: number | null;
  PreparedBy: string | null;
  ItemCount: number;
  TotalCost: number;
  LastModified: string | null;
}

export default function EstimationHistoryPage() {
  const [estimates, setEstimates] = useState<PastEstimation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/backend/estimation/history", {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || "Failed to fetch");
        }
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setEstimates(data);
        } else {
          console.error("Unexpected response:", data);
          setError("Invalid response format");
        }
      })
      .catch((err) => {
        console.error("Failed to load past estimations", err);
        setError(err.message);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Browse Past Estimates</h1>

      {error && (
        <div className="text-red-600 mb-4">
          ⚠️ Error: {error}
        </div>
      )}

      <table className="min-w-full table-auto border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-4 py-2">Estimation ID</th>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Prepared By</th>
            <th className="px-4 py-2">Created At</th>
            <th className="px-4 py-2">Items</th>
            <th className="px-4 py-2">Total Cost</th>
            <th className="px-4 py-2">Last Modified</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((e) => (
            <tr key={e.EstimationID} className="border-t">
              <td className="px-4 py-2">{e.EstimationID}</td>
              <td className="px-4 py-2">{e.Title}</td>
              <td className="px-4 py-2">{e.PreparedBy ?? "—"}</td>
              <td className="px-4 py-2">{new Date(e.CreatedAt).toLocaleDateString()}</td>
              <td className="px-4 py-2">{e.ItemCount}</td>
              <td className="px-4 py-2">${e.TotalCost?.toFixed(2) ?? "0.00"}</td>
              <td className="px-4 py-2">{e.LastModified ? new Date(e.LastModified).toLocaleDateString() : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
