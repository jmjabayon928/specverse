// src/app/(admin)/settings/manufacturers/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ManufacturerDTO = {
  ManuID: number;
  ManuName: string;
  ManuAddress: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

export default function ManufacturersPage() {
  const [rows, setRows] = useState<ManufacturerDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // keep latest search without forcing effect to depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(p), pageSize: String(ps), search: q });
      const r = await fetch(`/api/backend/settings/manufacturers?` + qs.toString(), {
        credentials: "include",
      });
      if (!r.ok) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const j: Paged<ManufacturerDTO> = await r.json();
      setRows(j.rows ?? []);
      setTotal(j.total ?? 0);
      setLoading(false);
    },
    []
  );

  // load on page/pageSize changes (search only when user clicks Search)
  useEffect(() => {
    void load(page, pageSize, searchRef.current);
  }, [page, pageSize, load]);

  const [editing, setEditing] = useState<ManufacturerDTO | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name/address"
          className="border rounded px-3 py-2"
        />
        <button
          onClick={() => {
            setPage(1);
            void load(1, pageSize, search);
          }}
          className="border rounded px-3 py-2"
        >
          Search
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="border rounded px-3 py-2"
        >
          + New Manufacturer
        </button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Name</th>
              <th className="py-2">Address</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ManuID} className="border-b">
                <td className="py-2">{r.ManuID}</td>
                <td className="py-2">{r.ManuName}</td>
                <td className="py-2">{r.ManuAddress}</td>
                <td className="py-2">
                  <button
                    className="mr-2 underline"
                    onClick={() => {
                      setEditing(r);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-red-600 underline"
                    onClick={async () => {
                      if (!confirm("Delete this manufacturer?")) return;
                      const resp = await fetch(`/api/backend/settings/manufacturers/${r.ManuID}`, {
                        method: "DELETE",
                        credentials: "include",
                      });
                      const j = await resp.json().catch(() => ({}));
                      if (!resp.ok) {
                        alert(j.error ?? "Delete failed");
                        return;
                      }
                      void load(page, pageSize, searchRef.current);
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  No manufacturers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="border rounded px-3 py-1"
        >
          Prev
        </button>
        <div>
          Page {page} / {totalPages}
        </div>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="border rounded px-3 py-1"
        >
          Next
        </button>
      </div>

      {showForm && (
        <ManufacturerForm
          initial={editing ?? undefined}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            void load(page, pageSize, searchRef.current);
          }}
        />
      )}
    </div>
  );
}

function ManufacturerForm(props: Readonly<{
  initial?: Partial<ManufacturerDTO>;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, onClose, onSaved } = props;

  const isEdit = Boolean(initial?.ManuID);
  const [ManuName, setManuName] = useState(initial?.ManuName ?? "");
  const [ManuAddress, setManuAddress] = useState(initial?.ManuAddress ?? "");

  const submit = async () => {
    if (!ManuName.trim() || !ManuAddress.trim()) {
      alert("Name and Address are required");
      return;
    }
    const payload = { ManuName: ManuName.trim(), ManuAddress: ManuAddress.trim() };
    const url = isEdit
      ? `/api/backend/settings/manufacturers/${initial!.ManuID}`
      : `/api/backend/settings/manufacturers`;
    const method = isEdit ? "PATCH" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error ?? "Save failed");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">{isEdit ? "Edit Manufacturer" : "New Manufacturer"}</h2>
        <label className="flex flex-col">
          Name * (≤150) <input
            className="border rounded px-2 py-1"
            value={ManuName}
            onChange={(e) => setManuName(e.target.value)}
          />
        </label>
        <label className="flex flex-col">
          Address * (≤255) <input
            className="border rounded px-2 py-1"
            value={ManuAddress}
            onChange={(e) => setManuAddress(e.target.value)}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-3 py-2 border rounded" onClick={submit}>
            {isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
