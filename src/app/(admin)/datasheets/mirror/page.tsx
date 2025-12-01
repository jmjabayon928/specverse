// src/app/(admin)/datasheets/mirror/page.tsx
"use client";

import React, { useCallback, useMemo, useState } from "react";

/* ----------------------------- types ----------------------------- */
type Bucket = "sheet" | "equipment" | "subsheet" | "templateField";

type FieldType = "string" | "number" | "enum" | "bool" | "date";

type RegionBBox = [number, number, number, number];

type Region = { name: string; bbox: RegionBBox };

type FieldDef = {
  key: string;
  label: string;
  bbox: [number, number, number, number];
  type: FieldType;
  options?: string[];
  mapTo: { bucket: Bucket; subsheetName?: string; infoTemplateId?: number };
};

type SheetDefinitionJSON = {
  id: string;
  clientKey: string;
  sourceKind: "xlsx";
  fingerprint: {
    pageSize: { w: number; h: number };
    anchors: Array<{ text: string; bbox: [number, number, number, number] }>;
    gridHash: string;
    labelSet: string[];
  };
  regions: {
    header: Region;
    equipment: Region;
    subsheets: Region[];
  };
  fields: FieldDef[];
  renderHints: {
    font: string;
    baseLineHeight: number;
    tableBorders: Array<{ path: [number, number][]; weight: number }>;
    exactPlacement: boolean;
  };
};

type LearnResponse = {
  draftDefinition: SheetDefinitionJSON;
  detectedFields: Array<{ label: string; address: string }>;
};

type ApplyResponse = { ok: true; fileName: string; downloadPath: string };

type Stage = "upload" | "confirm" | "apply";

/* ----------------------------- helpers ----------------------------- */

function authHeaders(extra?: HeadersInit): HeadersInit {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  return {
    ...(extra ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} ${detail}`);
  }
  return (await res.json()) as T;
}

/* ----------------------------- page ----------------------------- */

export default function MirrorPage() {
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [learn, setLearn] = useState<LearnResponse | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const def: SheetDefinitionJSON | null = learn?.draftDefinition ?? null;
  const fieldList = useMemo(() => def?.fields ?? [], [def]);

  const onUploadExcel = useCallback(async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/mirror/templates/excel/learn", {
        method: "POST",
        headers: authHeaders(),
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as LearnResponse;
      setLearn(data);
      setStage("confirm");
    } catch (e) {
      setError((e as Error).message || "Learn failed");
    } finally {
      setBusy(false);
    }
  }, [file]);

  const onConfirmTemplate = useCallback(async () => {
    if (!def) return;
    setBusy(true);
    setError("");
    try {
      await postJSON("/api/mirror/templates/confirm", def);
      setStage("apply");
    } catch (e) {
      setError((e as Error).message || "Confirm failed");
    } finally {
      setBusy(false);
    }
  }, [def]);

  const onApplyTemplate = useCallback(async () => {
    if (!def) return;
    setBusy(true);
    setError("");
    try {
      const data = await postJSON<ApplyResponse>("/api/mirror/templates/apply", {
        id: def.id,
        values,
      });
      // trigger download via returned path
      window.location.href = data.downloadPath;
    } catch (e) {
      setError((e as Error).message || "Apply failed");
    } finally {
      setBusy(false);
    }
  }, [def, values]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Datasheet Mirror (Excel MVP)</h1>
        {busy ? (
          <span className="text-xs px-2 py-1 rounded bg-gray-100">Working…</span>
        ) : null}
      </header>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {/* Stage: Upload */}
      {stage === "upload" && (
        <section className="rounded border p-4 space-y-4">
            <p className="text-sm text-gray-600">
            Upload a sample Excel datasheet (EDS/WSP) to learn its layout.
            </p>

            <div className="flex items-center gap-3">
            {/* Visually a button, functionally a label for the hidden input */}
            <label
                htmlFor="mirror-file"
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-black text-white cursor-pointer hover:opacity-90 active:opacity-80"
            >
                {/* optional icon */}
                <span>Choose File</span>
            </label>

            {/* Show selected file name or a hint */}
            <span className="text-sm text-gray-700 truncate max-w-[50ch]">
                {file ? file.name : "No file selected"}
            </span>
            </div>

            {/* Hidden native input */}
            <input
            id="mirror-file"
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            <div className="flex gap-2">
            <button
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
                onClick={onUploadExcel}
                disabled={!file || busy}
            >
                {busy ? "Learning…" : "Learn Layout"}
            </button>
            </div>
        </section>
        )}

      {/* Stage: Confirm */}
      {stage === "confirm" && def && (
        <section className="rounded border p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Confirm Template</h2>
            <span className="text-xs text-gray-500">
              Client Key: <code>{def.clientKey}</code>
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fieldList.map((f) => (
              <div key={f.key} className="border rounded p-2">
                <div className="text-[11px] uppercase text-gray-500">
                  {f.mapTo.bucket}
                </div>
                <div className="font-medium truncate" title={f.label}>
                  {f.label}
                </div>
                <div className="text-[11px] text-gray-500">
                  bbox {f.bbox.join(", ")}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded border"
              onClick={() => setStage("upload")}
              disabled={busy}
            >
              Back
            </button>
            <button
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              onClick={onConfirmTemplate}
              disabled={busy}
            >
              {busy ? "Saving…" : "Confirm & Save"}
            </button>
          </div>
        </section>
      )}

      {/* Stage: Apply */}
      {stage === "apply" && def && (
        <section className="rounded border p-4 space-y-4">
          <h2 className="font-medium">Apply Template – Enter Values</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fieldList.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-sm">{f.label}</span>
                <input
                  className="border rounded px-2 py-1"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="px-4 py-2 rounded border"
              onClick={() => setStage("confirm")}
              disabled={busy}
            >
              Back
            </button>
            <button
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              onClick={onApplyTemplate}
              disabled={busy}
            >
              {busy ? "Generating…" : "Generate Excel"}
            </button>
          </div>
        </section>
      )}

      {/* Quick i18n tester (FR → EN) */}
      <section className="rounded border p-4 space-y-3">
        <h2 className="font-medium">French → English (labels) – Quick Test</h2>
        <p className="text-sm text-gray-600">
          Day-1 stub; saves EN rows with <code>IsMachineTranslated=1</code>.
        </p>
        <TranslateWidget />
      </section>
    </div>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function TranslateWidget() {
  const [text, setText] = useState<string>(
    "Pression de conception\nTempérature de service"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<string>("");

  const submit = useCallback(async () => {
    setLoading(true);
    setResult("");
    try {
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
      const items = lines.map((l, i) => ({
        entity: "infoTemplate" as const,
        id: 1000 + i,
        label: l,
      }));

      const res = await fetch("/api/mirror/i18n/translate-and-save", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          sourceLang: "fr",
          targets: ["en"],
          items,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult((e as Error).message || "Translation failed");
    } finally {
      setLoading(false);
    }
  }, [text]);

  return (
    <div className="space-y-2">
      <textarea
        className="w-full border rounded p-2 h-28"
        placeholder="Enter text to translate"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Translating…" : "Translate & Save (fr→en)"}
      </button>
      {result && (
        <pre className="bg-gray-50 border rounded p-2 text-xs overflow-auto max-h-64">
          {result}
        </pre>
      )}
    </div>
  );
}
