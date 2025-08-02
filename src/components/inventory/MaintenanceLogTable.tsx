// src/components/inventory/MaintenanceLogTable.tsx
"use client";

import React, { useEffect, useState } from "react";

interface MaintenanceLog {
  id: number;
  description: string;
  date: string;
  performedBy: string;
}

interface Props {
  inventoryId: number;
  canEdit: boolean;
}

export default function MaintenanceLogTable({ inventoryId, canEdit }: Props) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/backend/inventory/${inventoryId}/maintenance`);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Fetch failed: ${errorText}`);
        }
        const data = await res.json();
        setLogs(data);
      } catch (error) {
        console.error("Failed to fetch maintenance logs:", error);
      }
    }

    fetchLogs();
  }, [inventoryId]);

  return (
    <div className="mt-4 border rounded-md">
      <div className="bg-gray-100 px-4 py-2 font-semibold">Maintenance Logs</div>
      <table className="w-full border-t text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-2 border">Description</th>
            <th className="px-4 py-2 border">Date</th>
            <th className="px-4 py-2 border">Performed By</th>
            {canEdit && <th className="px-4 py-2 border">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="border px-4 py-2">{log.description}</td>
              <td className="border px-4 py-2">{new Date(log.date).toLocaleDateString()}</td>
              <td className="border px-4 py-2">{log.performedBy}</td>
              {canEdit && (
                <td className="border px-4 py-2 text-blue-500 hover:underline cursor-pointer">
                  Edit
                </td>
              )}
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={canEdit ? 4 : 3} className="border px-4 py-2 text-center text-gray-500">
                No maintenance logs found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
