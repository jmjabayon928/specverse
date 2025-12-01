// src/app/(admin)/settings/roles/[id]/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type RoleDTO = {
  RoleID: number;
  RoleName: string | null;
  CreatedAt: string;
  UpdatedAt: string;
};

type PermissionDTO = {
  PermissionID: number;
  PermissionKey: string | null;
  Description: string | null;
};

type RolePermissionsResponse = {
  role: RoleDTO;
  permissions: PermissionDTO[];
};

type Option = { value: number; label: string };

export default function RoleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params?.id);

  const [data, setData] = useState<RolePermissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [available, setAvailable] = useState<Option[]>([]);
  const [addPermissionId, setAddPermissionId] = useState<number | "">("");

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      // role + current permissions
      const r = await fetch(`/api/backend/settings/roles/${id}/permissions`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
      const j: RolePermissionsResponse = await r.json();
      setData(j);

      // available permissions (not assigned)
      const a = await fetch(`/api/backend/settings/roles/${id}/permissions/available`, { credentials: "include" });
      if (a.ok) {
        const aj: PermissionDTO[] = await a.json();
        setAvailable(
          (aj ?? []).map(p => ({ value: p.PermissionID, label: p.PermissionKey ?? `#${p.PermissionID}` }))
        );
      } else {
        setAvailable([]);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to load";
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setErr("Invalid role id");
      setLoading(false);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const role = data?.role;

  // Memoize to avoid creating a new [] each render when data?.permissions is undefined
  const perms = useMemo<PermissionDTO[]>(
    () => data?.permissions ?? [],
    [data?.permissions]
  );

  const assignedIds = useMemo(() => new Set(perms.map(p => p.PermissionID)), [perms]);

  const doAdd = async () => {
    if (addPermissionId === "" || !Number.isFinite(Number(addPermissionId))) return;
    const r = await fetch(`/api/backend/settings/roles/${id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ PermissionID: Number(addPermissionId) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error ?? "Failed to add permission");
      return;
    }
    setAddPermissionId("");
    load();
  };

  const doRemove = async (permissionId: number) => {
    if (!confirm("Remove this permission from the role?")) return;
    const r = await fetch(`/api/backend/settings/roles/${id}/permissions/${permissionId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error ?? "Failed to remove permission");
      return;
    }
    load();
  };

  const doDeleteRole = async () => {
    if (!confirm("Delete this role? This cannot be undone.")) return;
    const r = await fetch(`/api/backend/settings/roles/${id}`, { method: "DELETE", credentials: "include" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error ?? "Delete failed");
      return;
    }
    router.push("/settings/roles");
  };

  const openEdit = () => {
    setEditName(role?.RoleName ?? "");
    setShowEdit(true);
  };

  const saveEdit = async () => {
    const r = await fetch(`/api/backend/settings/roles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ RoleName: editName.trim() || null }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error ?? "Save failed");
      return;
    }
    setShowEdit(false);
    load();
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return (
    <div className="p-6 space-y-3">
      <div className="text-red-600">Error: {err}</div>
      <button className="border rounded px-3 py-2" onClick={() => router.back()}>Back</button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button className="border rounded px-3 py-2" onClick={() => router.back()}>&larr; Back</button>
        <h1 className="text-2xl font-semibold">Role: {role!.RoleName ?? `#${role!.RoleID}`}</h1>
        <div className="flex-1" />
        <button className="border rounded px-3 py-2" onClick={openEdit}>Edit</button>
        <button className="border rounded px-3 py-2 text-red-600" onClick={doDeleteRole}>Delete</button>
      </div>

      <div className="text-sm text-slate-600">
        RoleID: {role!.RoleID} · Updated: {new Date(role!.UpdatedAt).toLocaleString()}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Add Permission</h2>
        <div className="flex items-center gap-2">
          <select
            className="border rounded px-2 py-2 min-w-[280px]"
            title="Select permission to add"
            value={addPermissionId}
            onChange={e => setAddPermissionId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">— Select a permission —</option>
            {available
              .filter(o => !assignedIds.has(o.value))
              .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className="border rounded px-3 py-2" onClick={doAdd} disabled={addPermissionId === ""}>
            Add
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Assigned Permissions</h2>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b bg-slate-50">
                <th className="py-2 px-3">Permission ID</th>
                <th className="py-2 px-3">Key</th>
                <th className="py-2 px-3">Description</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {perms.map(p => (
                <tr key={p.PermissionID} className="border-b">
                  <td className="py-2 px-3">{p.PermissionID}</td>
                  <td className="py-2 px-3">{p.PermissionKey ?? "—"}</td>
                  <td className="py-2 px-3">{p.Description ?? "—"}</td>
                  <td className="py-2 px-3">
                    <button className="text-red-600 underline" onClick={() => doRemove(p.PermissionID)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {perms.length === 0 && (
                <tr><td className="py-6 px-3 text-center text-slate-500" colSpan={4}>No permissions assigned to this role.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {showEdit && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-semibold">Edit Role</h3>
            <label className="flex flex-col">
              Role Name <input className="border rounded px-2 py-1" value={editName} onChange={e => setEditName(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-2 border rounded" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="px-3 py-2 border rounded" onClick={saveEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
