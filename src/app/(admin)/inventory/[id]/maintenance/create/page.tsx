"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PageProps {
  params: { id: string };
}

export default function AddMaintenanceLogPage({ params }: PageProps) {
  const router = useRouter();

  // ✅ safely parse inventoryId from URL
  const inventoryId = Number(params.id ?? "0");

  // ✅ enterprise safe pattern: no conditional return
  const [showRedirecting, setShowRedirecting] = useState(false);

  useEffect(() => {
    if (!inventoryId || isNaN(inventoryId)) {
      setShowRedirecting(true);
      router.replace("/inventory");
    }
  }, [inventoryId, router]);

  // ✅ all hooks declared first (no violations)
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!maintenanceDate || !description) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/maintenance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inventoryId,
            maintenanceDate,
            description,
            notes,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to add maintenance log");

      router.push(`/inventory/${inventoryId}?tab=maintenance`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto p-4 bg-white border rounded-md shadow">
      {showRedirecting ? (
        <div className="p-4 text-center text-sm text-gray-500">Redirecting...</div>
      ) : (
        <>
          <h1 className="text-xl font-semibold mb-4">Add Maintenance Log</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <input
                type="date"
                value={maintenanceDate}
                onChange={(e) => setMaintenanceDate(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Select maintenance date"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Describe the maintenance performed"
                rows={3}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Additional notes or comments"
                rows={2}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded text-white ${
                isSubmitting ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
              } transition`}
            >
              {isSubmitting ? "Saving..." : "Save Log"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
