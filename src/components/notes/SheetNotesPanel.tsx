// src/components/notes/SheetNotesPanel.tsx
"use client";

import * as React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import Badge from "@/components/ui/badge/Badge";
import { Separator } from "@/components/ui/separator";
import styles from "./SheetNotesPanel.module.css";

type SheetNoteDTO = {
  NoteID: number;
  SheetID: number;
  NoteTypeID: number;
  NoteType?: string;
  NoteText: string;
  OrderIndex: number;
  CreatedAt?: string;
  UpdatedAt?: string | null;
};

type NotePermissions = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type NoteTypeDTO = {
  NoteTypeID: number;
  NoteType: string;
  Description?: string | null;
};

interface SheetNotesPanelProps {
  sheetId: number;
  className?: string;
  initialNotes?: SheetNoteDTO[];
  endpoint?: (sheetId: number) => string;
  permissions?: NotePermissions;
}

export default function SheetNotesPanel({
  sheetId,
  className,
  initialNotes,
  endpoint = (id) => `/api/backend/sheets/${id}/notes`,
  permissions = { canCreate: false, canEdit: false, canDelete: false },
}: SheetNotesPanelProps) {
  const [notes, setNotes] = React.useState<SheetNoteDTO[] | null>(initialNotes ?? null);
  const [loading, setLoading] = React.useState(!initialNotes);
  const [error, setError] = React.useState<string | null>(null);

  // Inline form state (add/edit)
  const [showAdd, setShowAdd] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);

  // Form fields
  const [formTypeId, setFormTypeId] = React.useState<number>(0);
  const [formText, setFormText] = React.useState<string>("");
  const [formOrder, setFormOrder] = React.useState<number>(0);

  // 🔹 NEW: NoteTypes state
  const [noteTypes, setNoteTypes] = React.useState<NoteTypeDTO[] | null>(null);
  const [loadingTypes, setLoadingTypes] = React.useState<boolean>(true);
  const [typesError, setTypesError] = React.useState<string | null>(null);

  // Fetch when no initial notes
  React.useEffect(() => {
    if (initialNotes) return; // server-provided
    const abort = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(endpoint(sheetId), {
          signal: abort.signal,
          credentials: "include",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load notes (${res.status})`);
        const data: SheetNoteDTO[] = await res.json();
        data.sort((a, b) =>
          (a.NoteType ?? String(a.NoteTypeID)).localeCompare(b.NoteType ?? String(b.NoteTypeID)) ||
          a.OrderIndex - b.OrderIndex
        );
        setNotes(data);
      } catch (e: unknown) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Failed to load notes");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [sheetId, endpoint, initialNotes]);

  // 🔹 NEW: Fetch NoteTypes from backend
  React.useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        setLoadingTypes(true);
        setTypesError(null);
        const res = await fetch("/api/backend/note-types", {
          signal: abort.signal,
          credentials: "include",
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Failed to load note types (${res.status})`);
        const data: NoteTypeDTO[] = await res.json();
        setNoteTypes(data);
      } catch (e: unknown) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setTypesError("Failed to load note types.");
        }
      } finally {
        setLoadingTypes(false);
      }
    })();
    return () => abort.abort();
  }, []);

  const groups = groupByType(notes ?? []);

  function resetForm() {
    setFormTypeId(0);
    setFormText("");
    setFormOrder(0);
  }

  function beginAdd() {
    setEditingId(null);
    resetForm();
    // 🔹 Prefer first NoteType from server; fall back to first group's type if available
    const firstTypeFromServer = noteTypes?.[0]?.NoteTypeID;
    if (typeof firstTypeFromServer === "number") {
      setFormTypeId(firstTypeFromServer);
    } else {
      const firstTypeFromGroups = groups[0]?.items[0]?.NoteTypeID;
      if (typeof firstTypeFromGroups === "number") setFormTypeId(firstTypeFromGroups);
    }
    setShowAdd(true);
  }

  function beginEdit(n: SheetNoteDTO) {
    setEditingId(n.NoteID);
    setFormTypeId(n.NoteTypeID);
    setFormText(n.NoteText);
    setFormOrder(n.OrderIndex);
    setShowAdd(false);
  }

  async function handleCreate() {
    // minimal validation
    if (!formTypeId || !formText.trim()) return;
    const res = await fetch(endpoint(sheetId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        noteTypeId: formTypeId,
        noteText: formText.trim(),
        orderIndex: Number.isFinite(formOrder) ? formOrder : 0,
      }),
    });
    if (!res.ok) {
      const msg = await safeErr(res);
      setError(msg);
      return;
    }
    const created: SheetNoteDTO = await res.json();
    setNotes((prev) => (prev ? sortNotes([...prev, created]) : [created]));
    setShowAdd(false);
    resetForm();
  }

  async function handleUpdate(id: number) {
    if (!formText.trim()) return;
    const res = await fetch(`${endpoint(sheetId)}/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        noteTypeId: formTypeId,
        noteText: formText.trim(),
        orderIndex: Number.isFinite(formOrder) ? formOrder : undefined,
      }),
    });
    if (!res.ok) {
      const msg = await safeErr(res);
      setError(msg);
      return;
    }
    const updated: SheetNoteDTO = await res.json();
    setNotes((prev) => (prev ? sortNotes(prev.map((n) => (n.NoteID === id ? updated : n))) : [updated]));
    setEditingId(null);
    resetForm();
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Delete this note?");
    if (!ok) return;
    const res = await fetch(`${endpoint(sheetId)}/${id}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const msg = await safeErr(res);
      setError(msg);
      return;
    }
    setNotes((prev) => (prev ? prev.filter((n) => n.NoteID !== id) : prev));
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader><div className="h-6 w-40 animate-pulse rounded bg-muted" /></CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-12 w-full animate-pulse rounded bg-muted" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <h3 className="text-lg font-semibold">Notes</h3>
        <p className="text-sm text-muted-foreground">Notes are visible to designers; not translated.</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">Error: {error}</p>}
        {typesError && <p className="text-xs text-warning-600">{typesError}</p>}

        {/* groups */}
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          groups.map((g, gi) => (
            <div key={gi} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="light" color="dark" size="sm">{g.typeLabel}</Badge>
                <span className="text-xs text-muted-foreground">
                  {g.items.length} {g.items.length === 1 ? "note" : "notes"}
                </span>
              </div>
              <Separator />
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className={styles.colActions} />
                  <col className={styles.colNote} />
                </colgroup>

                <tbody>
                  {g.items.map((n) => {
                    const isEditing = editingId === n.NoteID;
                    return (
                      <tr key={n.NoteID} className="align-top">
                        {/* Icons column (10%) */}
                        <td className="w-[10%] p-0">
                          <div className="flex items-start gap-1">
                            <button
                              type="button"
                              onClick={() => (permissions.canEdit ? beginEdit(n) : undefined)}
                              disabled={!permissions.canEdit}
                              title={permissions.canEdit ? "Edit Note" : "Cannot Edit"}
                              className={`p-1 rounded transition ${
                                permissions.canEdit
                                  ? "text-blue-600 hover:bg-blue-50"
                                  : "text-gray-400 cursor-not-allowed"
                              }`}
                              aria-label={permissions.canEdit ? "Edit Note" : "Cannot Edit"}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => (permissions.canDelete ? handleDelete(n.NoteID) : undefined)}
                              disabled={!permissions.canDelete}
                              title={permissions.canDelete ? "Delete Note" : "Cannot Delete"}
                              className={`p-1 rounded transition ${
                                permissions.canDelete
                                  ? "text-red-600 hover:bg-red-50"
                                  : "text-gray-400 cursor-not-allowed"
                              }`}
                              aria-label={permissions.canDelete ? "Delete Note" : "Cannot Delete"}
                            >
                              🗑️
                            </button>
                          </div>
                        </td>

                        {/* Note content column (90%) */}
                        <td className="w-[90%] p-0">
                          <div className="whitespace-pre-wrap leading-relaxed text-gray-900">
                            {isEditing ? (
                              <EditForm
                                valueText={formText}
                                onChangeText={setFormText}
                                valueTypeId={formTypeId}
                                onChangeTypeId={setFormTypeId}
                                valueOrder={formOrder}
                                onChangeOrder={setFormOrder}
                                onCancel={() => {
                                  setEditingId(null);
                                  resetForm();
                                }}
                                onSave={() => handleUpdate(n.NoteID)}
                                // 🔹 Prefer server NoteTypes; fall back to derived-from-notes
                                typeOptions={
                                  noteTypes?.length
                                    ? noteTypes.map((t) => ({ id: t.NoteTypeID, label: t.NoteType }))
                                    : deriveTypeOptions(notes ?? [])
                                }
                              />
                            ) : (
                              n.NoteText
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))
        )}

        {/* Add form + button */}
        {permissions.canCreate && !showAdd && (
          <div className="pt-2">
            <button
              type="button"
              onClick={beginAdd}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
              title="Add Note"
              disabled={loadingTypes && !noteTypes?.length}
            >
              ＋ Add Note
            </button>
          </div>
        )}

        {permissions.canCreate && showAdd && (
          <div className="rounded-md border p-3 bg-gray-50">
            <EditForm
              valueText={formText}
              onChangeText={setFormText}
              valueTypeId={formTypeId}
              onChangeTypeId={(v) => setFormTypeId(v)}
              valueOrder={formOrder}
              onChangeOrder={(v) => setFormOrder(v)}
              onCancel={() => { setShowAdd(false); resetForm(); }}
              onSave={handleCreate}
              // 🔹 Prefer server NoteTypes; fall back to derived-from-notes
              typeOptions={
                noteTypes?.length
                  ? noteTypes.map((t) => ({ id: t.NoteTypeID, label: t.NoteType }))
                  : deriveTypeOptions(notes ?? [])
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- small helpers & child form ---------- */

function groupByType(notes: SheetNoteDTO[]) {
  const by: Record<string, SheetNoteDTO[]> = {};
  for (const n of notes) {
    const key = n.NoteType ?? String(n.NoteTypeID);
    (by[key] ||= []).push(n);
  }
  const groups = Object.entries(by).map(([typeLabel, items]) => {
    items.sort((a, b) => a.OrderIndex - b.OrderIndex);
    return { typeLabel, items };
  });
  groups.sort((a, b) => a.typeLabel.localeCompare(b.typeLabel));
  return groups;
}

function sortNotes(list: SheetNoteDTO[]) {
  return [...list].sort((a, b) =>
    (a.NoteType ?? String(a.NoteTypeID)).localeCompare(b.NoteType ?? String(b.NoteTypeID)) ||
    a.OrderIndex - b.OrderIndex ||
    a.NoteID - b.NoteID
  );
}

function deriveTypeOptions(notes: SheetNoteDTO[]): Array<{ id: number; label: string }> {
  const seen = new Map<number, string>();
  for (const n of notes) {
    if (!seen.has(n.NoteTypeID)) seen.set(n.NoteTypeID, n.NoteType ?? String(n.NoteTypeID));
  }
  // fallback if empty: a generic default
  if (seen.size === 0) return [{ id: 1, label: "General Notes" }];
  return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
}

async function safeErr(res: Response): Promise<string> {
  try {
    const t = await res.text();
    if (!t) return `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(t) as { error?: string };
      return j.error ?? t;
    } catch {
      return t;
    }
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

function EditForm(props: {
  valueText: string;
  onChangeText: (v: string) => void;
  valueTypeId: number;
  onChangeTypeId: (v: number) => void;
  valueOrder: number;
  onChangeOrder: (v: number) => void;
  onCancel: () => void;
  onSave: () => void;
  typeOptions: Array<{ id: number; label: string }>;
}) {
  const {
    valueText, onChangeText,
    valueTypeId, onChangeTypeId,
    valueOrder, onChangeOrder,
    onCancel, onSave,
    typeOptions,
  } = props;

  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
      <div className="flex flex-wrap gap-2">
        <select
          value={valueTypeId}
          onChange={(e) => onChangeTypeId(Number(e.target.value))}
          className="rounded border px-2 py-1"
          title="Note Type"
        >
          {typeOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <input
          type="number"
          value={valueOrder}
          onChange={(e) => onChangeOrder(Number(e.target.value))}
          className="w-24 rounded border px-2 py-1"
          title="Order"
          placeholder="Order"
        />
      </div>
      <textarea
        value={valueText}
        onChange={(e) => onChangeText(e.target.value)}
        className="w-full rounded border px-2 py-1"
        rows={3}
        placeholder="Enter note text…"
      />
      <div className="flex gap-2">
        <button type="submit" className="rounded-md bg-green-600 px-3 py-1.5 text-white hover:bg-green-700">Save</button>
        <button type="button" onClick={onCancel} className="rounded-md bg-gray-200 px-3 py-1.5 hover:bg-gray-300">Cancel</button>
      </div>
    </form>
  );
}
