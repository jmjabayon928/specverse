"use client";

import React, { useEffect, useState } from "react";

type ChangeLog = {
  LogID: number;
  PerformedByName: string;
  Action: string;
  DatePerformed: string;
};

type Props = {
  sheetId: number;
};

const ChangeLogTable: React.FC<Props> = ({ sheetId }) => {
  const [logs, setLogs] = useState<ChangeLog[]>([]);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch(`/api/backend/changelog/sheet/${sheetId}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data);
        }
      } catch (error) {
        console.error("Failed to load changelog:", error);
      }
    }

    fetchLogs();
  }, [sheetId]);

  if (!logs.length) return <p className="text-sm text-gray-500">No change logs available.</p>;

  return (
    <table className="w-full text-sm border">
      <thead>
        <tr className="bg-gray-100 text-left">
          <th className="px-4 py-2">Date</th>
          <th className="px-4 py-2">Action</th>
          <th className="px-4 py-2">Performed By</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.LogID} className="border-t">
            <td className="px-4 py-2">{new Date(log.DatePerformed).toLocaleString()}</td>
            <td className="px-4 py-2">{log.Action}</td>
            <td className="px-4 py-2">{log.PerformedByName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ChangeLogTable;
