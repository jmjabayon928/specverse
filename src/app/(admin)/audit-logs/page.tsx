// src/app/(admin)/audit-logs/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import SecurePage from "@/components/security/SecurePage";

type AuditLogDTO = {
  auditLogId: number;
  entityType: string | null;
  entityId: number | null;
  action: string;
  performedBy: number | null;
  performedByName: string | null;
  performedAt: string;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  changes: unknown;
  changesRaw: string | null;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // Filters
  const [actorUserId, setActorUserId] = useState<string>("");
  const [action, setAction] = useState<string>("");
  const [entityType, setEntityType] = useState<string>("");
  const [entityId, setEntityId] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Detail drawer
  const [selectedLog, setSelectedLog] = useState<AuditLogDTO | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // Keep latest filters without forcing the effect to depend on them
  const filtersRef = useRef({
    actorUserId,
    action,
    entityType,
    entityId,
    dateFrom,
    dateTo,
  });
  useEffect(() => {
    filtersRef.current = {
      actorUserId,
      action,
      entityType,
      entityId,
      dateFrom,
      dateTo,
    };
  }, [actorUserId, action, entityType, entityId, dateFrom, dateTo]);

  // Stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, filters: typeof filtersRef.current) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });

        if (filters.actorUserId.trim()) {
          params.append("actorUserId", filters.actorUserId.trim());
        }
        if (filters.action.trim()) {
          params.append("action", filters.action.trim());
        }
        if (filters.entityType.trim()) {
          params.append("entityType", filters.entityType.trim());
        }
        if (filters.entityId.trim()) {
          params.append("entityId", filters.entityId.trim());
        }
        if (filters.dateFrom) {
          params.append("dateFrom", filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          params.append("dateTo", filters.dateTo.toISOString());
        }

        const r = await fetch(
          `/api/backend/audit-logs?${params.toString()}`,
          { credentials: "include" }
        );

        if (!r.ok) {
          const errorData = await r.json().catch(() => ({}));
          const errorMsg =
            (errorData as { error?: string; message?: string }).error ||
            (errorData as { error?: string; message?: string }).message ||
            "Failed to fetch audit logs";
          toast.error(errorMsg);
          setRows([]);
          setTotal(0);
          return;
        }

        const j: Paged<AuditLogDTO> = await r.json();
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTotal(j.total ?? 0);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
        toast.error("Failed to load audit logs");
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load on page/pageSize changes
  useEffect(() => {
    void load(page, pageSize, filtersRef.current);
  }, [page, pageSize, load]);

  const handleApplyFilters = () => {
    setPage(1);
    void load(1, pageSize, filtersRef.current);
  };

  const handleClearFilters = () => {
    setActorUserId("");
    setAction("");
    setEntityType("");
    setEntityId("");
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
    // Filters will update via ref, then we reload
    setTimeout(() => {
      void load(1, pageSize, filtersRef.current);
    }, 0);
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  return (
    <SecurePage requiredRole="Admin">
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-bold">Audit Logs</h1>

        {/* Filters */}
        <div className="bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <input
            type="text"
            value={actorUserId}
            onChange={(e) => setActorUserId(e.target.value)}
            placeholder="Actor User ID"
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Action"
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="Entity Type (TableName)"
            className="border rounded px-3 py-2"
          />
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            placeholder="Entity ID"
            className="border rounded px-3 py-2"
          />
          <DatePicker
            selected={dateFrom}
            onChange={(date) => setDateFrom(date)}
            placeholderText="Date From"
            className="w-full border rounded px-3 py-2"
            dateFormat="yyyy-MM-dd"
          />
          <DatePicker
            selected={dateTo}
            onChange={(date) => setDateTo(date)}
            placeholderText="Date To"
            className="w-full border rounded px-3 py-2"
            dateFormat="yyyy-MM-dd"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleApplyFilters}
            className="border rounded px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="border rounded px-3 py-2"
          >
            Clear
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div>Loading…</div>
        ) : (
          <div className="overflow-x-auto border rounded bg-white">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left border-b bg-gray-100">
                  <th className="py-2 px-4">Timestamp</th>
                  <th className="py-2 px-4">Actor</th>
                  <th className="py-2 px-4">Action</th>
                  <th className="py-2 px-4">Entity Type</th>
                  <th className="py-2 px-4">Entity ID</th>
                  <th className="py-2 px-4">Summary</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.auditLogId}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedLog(r)}
                  >
                    <td className="py-2 px-4">{formatDate(r.performedAt)}</td>
                    <td className="py-2 px-4">
                      {r.performedByName ?? `User #${r.performedBy ?? "—"}`}
                    </td>
                    <td className="py-2 px-4">{r.action}</td>
                    <td className="py-2 px-4">{r.entityType ?? "—"}</td>
                    <td className="py-2 px-4">{r.entityId ?? "—"}</td>
                    <td className="py-2 px-4">
                      {r.route && r.method
                        ? `${r.method} ${r.route}`
                        : r.changesRaw
                        ? "Has changes"
                        : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No audit logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border rounded px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <div>
            Page {page} / {totalPages} (Total: {total})
          </div>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border rounded px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>

        {/* Detail Drawer */}
        {selectedLog && (
          <AuditLogDetailDrawer
            log={selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        )}
      </div>
    </SecurePage>
  );
}

function AuditLogDetailDrawer({
  log,
  onClose,
}: {
  log: AuditLogDTO;
  onClose: () => void;
}) {
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const safeStringify = (value: unknown): string => {
    try {
      if (value === null || value === undefined) return "null";
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Audit Log Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Audit Log ID:</strong> {log.auditLogId}
          </div>
          <div>
            <strong>Timestamp:</strong> {formatDate(log.performedAt)}
          </div>
          <div>
            <strong>Actor:</strong> {log.performedByName ?? `User #${log.performedBy ?? "—"}`}
          </div>
          <div>
            <strong>Action:</strong> {log.action}
          </div>
          <div>
            <strong>Entity Type:</strong> {log.entityType ?? "—"}
          </div>
          <div>
            <strong>Entity ID:</strong> {log.entityId ?? "—"}
          </div>
          <div>
            <strong>Route:</strong> {log.route ?? "—"}
          </div>
          <div>
            <strong>Method:</strong> {log.method ?? "—"}
          </div>
          <div>
            <strong>Status Code:</strong> {log.statusCode ?? "—"}
          </div>
        </div>

        <div>
          <strong>Changes (JSON):</strong>
          <pre className="mt-2 p-4 bg-gray-100 rounded overflow-x-auto text-xs">
            {(() => {
              const raw = log.changesRaw || safeStringify(log.changes);
              const maxLength = 50 * 1024; // 50KB
              if (raw && raw.length > maxLength) {
                return raw.substring(0, maxLength) + `\n\n... (truncated, ${raw.length - maxLength} characters remaining)`;
              }
              return raw;
            })()}
          </pre>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
