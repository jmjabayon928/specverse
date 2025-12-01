// src/app/(admin)/datasheets/filled/[id]/notes/new/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

// Adjust if your endpoints differ
const NOTE_TYPES_ENDPOINT = "/api/backend/templates/note-types";
const CREATE_NOTE_ENDPOINT = (sheetId: number) =>
  `/api/backend/filledsheets/${sheetId}/notes`;
const SHEET_DETAILS_ENDPOINT = (sheetId: number) =>
  `/api/backend/filledsheets/${sheetId}?lang=eng`;

type NoteType = {
  noteTypeId: number;
  noteType: string;
  description?: string | null;
};

type MinimalSheetHeader = {
  sheetName?: string | null;
  equipmentTagNum?: string | number | null;
};

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export default function NewFilledNotePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const sheetId = useMemo(() => Number(params?.id), [params?.id]);

  const [noteTypes, setNoteTypes] = useState<NoteType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Header info (sheet name & equipment tag)
  const [header, setHeader] = useState<MinimalSheetHeader | null>(null);
  const [headerLoading, setHeaderLoading] = useState<boolean>(false);

  // Form state
  const [noteTypeId, setNoteTypeId] = useState<number | "">("");
  const [body, setBody] = useState<string>("");

  // Optional return path (?returnTo=/datasheets/filled/16)
  const returnTo =
    searchParams?.get("returnTo") ||
    (isPositiveInt(sheetId) ? `/datasheets/filled/${sheetId}` : "/datasheets/filled");

  // Load NoteTypes
  useEffect(() => {
    let abort = false;
    (async () => {
      try {
        setLoadingTypes(true);
        setError(null);
        const res = await fetch(NOTE_TYPES_ENDPOINT, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to load note types (${res.status})`);
        const data: NoteType[] = await res.json();
        if (!abort) {
          setNoteTypes(Array.isArray(data) ? data : []);
          setLoadingTypes(false);
        }
      } catch (e) {
        if (!abort) {
          setError(e instanceof Error ? e.message : "Failed to load note types");
          setLoadingTypes(false);
        }
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // Load minimal header (sheet name & equipment tag)
  useEffect(() => {
    let abort = false;
    if (!isPositiveInt(sheetId)) return;

    (async () => {
      try {
        setHeaderLoading(true);
        const res = await fetch(SHEET_DETAILS_ENDPOINT(sheetId), {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load sheet (${res.status})`);
        const json = await res.json();
        const ds = json?.datasheet ?? json;
        if (!abort) {
          setHeader({
            sheetName: ds?.sheetName ?? null,
            equipmentTagNum: ds?.equipmentTagNum ?? null,
          });
        }
      } catch {
        if (!abort) setHeader(null); // non-fatal
      } finally {
        if (!abort) setHeaderLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [sheetId]);

  const canSubmit =
    isPositiveInt(sheetId) &&
    isPositiveInt(typeof noteTypeId === "number" ? noteTypeId : Number.NaN) &&
    body.trim().length > 0 &&
    !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    try {
      setSaving(true);
      setError(null);

      const payload = {
        noteTypeId: noteTypeId as number,
        text: body.trim(), // orderIndex is assigned server-side (MAX+1)
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
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "Failed to create note");
    }
  }

  function handleCancel() {
    router.push(returnTo);
  }

  // ---------- Lint fixes ----------
  const sheetName = header?.sheetName ?? null;

  const headerTitle = useMemo(() => {
    if (headerLoading) return "Loading…";
    const trimmed = sheetName?.trim();
    if (trimmed) return trimmed;
    if (isPositiveInt(sheetId)) return `Sheet #${sheetId}`;
    return "Create Note";
  }, [headerLoading, sheetName, sheetId]);
  // --------------------------------

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Big header: Sheet Name + Equipment Tag */}
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">
          {headerTitle}
        </h1>
        <p className="text-base md:text-lg text-gray-700">
          {header?.equipmentTagNum ? `Equipment Tag: ${header.equipmentTagNum}` : null}
        </p>
        <p className="text-sm text-gray-600">
          {isPositiveInt(sheetId) && !header?.sheetName ? (
            <>
              Filled sheet ID: <span className="font-mono">{sheetId}</span>
            </>
          ) : (
            "Create Note"
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Note Type */}
        <div>
          <label
            htmlFor="noteType"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Note Type <span className="text-red-500">*</span>
          </label>
          {loadingTypes ? (
            <div className="text-sm text-gray-500">Loading note types…</div>
          ) : (
            <select
              id="noteType"
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

        {/* Body */}
        <div>
          <label
            htmlFor="noteBody"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
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
            This note will be appended to the end of its note-type group automatically.
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
