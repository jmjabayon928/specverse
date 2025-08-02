// src/components/inventory/AuditLogTable.tsx
"use client";

import React, { useEffect, useState } from "react";

interface AuditLog {
  auditLogId: number;
  inventoryId: number;
  actionType: string;
  oldValue: string;
  newValue: string;
  changedByName: string;
  changedAt: string;
}

interface Props {
  inventoryId: number;
}

export default function AuditLogTable({ inventoryId }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/backend/inventory/${inventoryId}/audit`
        );

        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          let errorMessage = `Error ${res.status}`;

          // If response is JSON, try to extract error message
          if (contentType && contentType.includes("application/json")) {
            const errorJson = await res.json();
            errorMessage += `: ${errorJson.message || JSON.stringify(errorJson)}`;
          } else {
            const text = await res.text();
            errorMessage += `: ${text}`;
          }

          throw new Error(errorMessage);
        }

        const data = await res.json();
        setLogs(data);
      } catch (err) {
        console.error("Audit fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLogs();
  }, [inventoryId]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Change History</h2>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="overflow-x-auto border rounded-md bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
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
                  <td className="px-4 py-2">{log.actionType}</td>
                  <td className="px-4 py-2">{log.oldValue}</td>
                  <td className="px-4 py-2">{log.newValue}</td>
                  <td className="px-4 py-2">{log.changedByName}</td>
                  <td className="px-4 py-2 text-right">
                    {new Date(log.changedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-4 text-center text-gray-500">
                    No audit logs found.
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
