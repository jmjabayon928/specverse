// src/app/(admin)/settings/roles/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type RoleDTO = {
  RoleID: number;
  RoleName: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  PermissionsCount?: number;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };

export default function RolesPage() {
  const [rows, setRows] = useState<RoleDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // Keep latest search without forcing the effect to depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Stable loader with explicit params
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      setLoadError("");
      try {
        const qs = new URLSearchParams({ page: String(p), pageSize: String(ps), search: q });
        const r = await fetch(`/api/backend/settings/roles?` + qs.toString(), { credentials: "include" });
        if (!r.ok) {
          setRows([]);
          setTotal(0);
          if (r.status === 401) setLoadError("Please sign in to view roles.");
          else if (r.status === 403) setLoadError("Unauthorized. You don't have permission to view roles.");
          else setLoadError("Unable to load roles.");
          return;
        }
        setLoadError("");
        const j: Paged<RoleDTO> = await r.json();
        setRows(Array.isArray(j.rows) ? j.rows : []);
        setTotal(j.total ?? 0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load on page/pageSize changes (search only when user clicks Search)
  useEffect(() => {
    void load(page, pageSize, searchRef.current);
  }, [page, pageSize, load]);

  const [editing, setEditing] = useState<RoleDTO | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search role name"
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
          + New Role
        </button>
      </div>

      {loadError ? (
        <div className="py-4 text-red-600">{loadError}</div>
      ) : loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Role Name</th>
              <th className="py-2">Permissions</th>
              <th className="py-2">Updated</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.RoleID} className="border-b">
                <td className="py-2">{r.RoleID}</td>
                <td className="py-2">{r.RoleName ?? "—"}</td>
                <td className="py-2">{r.PermissionsCount ?? 0}</td>
                <td className="py-2">{r.UpdatedAt ? new Date(r.UpdatedAt).toLocaleString() : "—"}</td>
                <td className="py-2">
                  <Link
                    href={`/settings/roles/${r.RoleID}`}
                    className="mr-2 underline"
                  >
                    Manage
                  </Link>
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
                      if (!confirm("Delete this role?")) return;
                      const resp = await fetch(`/api/backend/settings/roles/${r.RoleID}`, {
                        method: "DELETE",
                        credentials: "include",
                      });
                      const j = await resp.json().catch(() => ({}));
                      if (!resp.ok) {
                        alert((j as { error?: string }).error ?? "Delete failed");
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
                <td colSpan={5} className="py-6 text-center text-slate-500">
                  No roles found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!loadError && (
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
      )}

      {showForm && (
        <RoleForm
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

function RoleForm(props: Readonly<{
  initial?: Partial<RoleDTO>;
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, onClose, onSaved } = props;

  const isEdit = Boolean(initial?.RoleID);
  const [RoleName, setRoleName] = useState(initial?.RoleName ?? "");

  const submit = async () => {
    const trimmed = RoleName.trim();
    if (!trimmed) {
      alert("Role Name is required");
      return;
    }
    const payload = { RoleName: trimmed };

    const url = isEdit
      ? `/api/backend/settings/roles/${initial!.RoleID}`
      : `/api/backend/settings/roles`;
    const method = isEdit ? "PATCH" : "POST";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "Save failed");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-full max-w-xl space-y-3">
        <h2 className="text-xl font-semibold">{isEdit ? "Edit Role" : "New Role"}</h2>
        <div className="grid grid-cols-1 gap-3">
          <label className="flex flex-col">
            Role Name * <input
              className="border rounded px-2 py-1"
              value={RoleName}
              onChange={(e) => setRoleName(e.target.value)}
            />
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
