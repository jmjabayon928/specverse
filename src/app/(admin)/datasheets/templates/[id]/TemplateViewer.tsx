// src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx
"use client";

import React from "react";
import type { UnifiedSheet } from "@/domain/datasheets/sheetTypes";
import { translations as labelTranslations } from "@/constants/translations";
import { convertToUSC } from "@/utils/unitConversionTable";

function safeFormatDate(input: string | Date | null | undefined): string {
  if (!input) return "-";
  const date = new Date(input);
  return isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

const getUILabel = (key: string, lang: string): string =>
  labelTranslations[key]?.[lang] ?? key;

const getLabel = (key: string, map?: Record<string, string>, fallback = key): string =>
  map?.[key] ?? fallback;

// Build stable keys from IDs; never rely on translated strings.
function hashString(s: string): string {
  // djb2 xor variant → deterministic, short
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function stableSubsheetKey(sub: {
  originalId?: number | string | null;
  id?: number | string;
  subsheetId?: number | string;
  code?: string;
  name?: string | null;
}) {
  const id =
    sub.originalId ??
    sub.id ??
    sub.subsheetId ??
    sub.code;
  if (id != null) return String(id);
  // last resort: hash of non-translated structural signature
  return `sub:${hashString(JSON.stringify({ name: sub.name ?? "", hint: "sub" }))}`;
}

function stableFieldKey(f: {
  originalId?: number | string | null;
  id?: number | string;
  fieldId?: number | string;
  code?: string;
  label?: string | null;
  uom?: string | null;
  required?: boolean;
  options?: unknown[];
}) {
  const id = f.originalId ?? f.id ?? f.fieldId ?? f.code;
  if (id != null) return String(id);
  // last resort: hash a structural signature (not translated)
  const sig = JSON.stringify(
    { label: f.label ?? "", uom: f.uom ?? "", req: !!f.required, opts: f.options ?? [] }
  );
  return `fld:${hashString(sig)}`;
}

/* ──────────────────────────────────────────────────────────────
   Local view-only types for notes & attachments (no `any`)
   ────────────────────────────────────────────────────────────── */
type SheetNoteDTO = {
  id: number;
  noteTypeId: number | null;
  noteTypeName?: string | null;  // from NoteTypes join
  orderIndex: number | null;
  body: string;
  createdAt: string;              // ISO
  createdBy?: number | null;
  createdByName?: string | null;
};

type SheetAttachmentDTO = {
  // link (SheetAttachments)
  sheetAttachmentId: number;
  orderIndex: number;
  isFromTemplate: boolean;
  linkedFromSheetId?: number | null;
  cloneOnCreate: boolean;

  // file (Attachments)
  id: number;
  originalName: string;
  storedName: string;
  contentType: string;
  fileSizeBytes: number;
  storageProvider: string;
  storagePath: string;
  sha256?: string | null;
  uploadedBy?: number | null;
  uploadedByName?: string | null;
  uploadedAt: string;             // ISO
  isViewable: boolean;

  // derived
  fileUrl?: string;
};

type WithNotes = { notes?: SheetNoteDTO[] };
type WithAttachments = { attachments?: SheetAttachmentDTO[] };
type SheetWithExtras = UnifiedSheet & WithNotes & WithAttachments;

interface Props {
  data: UnifiedSheet;
  unitSystem: "SI" | "USC";
  language: string;
  translations?: {
    fieldLabelMap?: Record<string, string>;
    subsheetLabelMap?: Record<string, string>;
    sheetFieldMap?: Record<string, string>;
    optionMap?: Record<string, string[]>;
  } | null;

  // optional handlers for Add buttons
  onAddNote?: (templateSheetId: number) => void;
  onAddAttachment?: (templateSheetId: number) => void;
}

/* ── Safer display helpers (no "[object Object]"; circular-safe) ───────── */
function getCircularReplacer() {
  const seen = new WeakSet<object>();
  return (_key: string, value: unknown) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

function toDisplayString(raw: unknown): string {
  if (raw == null || raw === "") return "-";
  if (raw instanceof Date) return safeFormatDate(raw);

  switch (typeof raw) {
    case "string":
      return raw;
    case "number":
      return Number.isFinite(raw) ? `${raw}` : "-";
    case "boolean":
      return raw ? "true" : "false";
    case "bigint":
      return raw.toString();
    case "symbol":
      return raw.description ?? raw.toString();
    case "function":
      return "[Function]";
    case "object":
      try {
        return JSON.stringify(raw, getCircularReplacer());
      } catch {
        return "[Unserializable]";
      }
    default:
      return "-";
  }
}

function formatMaybeDate(raw: unknown, isDate: boolean): string {
  if (isDate) {
    if (typeof raw === "string" || raw instanceof Date) return safeFormatDate(raw);
    return "-";
  }
  return toDisplayString(raw);
}

export default function TemplateViewer(props: Readonly<Props>) {
  const {
    data,
    unitSystem,
    language,
    translations,
    onAddNote,
    onAddAttachment,
  } = props;

  const fieldLabelMap = translations?.fieldLabelMap || {};
  const subsheetLabelMap = translations?.subsheetLabelMap || {};
  const optionMap = translations?.optionMap || {};

  const getConvertedUOM = (uom?: string) => {
    if (!uom) return "";
    return unitSystem === "USC" ? convertToUSC("1", uom).unit : uom;
  };

  // Access optional arrays provided by the service — give them STABLE identities
  const dataX = data as SheetWithExtras;

  const safeNotes = React.useMemo<SheetNoteDTO[]>(
    () => (Array.isArray(dataX.notes) ? dataX.notes : []),
    [dataX.notes]
  );

  const safeAttachments = React.useMemo<SheetAttachmentDTO[]>(
    () => (Array.isArray(dataX.attachments) ? dataX.attachments : []),
    [dataX.attachments]
  );

  // Group notes by type (name preferred; fallback to id/Uncategorized)
  type NoteGroup = { key: string; label: string; items: SheetNoteDTO[] };
  const groupedNotes: NoteGroup[] = React.useMemo(() => {
    const byType = new Map<string, NoteGroup>();
    for (const n of safeNotes) {
      const key = n.noteTypeId !== null && n.noteTypeId !== undefined ? String(n.noteTypeId) : "unknown";
      const label =
        n.noteTypeName?.trim() ||
        (n.noteTypeId !== null && n.noteTypeId !== undefined ? `Type ${n.noteTypeId}` : "Uncategorized");
      if (!byType.has(key)) byType.set(key, { key, label, items: [] });
      byType.get(key)!.items.push(n);
    }
    const groups = Array.from(byType.values()).sort((a, b) => a.label.localeCompare(b.label));
    for (const g of groups) {
      g.items.sort((a, b) => {
        const oi = (a.orderIndex ?? 0) - (b.orderIndex ?? 0);
        if (oi !== 0) return oi;
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return tb - ta;
      });
    }
    return groups;
  }, [safeNotes]);

  // Handlers with type narrowing to avoid TS errors
  const canAddNote = Boolean(onAddNote && typeof data.sheetId === "number");
  const canAddAttachment = Boolean(onAddAttachment && typeof data.sheetId === "number");

  const handleAddNote = () => {
    if (onAddNote && typeof data.sheetId === "number") onAddNote(data.sheetId);
  };
  const handleAddAttachment = () => {
    if (onAddAttachment && typeof data.sheetId === "number") onAddAttachment(data.sheetId);
  };

  return (
    <div className="space-y-6">
      {/* Datasheet Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Datasheet Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "sheetName", "sheetDesc", "sheetDesc2",
            "clientDocNum", "clientProjectNum", "companyDocNum", "companyProjectNum",
            "areaName", "packageName", "revisionNum", "revisionDate",
            "preparedByName", "preparedByDate",
            "modifiedByName", "modifiedByDate",
            "rejectedByName", "rejectedByDate", "rejectComment",
            "verifiedByName", "verifiedDate",
            "approvedByName", "approvedDate"
          ].map((key) => {
            const label = getUILabel(key, language);
            const rawValue = data[key as keyof UnifiedSheet];
            const isDate = key.toLowerCase().includes("date");
            const value = formatMaybeDate(rawValue, isDate);

            return (
              <div key={key} className={key === "rejectComment" ? "md:col-span-2" : ""}>
                <label className="font-medium text-sm text-gray-700">{label}</label>
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2 whitespace-pre-line">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Equipment Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Equipment Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "equipmentName", "equipmentTagNum", "serviceName", "requiredQty", "itemLocation",
            "manuName", "suppName", "installPackNum", "equipSize", "modelNum", "driver",
            "locationDwg", "pid", "installDwg", "codeStd", "categoryName", "clientName", "projectName",
          ].map((key) => {
            const raw = data[key as keyof UnifiedSheet];
            const value =
              typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
                ? String(raw)
                : "-";

            return (
              <div key={key}>
                <label className="font-medium text-sm text-gray-700">
                  {getUILabel(key, language)}
                </label>
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Subsheets */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Subsheets", language)}
        </div>
        {Array.isArray(data.subsheets) && data.subsheets.map((sub) => {
          const subsheetKey = sub.originalId?.toString() ?? sub.name;               // keep for translation lookup
          const subsheetStableKey = stableSubsheetKey(sub);                          // NEW: for React keys only
          const subsheetName = getLabel(subsheetKey, subsheetLabelMap, sub.name);

          const midpoint = Math.ceil(sub.fields.length / 2);
          const leftFields = sub.fields.slice(0, midpoint);
          const rightFields = sub.fields.slice(midpoint);

          const renderTable = (fields: typeof sub.fields, tableKey: string) => (
            <table key={tableKey} className="w-full table-auto text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">{getUILabel("InfoLabel", language)}</th>
                  <th className="border px-2 py-1">{getUILabel("InfoUOM", language)}</th>
                  <th className="border px-2 py-1">{getUILabel("InfoOptions", language)}</th>
                  <th className="border px-2 py-1">{getUILabel("InfoValue", language)}</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, j) => {
                  const fieldKey = f.originalId?.toString() ?? f.label;
                  const fieldStableKey = stableFieldKey(f);
                  const label = getLabel(fieldKey, fieldLabelMap, f.label);
                  const options = f.options?.length
                    ? optionMap[f.originalId?.toString() ?? ""] ?? f.options
                    : null;
                  const uom = getConvertedUOM(f.uom);

                  return (
                    <tr
                      key={`row:${subsheetStableKey}:${fieldStableKey}`}                 // ← use stable keys
                      className={j % 2 === 0 ? "bg-white" : "bg-gray-50"}
                    >
                      <td className="border px-2 py-1">
                        {f.required && <span className="text-red-500 font-bold mr-1">*</span>}
                        {label}
                      </td>
                      <td className="border px-2 py-1">{uom || "-"}</td>
                      <td className="border px-2 py-1">
                        {options?.length ? options.join(", ") : "-"}
                      </td>
                      <td className="border px-2 py-1">{f.value ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );

          return (
            <div key={`section:${subsheetKey}`} className="mb-6">
              <h3 className="font-semibold mb-2">{subsheetName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderTable(leftFields, `left:${subsheetKey}`)}
                {renderTable(rightFields, `right:${subsheetKey}`)}
              </div>
            </div>
          );
        })}
      </fieldset>

      {/* Notes (grouped by NoteType) + Add Note button */}
      <fieldset className="border rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">{getUILabel("Notes", language)}</div>
          <button
            type="button"
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium hover:shadow disabled:opacity-50"
            onClick={handleAddNote}
            disabled={!canAddNote}
            aria-label={getUILabel("AddNote", language)}
            title={
              canAddNote
                ? getUILabel("AddNote", language)
                : getUILabel("HandlerNotProvided", language) ?? "Handler not provided"
            }
          >
            {getUILabel("AddNote", language) ?? "Add Note"}
          </button>
        </div>

        {groupedNotes.length > 0 ? (
          <div className="space-y-6">
            {groupedNotes.map((grp) => (
              <div key={`note-group-${grp.key}`}>
                <div className="text-base font-semibold mb-2">{grp.label}</div>
                <div className="overflow-x-auto">
                  <table className="w-full table-auto border text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border px-2 py-1 w-20">{getUILabel("Order", language) ?? "Order"}</th>
                        <th className="border px-2 py-1">{getUILabel("NoteText", language) ?? "Note Text"}</th>
                        <th className="border px-2 py-1 w-40">{getUILabel("CreatedBy", language) ?? "Created By"}</th>
                        <th className="border px-2 py-1 w-32">{getUILabel("CreatedAt", language) ?? "Created At"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grp.items.map((n) => (
                        <tr key={`note-${grp.key}-${n.id}`} className="odd:bg-white even:bg-gray-50">
                          <td className="border px-2 py-1 text-center">{n.orderIndex ?? "-"}</td>
                          <td className="border px-2 py-1">
                            <pre className="whitespace-pre-wrap text-sm">{n.body}</pre>
                          </td>
                          <td className="border px-2 py-1">{n.createdByName ?? "-"}</td>
                          <td className="border px-2 py-1">{safeFormatDate(n.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            {getUILabel("NoNotes", language) ?? "No notes"}
          </div>
        )}
      </fieldset>

      {/* Attachments + Add Attachment button */}
      <fieldset className="border rounded p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xl font-semibold">{getUILabel("Attachments", language)}</div>
          <button
            type="button"
            className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium hover:shadow disabled:opacity-50"
            onClick={handleAddAttachment}
            disabled={!canAddAttachment}
            aria-label={getUILabel("AddAttachment", language)}
            title={
              canAddAttachment
                ? getUILabel("AddAttachment", language)
                : getUILabel("HandlerNotProvided", language) ?? "Handler not provided"
            }
          >
            {getUILabel("AddAttachment", language) ?? "Add Attachment"}
          </button>
        </div>

        {safeAttachments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full table-auto border text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-2 py-1">{getUILabel("FileName", language) ?? "File Name"}</th>
                  <th className="border px-2 py-1">{getUILabel("UploadedBy", language) ?? "Uploaded By"}</th>
                  <th className="border px-2 py-1">{getUILabel("UploadedAt", language) ?? "Uploaded At"}</th>
                  <th className="border px-2 py-1">{getUILabel("Action", language) ?? "Action"}</th>
                </tr>
              </thead>
              <tbody>
                {safeAttachments.map((a) => {
                  const link = a.fileUrl ?? "";
                  return (
                    <tr key={`att-${a.id}`} className="odd:bg-white even:bg-gray-50">
                      <td className="border px-2 py-1">{a.originalName || `file-${a.id}`}</td>
                      <td className="border px-2 py-1">{a.uploadedByName ?? "-"}</td>
                      <td className="border px-2 py-1">{safeFormatDate(a.uploadedAt)}</td>
                      <td className="border px-2 py-1">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {getUILabel("ViewDownload", language) ?? "View / Download"}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            {getUILabel("NoAttachments", language) ?? "No attachments"}
          </div>
        )}
      </fieldset>
    </div>
  );
}
