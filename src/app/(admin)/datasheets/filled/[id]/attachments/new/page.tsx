// src/app/(admin)/datasheets/filled/[id]/attachments/new/page.tsx
"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const CREATE_ATTACHMENT_ENDPOINT = (sheetId: number) =>
  `/api/backend/filledsheets/${sheetId}/attachments`;

const SHEET_DETAILS_ENDPOINT = (sheetId: number) =>
  `/api/backend/filledsheets/${sheetId}?lang=eng`;

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB – adjust to your backend limit
const ACCEPT =
  "image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.dwg,.dxf,.svg";

function isPositiveInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && x > 0;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

type MinimalSheetHeader = {
  sheetName?: string | null;
  equipmentTagNum?: string | number | null;
};

export default function NewFilledAttachmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const sheetId = React.useMemo(() => Number(params?.id), [params?.id]);

  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // header data
  const [header, setHeader] = React.useState<MinimalSheetHeader | null>(null);
  const [headerLoading, setHeaderLoading] = React.useState<boolean>(false);

  const returnTo =
    searchParams?.get("returnTo") ||
    (isPositiveInt(sheetId) ? `/datasheets/filled/${sheetId}` : "/datasheets/filled");

  const tooLarge = file ? file.size > MAX_BYTES : false;
  const canSubmit = isPositiveInt(sheetId) && !!file && !tooLarge && !saving;

  // Load minimal sheet header info (name & tag)
  React.useEffect(() => {
    let abort = false;
    if (!isPositiveInt(sheetId)) return;

    (async () => {
      try {
        setHeaderLoading(true);
        setError(null);
        const res = await fetch(SHEET_DETAILS_ENDPOINT(sheetId), {
          credentials: "include",
        });
        if (!res.ok) throw new Error(`Failed to load sheet (${res.status})`);
        const data = await res.json();
        const ds = data?.datasheet ?? data; // support either { datasheet, translations } or plain
        if (!abort) {
          setHeader({
            sheetName: ds?.sheetName ?? null,
            equipmentTagNum: ds?.equipmentTagNum ?? null,
          });
        }
      } catch (e) {
        if (!abort) {
          // Non-fatal for the page; we’ll just fallback to the ID
          console.warn("Sheet header fetch failed:", e);
          setHeader(null);
        }
      } finally {
        if (!abort) setHeaderLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [sheetId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !file) return;

    try {
      setSaving(true);
      setError(null);

      const fd = new FormData();
      fd.append("file", file); // backend reads field: "file"

      const res = await fetch(CREATE_ATTACHMENT_ENDPOINT(sheetId), {
        method: "POST",
        credentials: "include",
        body: fd, // do not set Content-Type manually
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 413) throw new Error("File too large (payload limit).");
        if (res.status === 415) throw new Error("Unsupported file type.");
        throw new Error(text || `Failed to upload attachment (${res.status}).`);
      }

      router.push(returnTo);
      router.refresh();
    } catch (err) {
      setSaving(false);
      setError(err instanceof Error ? err.message : "Failed to upload attachment.");
    }
  }

  function handleCancel() {
    router.push(returnTo);
  }

  // ---------- Lint fixes ----------
  const sheetName = header?.sheetName ?? null;
  const headerTitle = React.useMemo(() => {
    if (headerLoading) return "Loading…";
    const trimmed = sheetName?.trim();
    if (trimmed) return trimmed;
    if (isPositiveInt(sheetId)) return `Sheet #${sheetId}`;
    return "Add Attachment";
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
          {header?.equipmentTagNum
            ? `Equipment Tag: ${header.equipmentTagNum}`
            : null}
        </p>
        {/* Small subtitle */}
        <p className="text-sm text-gray-600">
          {isPositiveInt(sheetId) && !header?.sheetName ? (
            <>
              Filled sheet ID: <span className="font-mono">{sheetId}</span>
            </>
          ) : (
            "Add Attachment"
          )}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File picker */}
        <div>
          <label
            htmlFor="attachmentFile"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            File <span className="text-red-500">*</span>
          </label>
          <input
            id="attachmentFile"
            type="file"
            title="Select file to upload"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-900 file:mr-3 file:rounded file:border file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-gray-50 file:hover:bg-gray-100"
            required
          />
          <div className="mt-2 text-xs text-gray-600 space-y-1">
            <div>Allowed: images, PDF, Office docs, CSV/TXT/ZIP, CAD (DWG/DXF), SVG.</div>
            <div>Max size: {formatBytes(MAX_BYTES)}.</div>
            {file && (
              <div className={tooLarge ? "text-red-600" : "text-gray-600"}>
                Selected: <strong>{file.name}</strong> ({formatBytes(file.size)})
              </div>
            )}
          </div>
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
            {saving ? "Uploading…" : "Upload"}
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
