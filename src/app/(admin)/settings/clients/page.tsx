// src/app/%28admin%29/settings/clients/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ClientDTO = {
  ClientID: number;
  ClientCode: string;
  ClientName: string;
  ClientEmail: string;
  ClientPhone: string;
  ClientAddress: string;
  ContactPerson: string;
  ClientLogo: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // Keep latest search without making the effect depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(p), pageSize: String(ps), search: q });
      const r = await fetch(`/api/backend/settings/clients?` + qs.toString(), { credentials: "include" });
      if (!r.ok) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const j: Paged<ClientDTO> = await r.json();
      setRows(j.rows ?? []);
      setTotal(j.total ?? 0);
      setLoading(false);
    },
    []
  );

  // Load on page/pageSize changes (search only when user clicks Search)
  useEffect(() => {
    void load(page, pageSize, searchRef.current);
  }, [page, pageSize, load]);

  const [editing, setEditing] = useState<ClientDTO | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search code/name/email/phone"
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
          + New Client
        </button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Code</th>
              <th className="py-2">Name</th>
              <th className="py-2">Email</th>
              <th className="py-2">Phone</th>
              <th className="py-2">Contact</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ClientID} className="border-b">
                <td className="py-2">{r.ClientID}</td>
                <td className="py-2">{r.ClientCode}</td>
                <td className="py-2">{r.ClientName}</td>
                <td className="py-2">{r.ClientEmail}</td>
                <td className="py-2">{r.ClientPhone}</td>
                <td className="py-2">{r.ContactPerson}</td>
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
                      if (!confirm("Delete this client?")) return;
                      const resp = await fetch(`/api/backend/settings/clients/${r.ClientID}`, {
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
                  No clients found.
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
        <ClientForm
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

function ClientForm(props: Readonly<{
  initial?: Partial<ClientDTO>;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, onClose, onSaved } = props;

  const isEdit = Boolean(initial?.ClientID);

  const [ClientCode, setClientCode] = useState(initial?.ClientCode ?? "");
  const [ClientName, setClientName] = useState(initial?.ClientName ?? "");
  const [ClientEmail, setClientEmail] = useState(initial?.ClientEmail ?? "");
  const [ClientPhone, setClientPhone] = useState(initial?.ClientPhone ?? "");
  const [ClientAddress, setClientAddress] = useState(initial?.ClientAddress ?? "");
  const [ContactPerson, setContactPerson] = useState(initial?.ContactPerson ?? "");
  const [ClientLogo, setClientLogo] = useState(initial?.ClientLogo ?? "");

  const submit = async () => {
    const required = [ClientCode, ClientName, ClientEmail, ClientPhone, ClientAddress, ContactPerson, ClientLogo];
    if (required.some((v) => !v || !String(v).trim())) {
      alert("Please fill all required fields.");
      return;
    }
    const payload = {
      ClientCode: ClientCode.trim(),
      ClientName: ClientName.trim(),
      ClientEmail: ClientEmail.trim(),
      ClientPhone: ClientPhone.trim(),
      ClientAddress: ClientAddress.trim(),
      ContactPerson: ContactPerson.trim(),
      ClientLogo: ClientLogo.trim(),
    };

    const url = isEdit
      ? `/api/backend/settings/clients/${initial!.ClientID}`
      : `/api/backend/settings/clients`;
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
        <h2 className="text-xl font-semibold">{isEdit ? "Edit Client" : "New Client"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            Client Code * (≤20) <input className="border rounded px-2 py-1" value={ClientCode} onChange={(e) => setClientCode(e.target.value)} />
          </label>
          <label className="flex flex-col">
            Client Name * (≤150) <input className="border rounded px-2 py-1" value={ClientName} onChange={(e) => setClientName(e.target.value)} />
          </label>
          <label className="flex flex-col">
            Email * (≤150) <input className="border rounded px-2 py-1" value={ClientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </label>
          <label className="flex flex-col">
            Phone * (≤150) <input className="border rounded px-2 py-1" value={ClientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </label>
          <label className="flex flex-col col-span-2">
            Address * (≤150) <input className="border rounded px-2 py-1" value={ClientAddress} onChange={(e) => setClientAddress(e.target.value)} />
          </label>
          <label className="flex flex-col">
            Contact Person * (≤150) <input className="border rounded px-2 py-1" value={ContactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </label>
          <label className="flex flex-col">
            Logo URL * (≤150) <input className="border rounded px-2 py-1" value={ClientLogo} onChange={(e) => setClientLogo(e.target.value)} />
          </label>
        </div>
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
