"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import type { InventoryTransactionDTO } from "@/domain/inventory/inventoryTypes";

type ExportJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
const POLL_INTERVAL_MS = 2000;

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

type ItemOption = {
  ItemID: number;
  SheetName: string;
};

type WarehouseOption = {
  warehouseId: number;
  warehouseName: string;
};

export default function InventoryTransactionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<InventoryTransactionDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  // Export job (jobId from URL ?exportJobId=)
  const [exportJobId, setExportJobId] = useState<number | null>(() => {
    const id = searchParams.get("exportJobId");
    const n = id ? parseInt(id, 10) : NaN;
    return Number.isInteger(n) && n > 0 ? n : null;
  });
  const [exportStatus, setExportStatus] = useState<ExportJobStatus | null>(null);
  const [exportFileName, setExportFileName] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filters
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [itemId, setItemId] = useState<number | undefined>(undefined);
  const [transactionType, setTransactionType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);

  // Options
  const [itemOptions, setItemOptions] = useState<ItemOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);

  // Sync exportJobId from URL when it changes (e.g. back/forward)
  useEffect(() => {
    const id = searchParams.get("exportJobId");
    const n = id ? parseInt(id, 10) : NaN;
    const next = Number.isInteger(n) && n > 0 ? n : null;
    setExportJobId((prev) => (prev !== next ? next : prev));
  }, [searchParams]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  // Keep latest filters without forcing the effect to depend on them
  const filtersRef = useRef({
    warehouseId,
    itemId,
    transactionType,
    dateFrom,
    dateTo,
  });
  useEffect(() => {
    filtersRef.current = {
      warehouseId,
      itemId,
      transactionType,
      dateFrom,
      dateTo,
    };
  }, [warehouseId, itemId, transactionType, dateFrom, dateTo]);

  // Load item options
  useEffect(() => {
    fetch("/api/backend/inventory/item-options", { credentials: "include" })
      .then((res) => res.json())
      .then((data: ItemOption[]) => {
        setItemOptions(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Failed to load item options:", err);
        setItemOptions([]);
      });
  }, []);

  // Stable loader with explicit params
  const load = useCallback(
    async (
      p: number,
      ps: number,
      filters: {
        warehouseId?: number;
        itemId?: number;
        transactionType?: string;
        dateFrom?: Date | null;
        dateTo?: Date | null;
      }
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(p),
          pageSize: String(ps),
        });

        if (filters.warehouseId !== undefined) {
          params.append("warehouseId", String(filters.warehouseId));
        }
        if (filters.itemId !== undefined) {
          params.append("itemId", String(filters.itemId));
        }
        if (filters.transactionType) {
          params.append("transactionType", filters.transactionType);
        }
        if (filters.dateFrom) {
          params.append("dateFrom", filters.dateFrom.toISOString());
        }
        if (filters.dateTo) {
          params.append("dateTo", filters.dateTo.toISOString());
        }

        const r = await fetch(
          `/api/backend/inventory/all/transactions?${params.toString()}`,
          { credentials: "include" }
        );

        if (!r.ok) {
          const error = await r.json().catch(() => ({ message: "Failed to load transactions" }));
          toast.error(error.message || "Failed to load transactions");
          setRows([]);
          setTotal(0);
          return;
        }

        const j: Paged<InventoryTransactionDTO> = await r.json();
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTotal(j.total ?? 0);

        // Derive warehouse options from loaded transactions
        const warehouses = new Map<number, string>();
        j.rows.forEach((row) => {
          if (!warehouses.has(row.warehouseId)) {
            warehouses.set(row.warehouseId, row.warehouseName);
          }
        });
        setWarehouseOptions(
          Array.from(warehouses.entries()).map(([id, name]) => ({
            warehouseId: id,
            warehouseName: name,
          }))
        );
      } catch (err) {
        console.error("Load error:", err);
        toast.error("Failed to load transactions");
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
    setWarehouseId(undefined);
    setItemId(undefined);
    setTransactionType("");
    setDateFrom(null);
    setDateTo(null);
    setPage(1);
    // Load will be triggered by the useEffect when filters change
  };

  // Start export job (async export)
  const handleExportCsv = useCallback(async () => {
    setExportError(null);
    setExportDownloadUrl(null);
    setExportFileName(null);
    const params: Record<string, unknown> = {};
    if (filtersRef.current.warehouseId !== undefined) {
      params.warehouseId = filtersRef.current.warehouseId;
    }
    if (filtersRef.current.itemId !== undefined) {
      params.itemId = filtersRef.current.itemId;
    }
    if (filtersRef.current.transactionType) {
      params.transactionType = filtersRef.current.transactionType;
    }
    if (filtersRef.current.dateFrom) {
      params.dateFrom = filtersRef.current.dateFrom.toISOString();
    }
    if (filtersRef.current.dateTo) {
      params.dateTo = filtersRef.current.dateTo.toISOString();
    }
    try {
      const r = await fetch("/api/backend/exports/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          jobType: "inventory_transactions_csv",
          params,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: "Failed to start export" }));
        toast.error(err.message || "Failed to start export");
        if (r.status === 413) setExportError(err.message || "Limit exceeded");
        return;
      }
      const data = (await r.json()) as { jobId: number; status: string };
      setExportJobId(data.jobId);
      setExportStatus(data.status as ExportJobStatus);
      const next = new URLSearchParams(searchParams.toString());
      next.set("exportJobId", String(data.jobId));
      router.replace(`?${next.toString()}`, { scroll: false });
      toast.success("Export started");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to start export");
    }
  }, [router, searchParams]);

  // Poll export job status when jobId is set
  useEffect(() => {
    if (exportJobId == null) return;
    const tick = async () => {
      try {
        const r = await fetch(`/api/backend/exports/jobs/${exportJobId}`, {
          credentials: "include",
        });
        if (!r.ok) {
          if (r.status === 404) {
            setExportStatus("failed");
            setExportError("Job not found");
            return;
          }
          return;
        }
        const job = (await r.json()) as {
          status: string;
          errorMessage?: string | null;
          fileName?: string | null;
        };
        setExportStatus(job.status as ExportJobStatus);
        if (job.status === "completed") {
          setExportError(null);
          const urlRes = await fetch(
            `/api/backend/exports/jobs/${exportJobId}/download-url`,
            { credentials: "include" }
          );
          if (urlRes.ok) {
            const urlData = (await urlRes.json()) as {
              downloadUrl: string;
              fileName: string;
            };
            setExportDownloadUrl(urlData.downloadUrl);
            setExportFileName(urlData.fileName);
          }
          return;
        }
        if (job.status === "failed" || job.status === "cancelled") {
          setExportError(job.errorMessage || job.status);
        }
      } catch {
        // keep polling on network error
      }
    };
    void tick();
    const id = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);
    pollRef.current = id;
    return () => {
      clearInterval(id);
      pollRef.current = null;
    };
  }, [exportJobId]);

  // Stop polling when status is terminal
  useEffect(() => {
    const terminal = ["completed", "failed", "cancelled"];
    if (exportStatus && terminal.includes(exportStatus) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [exportStatus]);

  const clearExportJob = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setExportJobId(null);
    setExportStatus(null);
    setExportFileName(null);
    setExportError(null);
    setExportDownloadUrl(null);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("exportJobId");
    const q = next.toString();
    router.replace(q ? `?${q}` : "/inventory/transactions", { scroll: false });
  }, [router, searchParams]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All Stock Transactions</h1>
        <button
          onClick={handleExportCsv}
          className="border rounded px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

      {/* Export job status (when jobId in URL or state) */}
      {exportJobId != null && (
        <div className="bg-white p-4 rounded shadow-md border border-gray-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <span className="font-medium">Export job #{exportJobId}</span>
              {exportStatus && (
                <span className="ml-2 text-gray-600">
                  Status: {exportStatus}
                  {(exportStatus === "queued" || exportStatus === "running") && "…"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {exportStatus === "completed" && exportDownloadUrl && (
                <a
                  href={exportDownloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded px-3 py-2 bg-green-600 text-white hover:bg-green-700 text-sm"
                >
                  Download {exportFileName || "CSV"}
                </a>
              )}
              {(exportStatus === "failed" ||
                exportStatus === "cancelled" ||
                exportStatus === "completed") && (
                <button
                  type="button"
                  onClick={clearExportJob}
                  className="border rounded px-3 py-2 text-sm"
                >
                  Dismiss
                </button>
              )}
            </div>
          </div>
          {exportError && (
            <p className="mt-2 text-sm text-red-600">{exportError}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded shadow-md grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <select
          value={warehouseId ?? ""}
          onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : undefined)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Warehouses</option>
          {warehouseOptions.map((w) => (
            <option key={w.warehouseId} value={w.warehouseId}>
              {w.warehouseName}
            </option>
          ))}
        </select>

        <select
          value={itemId ?? ""}
          onChange={(e) => setItemId(e.target.value ? Number(e.target.value) : undefined)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Items</option>
          {itemOptions.map((item) => (
            <option key={item.ItemID} value={item.ItemID}>
              {item.SheetName}
            </option>
          ))}
        </select>

        <select
          value={transactionType}
          onChange={(e) => setTransactionType(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Types</option>
          <option value="Receive">Receive</option>
          <option value="Issue">Issue</option>
          <option value="Adjustment">Adjustment</option>
        </select>

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
      </div>

      {/* Table */}
      {loading ? (
        <div>Loading…</div>
      ) : (
        <div className="overflow-x-auto border rounded-md">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((tx) => (
                <tr key={tx.transactionId}>
                  <td className="px-4 py-2">{tx.itemName}</td>
                  <td className="px-4 py-2">{tx.warehouseName}</td>
                  <td className="px-4 py-2">{tx.quantityChanged}</td>
                  <td className="px-4 py-2">{tx.transactionType}</td>
                  <td className="px-4 py-2">
                    {new Date(tx.performedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">{tx.performedBy ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No transactions found.
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
    </div>
  );
}
