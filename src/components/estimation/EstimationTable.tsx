'use client';

import React from "react";
import Link from "next/link";
import { EyeIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Estimation } from "@/types/estimation";

interface Props {
  estimations: Estimation[];
  onDelete?: (id: number) => void; // callback for parent to refresh
}

export default function EstimationTable({ estimations, onDelete }: Props) {
  const handleDelete = async (id: number) => {
    const confirmed = confirm("Are you sure you want to delete this estimation?");
    if (!confirmed) return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/backend/estimation/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete estimation.");

      alert("Estimation deleted successfully.");
      if (onDelete) onDelete(id); // Notify parent to refresh or remove
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Error deleting estimation.");
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white shadow-md">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">ID</th>
            <th className="px-4 py-2 text-left">Title</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-left">Date</th>
            <th className="px-4 py-2 text-left">Total Cost</th>
            <th className="px-4 py-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {estimations.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                No estimations found.
              </td>
            </tr>
          ) : (
            estimations.map((est) => (
              <tr key={est.EstimationID} className="border-b">
                <td className="px-4 py-2">{est.EstimationID}</td>
                <td className="px-4 py-2">{est.Title}</td>
                <td className="px-4 py-2">{est.Status}</td>
                <td className="px-4 py-2">{new Date(est.EstimationDate).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  {est.TotalMaterialCost ? `$${est.TotalMaterialCost.toFixed(2)}` : "-"}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3 text-gray-500">
                    <button
                      onClick={() => window.location.href = `/estimation/${est.EstimationID}`}
                      title="View"
                    >
                      <EyeIcon className="h-5 w-5 hover:text-blue-600" />
                    </button>
                    <Link
                      href={`/estimation/${est.EstimationID}?edit=true`}
                      title="Edit"
                    >
                      <PencilIcon className="h-5 w-5 hover:text-amber-500" />
                    </Link>
                    <button onClick={() => handleDelete(est.EstimationID)} title="Delete">
                      <TrashIcon className="h-5 w-5 hover:text-red-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
