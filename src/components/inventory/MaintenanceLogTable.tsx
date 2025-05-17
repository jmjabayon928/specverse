"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { checkUserPermission } from "@/utils/permissionUtils";

interface MaintenanceLog {
  maintenanceId: number;
  inventoryId: number;
  maintenanceDate: string;
  description: string;
  notes?: string;
  performedBy: string;
  CreatedAt?: string;
}

interface Props {
  inventoryId: number;
}

export default function MaintenanceLogTable({ inventoryId }: Props) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const canAdd = checkUserPermission("INVENTORY_MAINTENANCE_CREATE");

  useEffect(() => {
    async function fetchLogs() {
      try {
        console.log("Fetching maintenance logs from:", `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/maintenance`);
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/maintenance`
        );
        if (!res.ok) throw new Error("Failed to load maintenance logs");
        const data = await res.json();
        console.log("Maintenance logs fetched:", data);
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [inventoryId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Maintenance Logs</h2>
        {canAdd && (
          <button
            onClick={() => router.push(`/inventory/${inventoryId}/maintenance/create`)}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-blue-700"
          >
            + Add Maintenance Log
          </button>
        )}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">System User</th>
                <th className="px-4 py-3 text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log, index) => (
                <tr key={log.maintenanceId ?? `log-${index}`}>
                  <td className="px-4 py-2 font-medium">
                    {log.maintenanceDate ? new Date(log.maintenanceDate).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-2">{log.description}</td>
                  <td className="px-4 py-2">{log.notes ?? "-"}</td>
                  <td className="px-4 py-2 text-right">{log.performedBy}</td>
                  <td className="px-4 py-2 text-right">
                    {log.CreatedAt ? new Date(log.CreatedAt).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No maintenance logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
