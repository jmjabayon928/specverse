// src/components/inventory/InventoryPageClient.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  InventoryListItem,
  InventoryListEnvelope,
} from "@/domain/inventory/inventoryTypes";
import InventoryListTable from "./InventoryListTable";

type RefOption = { id: number; name: string };

interface Props {
  onSelectItem?: (id: number) => void;
}

function isEnvelope(
  data: InventoryListItem[] | InventoryListEnvelope
): data is InventoryListEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "rows" in data &&
    "total" in data &&
    Array.isArray((data as InventoryListEnvelope).rows)
  );
}

export default function InventoryPageClient({ onSelectItem }: Props) {
  const [rows, setRows] = useState<InventoryListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [suppId, setSuppId] = useState<number | undefined>(undefined);
  const [manuId, setManuId] = useState<number | undefined>(undefined);

  const [categories, setCategories] = useState<RefOption[]>([]);
  const [suppliers, setSuppliers] = useState<RefOption[]>([]);
  const [manufacturers, setManufacturers] = useState<RefOption[]>([]);
  const [warehouses, setWarehouses] = useState<RefOption[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (search.trim()) params.set("search", search.trim());
    if (warehouseId !== undefined) params.set("warehouseId", String(warehouseId));
    if (categoryId !== undefined) params.set("categoryId", String(categoryId));
    if (suppId !== undefined) params.set("suppId", String(suppId));
    if (manuId !== undefined) params.set("manuId", String(manuId));

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    fetch(`/api/backend/inventory?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data: InventoryListItem[] | InventoryListEnvelope) => {
        if (isEnvelope(data)) {
          setRows(Array.isArray(data.rows) ? data.rows : []);
          setTotal(typeof data.total === "number" ? data.total : 0);
        } else if (Array.isArray(data)) {
          setRows(data);
          setTotal(data.length);
        } else {
          setRows([]);
          setTotal(0);
        }
      })
      .catch(() => {
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, search, warehouseId, categoryId, suppId, manuId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    fetch("/api/backend/inventory/reference-options", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => res.json())
      .then((data: {
        categories?: Array<{ categoryId: number; CategoryName: string }>;
        suppliers?: Array<{ suppId: number; suppName: string }>;
        manufacturers?: Array<{ manuId: number; manuName: string }>;
        warehouses?: Array<{ warehouseId: number; warehouseName: string }>;
      }) => {
        setCategories(
          (data.categories ?? []).map((c) => ({ id: c.categoryId, name: c.CategoryName }))
        );
        setSuppliers(
          (data.suppliers ?? []).map((s) => ({ id: s.suppId, name: s.suppName }))
        );
        setManufacturers(
          (data.manufacturers ?? []).map((m) => ({ id: m.manuId, name: m.manuName }))
        );
        setWarehouses(
          (data.warehouses ?? []).map((w) => ({ id: w.warehouseId, name: w.warehouseName }))
        );
      })
      .catch(() => {});
  }, []);

  const handleApply = () => {
    setPage(1);
  };

  const handleClear = () => {
    setSearch("");
    setWarehouseId(undefined);
    setCategoryId(undefined);
    setSuppId(undefined);
    setManuId(undefined);
    setPage(1);
  };

  const handleSelectItem = (id: number) => {
    if (onSelectItem) onSelectItem(id);
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Inventory</h1>

      <div className="bg-white p-4 rounded border grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <input
          type="text"
          placeholder="Search item name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <select
          value={warehouseId ?? ""}
          onChange={(e) =>
            setWarehouseId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="border rounded px-3 py-2"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        <select
          value={categoryId ?? ""}
          onChange={(e) =>
            setCategoryId(e.target.value ? Number(e.target.value) : undefined)
          }
          className="border rounded px-3 py-2"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={suppId ?? ""}
          onChange={(e) => setSuppId(e.target.value ? Number(e.target.value) : undefined)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Suppliers</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={manuId ?? ""}
          onChange={(e) => setManuId(e.target.value ? Number(e.target.value) : undefined)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Manufacturers</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleApply}
            className="border rounded px-3 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="border rounded px-3 py-2"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4 text-gray-500">Loading…</div>
      ) : (
        <InventoryListTable inventory={rows} onSelectItem={handleSelectItem} />
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="border rounded px-3 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm">
            {start}–{end} of {total}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="border rounded px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          className="border rounded px-2 py-1 text-sm"
        >
          <option value={10}>10 per page</option>
          <option value={20}>20 per page</option>
          <option value={50}>50 per page</option>
          <option value={100}>100 per page</option>
        </select>
      </div>
    </div>
  );
}
