// src/app/(admin)/inventory/maintenance/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { PERMISSIONS } from "@/constants/permissions";

interface MaintenanceLog {
  maintenanceId: number;
  inventoryId: number;
  itemName: string;
  description: string;
  maintenanceDate: string;
  performedByUserId: number | null;
  performedByName: string | null;
}

export default function GlobalMaintenancePage() {
  const { user, loading } = useSession();
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    
    const userRole = user.role?.toLowerCase() ?? '';
    const permissions = user.permissions ?? [];
    const hasPermission = userRole === 'admin' || permissions.includes(PERMISSIONS.INVENTORY_MAINTENANCE_VIEW);
    
    if (!hasPermission) return;

    fetch("/api/backend/inventory/all/maintenance", {
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(async (res) => {
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Error ${res.status}: ${errorText}`);
        }
        return res.json();
      })
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load maintenance logs:", err));
  }, [loading, user]);

  if (loading) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Maintenance Logs</h1>
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Maintenance Logs</h1>
        <p className="text-sm text-gray-500">No access</p>
      </div>
    );
  }

  const userRole = user.role?.toLowerCase() ?? '';
  const permissions = user.permissions ?? [];
  const canViewMaintenance = userRole === 'admin' || permissions.includes(PERMISSIONS.INVENTORY_MAINTENANCE_VIEW);

  if (!canViewMaintenance) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold mb-4">All Maintenance Logs</h1>
        <p className="text-sm text-gray-500">No access</p>
      </div>
    );
  }

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
                <td className="px-4 py-2">{log.performedByName ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
