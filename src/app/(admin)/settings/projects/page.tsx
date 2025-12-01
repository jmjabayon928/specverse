// src/app/(admin)/settings/projects/page.tsx
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProjectDTO = {
  ProjectID: number;
  ClientID: number;
  ClientProjNum: string;
  ProjNum: string;
  ProjName: string;
  ProjDesc: string;
  ManagerID: number;
  StartDate: string; // ISO
  EndDate: string | null; // ISO or null
  ClientName?: string;
  ManagerName?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
};

type Paged<T> = { page: number; pageSize: number; total: number; rows: T[] };
type Option = { value: number; label: string };

// Shapes returned by `/api/backend/settings/projects/options`
type ClientRow = { ClientID: number; ClientName: string };
type ManagerRow = { UserID: number; FirstName?: string | null; LastName?: string | null; Email?: string | null };
type OptionsPayload = { clients?: ClientRow[]; managers?: ManagerRow[] };

export default function ProjectsPage() {
  const [rows, setRows] = useState<ProjectDTO[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const [clients, setClients] = useState<Option[]>([]);
  const [managers, setManagers] = useState<Option[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  // Keep latest search without making the effect depend on it
  const searchRef = useRef(search);
  useEffect(() => {
    searchRef.current = search;
  }, [search]);

  // Fully parameterized loader so deps are stable
  const load = useCallback(
    async (p: number, ps: number, q: string) => {
      setLoading(true);
      const qs = new URLSearchParams({ page: String(p), pageSize: String(ps), search: q });
      const r = await fetch(`/api/backend/settings/projects?` + qs.toString(), { credentials: "include" });
      if (!r.ok) {
        setRows([]);
        setTotal(0);
        setLoading(false);
        return;
      }
      const j: Paged<ProjectDTO> = await r.json();
      setRows(j.rows ?? []);
      setTotal(j.total ?? 0);
      setLoading(false);
    },
    []
  );

  // Load when page/pageSize change (not on search change)
  useEffect(() => {
    void load(page, pageSize, searchRef.current);
  }, [page, pageSize, load]);

  const loadOptions = useCallback(async () => {
    const r = await fetch(`/api/backend/settings/projects/options`, { credentials: "include" });
    if (!r.ok) return;
    const j: OptionsPayload = await r.json();

    const clientOpts: Option[] = Array.isArray(j.clients)
      ? j.clients.map((c) => ({ value: c.ClientID, label: c.ClientName }))
      : [];

    const managerOpts: Option[] = Array.isArray(j.managers)
      ? j.managers.map((u) => {
          const name = [u.FirstName, u.LastName].filter(Boolean).join(" ").trim();
          return { value: u.UserID, label: name || (u.Email ?? String(u.UserID)) };
        })
      : [];

    setClients(clientOpts);
    setManagers(managerOpts);
  }, []);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const [editing, setEditing] = useState<ProjectDTO | null>(null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name/number/client"
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
          + New Project
        </button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2">ID</th>
              <th className="py-2">Project #</th>
              <th className="py-2">Client Proj #</th>
              <th className="py-2">Name</th>
              <th className="py-2">Client</th>
              <th className="py-2">Manager</th>
              <th className="py-2">Start</th>
              <th className="py-2">End</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ProjectID} className="border-b">
                <td className="py-2">{r.ProjectID}</td>
                <td className="py-2">{r.ProjNum}</td>
                <td className="py-2">{r.ClientProjNum}</td>
                <td className="py-2">{r.ProjName}</td>
                <td className="py-2">{r.ClientName ?? r.ClientID}</td>
                <td className="py-2">{r.ManagerName ?? r.ManagerID}</td>
                <td className="py-2">{new Date(r.StartDate).toLocaleDateString()}</td>
                <td className="py-2">{r.EndDate ? new Date(r.EndDate).toLocaleDateString() : "—"}</td>
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
                      if (!confirm("Delete this project?")) return;
                      const resp = await fetch(`/api/backend/settings/projects/${r.ProjectID}`, {
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
                <td colSpan={9} className="py-6 text-center text-slate-500">
                  No projects found.
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
        <ProjectForm
          initial={editing ?? undefined}
          clients={clients}
          managers={managers}
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

function ProjectForm(props: Readonly<{
  initial?: Partial<ProjectDTO>;
  clients: { value: number; label: string }[];
  managers: { value: number; label: string }[];
  onClose: () => void;
  onSaved: () => void;
}>) {
  const { initial, clients, managers, onClose, onSaved } = props;

  const isEdit = Boolean(initial?.ProjectID);
  const [ClientID, setClientID] = useState<number | "">(initial?.ClientID ?? "");
  const [ManagerID, setManagerID] = useState<number | "">(initial?.ManagerID ?? "");
  const [ClientProjNum, setClientProjNum] = useState(initial?.ClientProjNum ?? "");
  const [ProjNum, setProjNum] = useState(initial?.ProjNum ?? "");
  const [ProjName, setProjName] = useState(initial?.ProjName ?? "");
  const [ProjDesc, setProjDesc] = useState(initial?.ProjDesc ?? "");
  const [StartDate, setStartDate] = useState((initial?.StartDate ?? "").slice(0, 10));
  const [EndDate, setEndDate] = useState(initial?.EndDate ? initial.EndDate.slice(0, 10) : "");

  const submit = async () => {
    // basic requireds
    if (!ClientID || !ManagerID || !ClientProjNum || !ProjNum || !ProjName || !StartDate) {
      alert("Please fill all required fields.");
      return;
    }
    const payload = {
      ClientID: Number(ClientID),
      ManagerID: Number(ManagerID),
      ClientProjNum: ClientProjNum.trim(),
      ProjNum: ProjNum.trim(),
      ProjName: ProjName.trim(),
      ProjDesc: (ProjDesc || "").trim(),
      StartDate, // yyyy-mm-dd
      EndDate: EndDate || null,
    };

    const url = isEdit
      ? `/api/backend/settings/projects/${initial!.ProjectID}`
      : `/api/backend/settings/projects`;
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
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl space-y-3">
        <h2 className="text-xl font-semibold">{isEdit ? "Edit Project" : "New Project"}</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col">
            Client * <select
              className="border rounded px-2 py-1"
              value={ClientID}
              onChange={(e) => setClientID(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">— Select Client —</option>
              {clients.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Manager * <select
              className="border rounded px-2 py-1"
              value={ManagerID}
              onChange={(e) => setManagerID(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">— Select Manager —</option>
              {managers.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col">
            Client Proj # * (max 15) <input
              className="border rounded px-2 py-1"
              value={ClientProjNum}
              onChange={(e) => setClientProjNum(e.target.value)}
            />
          </label>
          <label className="flex flex-col">
            Project # * (max 15) <input
              className="border rounded px-2 py-1"
              value={ProjNum}
              onChange={(e) => setProjNum(e.target.value)}
            />
          </label>
          <label className="flex flex-col col-span-2">
            Project Name * (max 255) <input
              className="border rounded px-2 py-1"
              value={ProjName}
              onChange={(e) => setProjName(e.target.value)}
            />
          </label>
          <label className="flex flex-col col-span-2">
            Description (max 255) <input
              className="border rounded px-2 py-1"
              value={ProjDesc}
              onChange={(e) => setProjDesc(e.target.value)}
            />
          </label>
          <label className="flex flex-col">
            Start Date * <input
              type="date"
              className="border rounded px-2 py-1"
              value={StartDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col">
            End Date <input
              type="date"
              className="border rounded px-2 py-1"
              value={EndDate}
              onChange={(e) => setEndDate(e.target.value)}
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
