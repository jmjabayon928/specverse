// src/app/(admin)/datasheets/layouts/LayoutsIndexClient.tsx
"use client";

import React from "react";

type PaperSize = "A4" | "Letter";
type Orientation = "portrait" | "landscape";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000";

interface LayoutListRow {
  layoutId: number;
  templateId: number | null;
  clientId: number | null;
  paperSize: PaperSize;
  orientation: Orientation;
  version: number;
  isDefault: boolean;
}

function isFiniteInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}
function toNumber(val: unknown): number | undefined {
  if (isFiniteInt(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}
function toStringNZ(val: unknown): string | undefined {
  return typeof val === "string" && val.trim() !== "" ? val : undefined;
}
function isPaperSize(s: unknown): s is PaperSize {
  return s === "A4" || s === "Letter";
}
function isOrientation(s: unknown): s is Orientation {
  return s === "portrait" || s === "landscape";
}

function readNumber(rec: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = toNumber(rec[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}
function readString(rec: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = toStringNZ(rec[k]);
    if (v !== undefined) return v;
  }
  return undefined;
}

function mapRow(rec: Record<string, unknown>): LayoutListRow | null {
  const layoutId =
    readNumber(rec, ["LayoutID", "layoutId"]);
  if (layoutId === undefined) return null;

  const templateId =
    readNumber(rec, ["TemplateID", "templateId"]) ?? null;

  const clientId =
    readNumber(rec, ["ClientID", "clientId"]) ?? null;

  const paperStr = readString(rec, ["PaperSize", "paperSize"]);
  const paperSize: PaperSize = isPaperSize(paperStr) ? paperStr : "A4";

  const orientStr = readString(rec, ["Orientation", "orientation"]);
  const orientation: Orientation = isOrientation(orientStr) ? orientStr : "portrait";

  const version =
    readNumber(rec, ["Version", "version"]) ?? 1;

  let isDefault = false;
  if (typeof rec["IsDefault"] === "boolean") isDefault = rec["IsDefault"];
  else if (typeof rec["isDefault"] === "boolean") isDefault = rec["isDefault"];

  return {
    layoutId,
    templateId,
    clientId,
    paperSize,
    orientation,
    version,
    isDefault,
  };
}

function parseRows(raw: unknown): LayoutListRow[] {
  const arr = Array.isArray(raw) ? (raw as unknown[]) : [];
  const out: LayoutListRow[] = [];
  for (const item of arr) {
    const rec = (item ?? {}) as Record<string, unknown>;
    const row = mapRow(rec);
    if (row) out.push(row);
  }
  return out;
}

export default function LayoutsIndexClient() {
  const [rows, setRows] = React.useState<LayoutListRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  // New layout form state
  const [newTemplateId, setNewTemplateId] = React.useState<string>("");
  const [newClientId, setNewClientId] = React.useState<string>("");
  const [newPaper, setNewPaper] = React.useState<PaperSize>("A4");
  const [newOrientation, setNewOrientation] = React.useState<Orientation>("portrait");
  const [creating, setCreating] = React.useState<boolean>(false);

  async function fetchRows() {
    try {
      setLoading(true);
      setError(null);
      const r = await fetch(`${API_BASE}/api/backend/layouts`, { credentials: "include" });
      if (!r.ok) {
        setRows([]);
        setError(`Failed to load layouts (${r.status})`);
        return;
      }
      const data = (await r.json()) as unknown;
      setRows(parseRows(data));
    } catch {
      setRows([]);
      setError("Failed to load layouts.");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void fetchRows();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const tmpl = Number(newTemplateId);
    const client = newClientId.trim() === "" ? null : Number(newClientId);

    if (!Number.isFinite(tmpl) || tmpl <= 0) {
      setError("Template ID must be a positive number.");
      return;
    }

    try {
      setCreating(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/backend/layouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          templateId: tmpl,
          clientId: client,
          paperSize: newPaper,
          orientation: newOrientation,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { layoutId?: number };
      if (!res.ok || typeof json.layoutId !== "number") {
        setError("Failed to create layout.");
        return;
      }
      await fetchRows();
      setNewTemplateId("");
      setNewClientId("");
      setNewPaper("A4");
      setNewOrientation("portrait");
    } catch {
      setError("Failed to create layout.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm(`Delete layout #${id}? This cannot be undone.`);
    if (!ok) return;
    try {
      const res = await fetch(`${API_BASE}/api/backend/layouts/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        setError(`Failed to delete layout #${id}`);
        return;
      }
      setRows((prev) => prev.filter((r) => r.layoutId !== id));
    } catch {
      setError(`Failed to delete layout #${id}`);
    }
  }

  function groupByTemplate(list: LayoutListRow[]): Map<number | null, LayoutListRow[]> {
    const m = new Map<number | null, LayoutListRow[]>();
    for (const r of list) {
      const key = r.templateId ?? null;
      const grp = m.get(key);
      if (grp) grp.push(r);
      else m.set(key, [r]);
    }
    return m;
  }

  const grouped = React.useMemo(() => groupByTemplate(rows), [rows]);

  let content: React.ReactNode;
  if (loading) {
    content = <div>Loading layouts…</div>;
  } else if (rows.length === 0) {
    content = <div className="text-gray-600">No layouts yet. Create one above.</div>;
  } else {
    const sections: React.ReactNode[] = [];
    for (const [tmpl, list] of grouped.entries()) {
      sections.push(
        <section key={`tmpl-${tmpl ?? "null"}`} className="border rounded">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <div className="font-medium">
              Template: {tmpl !== null ? `#${tmpl}` : "—"}
            </div>
            <div className="text-sm text-gray-600">
              {list.length} {list.length === 1 ? "layout" : "layouts"}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left bg-gray-50">
                <tr>
                  <th className="px-4 py-2">LayoutID</th>
                  <th className="px-4 py-2">ClientID</th>
                  <th className="px-4 py-2">Paper</th>
                  <th className="px-4 py-2">Orientation</th>
                  <th className="px-4 py-2">Version</th>
                  <th className="px-4 py-2">Default</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={`row-${r.layoutId}`} className="border-t">
                    <td className="px-4 py-2 font-mono">#{r.layoutId}</td>
                    <td className="px-4 py-2">{r.clientId ?? "—"}</td>
                    <td className="px-4 py-2">{r.paperSize}</td>
                    <td className="px-4 py-2">{r.orientation}</td>
                    <td className="px-4 py-2">{r.version}</td>
                    <td className="px-4 py-2">{r.isDefault ? "Yes" : "No"}</td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`/datasheets/layouts/${r.layoutId}`}
                          className="rounded border px-2 py-1"
                        >
                          Details
                        </a>
                        <a
                          href={`/datasheets/layouts/${r.layoutId}/builder`}
                          className="rounded border px-2 py-1"
                        >
                          Open Builder
                        </a>
                        <button
                          type="button"
                          className="rounded border px-2 py-1 text-red-700"
                          onClick={() => void handleDelete(r.layoutId)}
                          aria-label={`Delete layout ${r.layoutId}`}
                          title="Delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );
    }
    content = <>{sections}</>;
  }

  return (
    <div className="space-y-8">
      {/* Create New Layout */}
      <section aria-labelledby="create-layout-heading" className="border rounded p-4">
        <h2 id="create-layout-heading" className="text-lg font-semibold mb-3">
          New Layout
        </h2>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-1">
              Template (SheetID) *
            </label>
            <input
              id="templateId"
              type="number"
              value={newTemplateId}
              onChange={(e) => setNewTemplateId(e.target.value)}
              className="w-full rounded border px-3 py-2"
              min={1}
              required
            />
          </div>
          <div>
            <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 mb-1">
              Client ID (optional)
            </label>
            <input
              id="clientId"
              type="number"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              className="w-full rounded border px-3 py-2"
              min={1}
            />
          </div>
          <div>
            <label htmlFor="paper" className="block text-sm font-medium text-gray-700 mb-1">
              Paper
            </label>
            <select
              id="paper"
              value={newPaper}
              onChange={(e) => setNewPaper(e.target.value as PaperSize)}
              className="w-full rounded border px-3 py-2"
              aria-label="Paper size"
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>
          <div>
            <label htmlFor="orientation" className="block text-sm font-medium text-gray-700 mb-1">
              Orientation
            </label>
            <select
              id="orientation"
              value={newOrientation}
              onChange={(e) => setNewOrientation(e.target.value as Orientation)}
              className="w-full rounded border px-3 py-2"
              aria-label="Orientation"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
              disabled={creating}
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2"
              onClick={() => {
                setNewTemplateId("");
                setNewClientId("");
                setNewPaper("A4");
                setNewOrientation("portrait");
              }}
            >
              Reset
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {/* Layouts grouped by Template */}
      {content}
    </div>
  );
}
