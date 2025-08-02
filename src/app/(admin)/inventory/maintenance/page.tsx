// src/app/(admin)/inventory/maintenance/page.tsx
"use client";

import { useEffect, useState } from "react";

interface MaintenanceLog {
  maintenanceId: number;
  inventoryId: number;
  itemName: string;
  description: string;
  maintenanceDate: string;
  performedBy: string;
}

export default function GlobalMaintenancePage() {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);

  useEffect(() => {
    fetch("/api/backend/inventory/all/maintenance")
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error("Failed to load maintenance logs:", err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">All Maintenance Logs</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Performed By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.maintenanceId}>
                <td className="px-4 py-2">{log.itemName}</td>
                <td className="px-4 py-2">{log.description}</td>
                <td className="px-4 py-2">
                  {new Date(log.maintenanceDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-2">{log.performedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
