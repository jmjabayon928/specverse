// src/app/(admin)/datasheets/templates/[id]/notes/new/page.tsx
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// If your NoteTypes endpoint lives elsewhere, tweak this:
const NOTE_TYPES_ENDPOINT = "/api/backend/templates/note-types";

// Template endpoints
const SHEET_DETAILS_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}?lang=eng`;

const CREATE_NOTE_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}/notes`;

type NoteType = {
  noteTypeId: number;
  noteType: string;
  description?: string | null;
};

type MinimalSheetHeader = {
  sheetName?: string | null;
  equipmentTagNum?: string | number | null;
};

function isPositiveInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x > 0;
}

export default function NewTemplateNotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const sheetId = React.useMemo(() => Number(params?.id), [params?.id]);

  // header info
  const [header, setHeader] = React.useState<MinimalSheetHeader | null>(null);
  const [headerLoading, setHeaderLoading] = React.useState(false);

  // form data
  const [noteTypes, setNoteTypes] = React.useState<NoteType[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(true);
  const [noteTypeId, setNoteTypeId] = React.useState<number | "">("");
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const returnTo =
    searchParams?.get("returnTo") ||
    (isPositiveInt(sheetId) ? `/datasheets/templates/${sheetId}` : "/datasheets/templates");

  const canSubmit =
    isPositiveInt(sheetId) &&
    typeof noteTypeId === "number" &&
    noteTypeId > 0 &&
    body.trim().length > 0 &&
    !saving;

  // Load Note Types
  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoadingTypes(true);
        setError(null);
        const res = await fetch(NOTE_TYPES_ENDPOINT, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load note types (${res.status})`);
        const list: NoteType[] = await res.json();
        if (!cancel) setNoteTypes(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to load note types");
      } finally {
        if (!cancel) setLoadingTypes(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // Load template header (name + tag)
  React.useEffect(() => {
    let cancel = false;
    if (!isPositiveInt(sheetId)) return;
    (async () => {
      try {
        setHeaderLoading(true);
        const res = await fetch(SHEET_DETAILS_ENDPOINT(sheetId), {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load template (${res.status})`);
        const json = await res.json();
        const ds = json?.datasheet ?? json; // support either shape
        if (!cancel) {
          setHeader({
            sheetName: ds?.sheetName ?? null,
            equipmentTagNum: ds?.equipmentTagNum ?? null,
          });
        }
      } catch {
        if (!cancel) setHeader(null);
      } finally {
        if (!cancel) setHeaderLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [sheetId]);

  function getHeaderTitle(): string {
    if (headerLoading) return "Loading…";
    if (header?.sheetName?.trim()) return header.sheetName;
    if (isPositiveInt(sheetId)) return `Template #${sheetId}`;
    return "Create Note";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    // Narrow to remove the unnecessary assertion
    if (typeof noteTypeId !== "number" || noteTypeId <= 0) return;

    try {
      setSaving(true);
      setError(null);

      const payload = {
        noteTypeId,                 // already narrowed above
        text: body.trim(),          // orderIndex handled server-side (MAX+1 per noteType)
      };

      const res = await fetch(CREATE_NOTE_ENDPOINT(sheetId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to create note (${res.status})`);
      }

      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to create note");
    }
  }

  function handleCancel() {
    router.push(returnTo);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Big Header */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
          {getHeaderTitle()}
        </h1>
        <p className="text-base md:text-lg text-gray-700">
          {header?.equipmentTagNum ? `Equipment Tag: ${header.equipmentTagNum}` : null}
        </p>
        <p className="text-sm text-gray-600">
          {isPositiveInt(sheetId) && !header?.sheetName ? (
            <>Template ID: <span className="font-mono">{sheetId}</span></>
          ) : (
            "Create Note"
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Note Type */}
        <div>
          <label htmlFor="noteTypeSelect" className="block text-sm font-medium text-gray-700 mb-1">
            Note Type <span className="text-red-500">*</span>
          </label>
          {loadingTypes ? (
            <div className="text-sm text-gray-500">Loading note types…</div>
          ) : (
            <select
              id="noteTypeSelect"
              className="w-full rounded border px-3 py-2 text-sm"
              title="Select a note type"
              value={noteTypeId}
              onChange={(e) => {
                const v = e.target.value;
                setNoteTypeId(v ? Number(v) : "");
              }}
              required
            >
              <option value="">Select a note type…</option>
              {noteTypes.map((nt) => (
                <option key={nt.noteTypeId} value={nt.noteTypeId}>
                  {nt.noteType}
                </option>
              ))}
            </select>
          )}
          {!loadingTypes && noteTypes.length === 0 && (
            <div className="text-xs text-amber-600 mt-1">
              No note types available. Please add NoteTypes first.
            </div>
          )}
        </div>

        {/* Note Body */}
        <div>
          <label htmlFor="noteBody" className="block text-sm font-medium text-gray-700 mb-1">
            Note Text <span className="text-red-500">*</span>
          </label>
          <textarea
            id="noteBody"
            className="w-full min-h-[160px] rounded border px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter the note body…"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            This note will be added at the end of its note-type group automatically.
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Note"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center rounded border px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
