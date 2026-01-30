// src/app/(admin)/inventory/logs/page.tsx
"use client";

import { useEffect, useState } from "react";

interface AuditLog {
  auditLogId: number;
  inventoryId: number;
  itemName: string;
  actionType: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
}

export default function GlobalAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    fetch("/api/backend/inventory/all/audit", {
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
      .catch((err) => console.error("Failed to load audit logs:", err));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">All Audit Logs</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Field</th>
              <th className="px-4 py-3">Old Value</th>
              <th className="px-4 py-3">New Value</th>
              <th className="px-4 py-3">Changed By</th>
              <th className="px-4 py-3 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.auditLogId}>
                <td className="px-4 py-2">{log.itemName}</td>
                <td className="px-4 py-2">{log.actionType}</td>
                <td className="px-4 py-2">{log.oldValue}</td>
                <td className="px-4 py-2">{log.newValue}</td>
                <td className="px-4 py-2">{log.changedBy}</td>
                <td className="px-4 py-2 text-right">
                  {new Date(log.changedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
