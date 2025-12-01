// src/app/(admin)/settings/suppliers/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SupplierDTO = {
  SuppID: number;
  SuppName: string;
  SuppAddress: string | null; // long text
  SuppCode: string | null;
  SuppContact: string | null;
  SuppEmail: string | null;
  SuppPhone: string | null;
  Notes: string | null;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // keep latest search without forcing the effect to depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(p), pageSize: String(ps), search: q });
      const r = await fetch(`/api/backend/settings/suppliers?` + qs.toString(), { credentials: "include" });
      if (!r.ok) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const j: Paged<SupplierDTO> = await r.json();
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

  const [editing, setEditing] = useState<SupplierDTO | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name/code/contact/email/phone"
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
          + New Supplier
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
              <th className="py-2">Code</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Email</th>
              <th className="py-2">Phone</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.SuppID} className="border-b">
                <td className="py-2">{r.SuppID}</td>
                <td className="py-2">{r.SuppName}</td>
                <td className="py-2">{r.SuppCode ?? "—"}</td>
                <td className="py-2">{r.SuppContact ?? "—"}</td>
                <td className="py-2">{r.SuppEmail ?? "—"}</td>
                <td className="py-2">{r.SuppPhone ?? "—"}</td>
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
                      if (!confirm("Delete this supplier?")) return;
                      const resp = await fetch(`/api/backend/settings/suppliers/${r.SuppID}`, {
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
                <td colSpan={7} className="py-6 text-center text-slate-500">
                  No suppliers found.
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
        <div>Page {page} / {totalPages}</div>
        <button
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
          className="border rounded px-3 py-1"
        >
          Next
        </button>
      </div>

      {showForm && (
        <SupplierForm
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

function SupplierForm(props: Readonly<{
  initial?: Partial<SupplierDTO>;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, onClose, onSaved } = props;

  const isEdit = Boolean(initial?.SuppID);
  const [SuppName, setSuppName] = useState(initial?.SuppName ?? "");
  const [SuppCode, setSuppCode] = useState(initial?.SuppCode ?? "");
  const [SuppContact, setSuppContact] = useState(initial?.SuppContact ?? "");
  const [SuppEmail, setSuppEmail] = useState(initial?.SuppEmail ?? "");
  const [SuppPhone, setSuppPhone] = useState(initial?.SuppPhone ?? "");
  const [SuppAddress, setSuppAddress] = useState(initial?.SuppAddress ?? "");
  const [Notes, setNotes] = useState(initial?.Notes ?? "");

  const submit = async () => {
    if (!SuppName.trim()) {
      alert("Supplier Name is required");
      return;
    }
    const payload = {
      SuppName: SuppName.trim(),
      SuppCode: SuppCode.trim() || null,
      SuppContact: SuppContact.trim() || null,
      SuppEmail: SuppEmail.trim() || null,
      SuppPhone: SuppPhone.trim() || null,
      SuppAddress: SuppAddress || null,
      Notes: Notes || null,
    };

    const url = isEdit
      ? `/api/backend/settings/suppliers/${initial!.SuppID}`
      : `/api/backend/settings/suppliers`;
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
      <div className="bg-white rounded-xl p-6 w-full max-w-3xl space-y-3">
        <h2 className="text-xl font-semibold">{isEdit ? "Edit Supplier" : "New Supplier"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">Name * (≤255) <input
              className="border rounded px-2 py-1"
              value={SuppName}
              onChange={(e) => setSuppName(e.target.value)}
            />
          </label>
          <label className="flex flex-col">Code (≤50) <input
              className="border rounded px-2 py-1"
              value={SuppCode ?? ""}
              onChange={(e) => setSuppCode(e.target.value)}
            />
          </label>
          <label className="flex flex-col">Contact (≤255) <input
              className="border rounded px-2 py-1"
              value={SuppContact ?? ""}
              onChange={(e) => setSuppContact(e.target.value)}
            />
          </label>
          <label className="flex flex-col">Email (≤255) <input
              className="border rounded px-2 py-1"
              value={SuppEmail ?? ""}
              onChange={(e) => setSuppEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col">Phone (≤50) <input
              className="border rounded px-2 py-1"
              value={SuppPhone ?? ""}
              onChange={(e) => setSuppPhone(e.target.value)}
            />
          </label>
          <label className="flex flex-col col-span-2">Address <textarea
              className="border rounded px-2 py-1 min-h-[80px]"
              value={SuppAddress ?? ""}
              onChange={(e) => setSuppAddress(e.target.value)}
            />
          </label>
          <label className="flex flex-col col-span-2">Notes <textarea
              className="border rounded px-2 py-1 min-h-[80px]"
              value={Notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>
        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 border rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-2 border rounded" onClick={submit}>{isEdit ? "Save" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}
