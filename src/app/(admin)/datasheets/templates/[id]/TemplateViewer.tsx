// src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import { translations as labelTranslations } from "@/constants/translations";
import { convertToUSC } from "@/utils/unitConversionTable";
import SheetNotesPanel from "@/components/notes/SheetNotesPanel";
import SheetAttachmentsPanel from "@/components/attachments/SheetAttachmentsPanel";
import type { AttachmentDTO } from "@/types/attachments";

function safeFormatDate(input: string | Date | null | undefined): string {
  if (!input) return "-";
  const date = new Date(input);
  return isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}
const formatDateTime = (input: string | Date | null | undefined): string => {
  if (!input) return "-";
  const d = new Date(input);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
};

const getUILabel = (key: string, lang: string): string =>
  labelTranslations[key]?.[lang] ?? key;
const getLabel = (key: string, map?: Record<string, string>, fallback = key): string =>
  map?.[key] ?? fallback;

// ===== Audit Types (Template) =====
type TemplateAuditRow = {
  TemplateChangeLogID: number;
  SheetID: number;
  Message: string;
  ChangedBy: number | null;
  ChangeDate: string;           // ISO-ish string from API
  ChangedByName?: string | null;
};

async function fetchTemplateAudit(
  sheetId: number,
  limit = 50,
  offset = 0
): Promise<{ entries: TemplateAuditRow[]; limit: number; offset: number }> {
  const res = await fetch(
    `/api/backend/templates/${sheetId}/audit?limit=${limit}&offset=${offset}`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `Failed to load template audit (HTTP ${res.status})${msg ? `: ${msg}` : ""}`
    );
  }
  return res.json();
}

function TemplateAuditTrail({ sheetId }: { sheetId: number }) {
  const PAGE_SIZE = 50;
  const [entries, setEntries] = useState<TemplateAuditRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const canLoad = useMemo(() => sheetId > 0 && !loading, [sheetId, loading]);

  const load = async (nextOffset: number, append = false) => {
    if (!canLoad) return;
    setLoading(true);
    setError(null);
    try {
      const { entries: page, limit } = await fetchTemplateAudit(
        sheetId,
        PAGE_SIZE,
        nextOffset
      );
      setEntries((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === limit);
      setOffset(nextOffset);
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
          ? e
          : JSON.stringify(e);
      setError(msg || "Failed to load audit.");
    } finally {
      setLoading(false);
    }
  };

  // initial load / reload on sheetId change
  useEffect(() => {
    if (sheetId > 0) {
      load(0, false);
    } else {
      setEntries([]);
      setHasMore(false);
      setOffset(0);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId]);

  if (sheetId <= 0) return null;

  return (
    <section className="border rounded p-4">
      <div className="text-xl font-semibold mb-4">Audit Trail</div>

      {error && (
        <div className="text-sm text-red-600 mb-3">
          {error}
        </div>
      )}

      {!error && entries.length === 0 && !loading && (
        <div className="text-sm text-gray-500">No audit entries yet.</div>
      )}

      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.TemplateChangeLogID} className="rounded-xl border p-3">
            <div className="text-sm text-gray-600">
              {formatDateTime(e.ChangeDate)}
              {e.ChangedByName ? ` • ${e.ChangedByName}` : ""}
            </div>
            <div className="text-sm whitespace-pre-wrap">{e.Message}</div>
          </div>
        ))}
      </div>

      <div className="pt-3 flex gap-2">
        {hasMore && (
          <button
            type="button"
            onClick={() => load(offset + PAGE_SIZE, true)}
            disabled={loading}
            className="text-sm underline"
          >
            {loading ? "Loading…" : "Show more"}
          </button>
        )}
        {offset > 0 && (
          <button
            type="button"
            onClick={() => load(0, false)}
            disabled={loading}
            className="text-sm underline"
          >
            Back to top
          </button>
        )}
      </div>
    </section>
  );
}

interface Props {
  sheetId: number;
  data: UnifiedSheet;
  unitSystem: "SI" | "USC";
  language: string;
  translations?: {
    fieldLabelMap?: Record<string, string>;
    subsheetLabelMap?: Record<string, string>;
    sheetFieldMap?: Record<string, string>;
    optionMap?: Record<string, string[]>;
  } | null;
  isSheetLocked?: boolean;
  initialNotes?: SheetNoteDTO[];
  notePermissions?: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
  initialAttachments?: AttachmentDTO[] | null;
  attachmentPermissions?: { canCreate: boolean; canDelete: boolean };
}

export default function TemplateViewer({
  sheetId,
  data,
  unitSystem,
  language,
  translations,
  isSheetLocked = false,
  initialNotes,
  notePermissions,
  initialAttachments = null,
  attachmentPermissions = { canCreate: false, canDelete: false },
}: Props) {
  const fieldLabelMap = translations?.fieldLabelMap || {};
  const subsheetLabelMap = translations?.subsheetLabelMap || {};
  const optionMap = translations?.optionMap || {};

  const getConvertedUOM = (uom?: string) => {
    if (!uom) return "";
    return unitSystem === "USC" ? convertToUSC("1", uom).unit : uom;
  };

  // Prefer explicit prop; fall back to data.sheetId
  const effectiveSheetId =
    typeof sheetId === "number" && sheetId > 0
      ? sheetId
      : typeof data.sheetId === "number"
      ? data.sheetId
      : 0;

  return (
    <div className="space-y-6">
      {/* Datasheet Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Datasheet Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "sheetName",
            "sheetDesc",
            "sheetDesc2",
            "clientDocNum",
            "clientProjectNum",
            "companyDocNum",
            "companyProjectNum",
            "areaName",
            "packageName",
            "revisionNum",
            "revisionDate",
            "preparedByName",
            "preparedByDate",
            "modifiedByName",
            "modifiedByDate",
            "rejectedByName",
            "rejectedByDate",
            "rejectComment",
            "verifiedByName",
            "verifiedDate",
            "approvedByName",
            "approvedDate",
          ].map((key) => {
            const label = getUILabel(key, language);
            const rawValue = data[key as keyof UnifiedSheet];
            const isDate = key.toLowerCase().includes("date");
            const value = isDate
              ? safeFormatDate(rawValue as string | Date | null | undefined)
              : String(rawValue ?? "-");

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
            "equipmentName",
            "equipmentTagNum",
            "serviceName",
            "requiredQty",
            "itemLocation",
            "manuName",
            "suppName",
            "installPackNum",
            "equipSize",
            "modelNum",
            "driver",
            "locationDwg",
            "pid",
            "installDwg",
            "codeStd",
            "categoryName",
            "clientName",
            "projectName",
          ].map((key) => {
            const raw = data[key as keyof UnifiedSheet];
            const value =
              typeof raw === "string" ||
              typeof raw === "number" ||
              typeof raw === "boolean"
                ? String(raw)
                : "-";

            return (
              <div key={key}>
                <label className="font-medium text-sm text-gray-700">
                  {getUILabel(key, language)}
                </label>
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">{value}</div>
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
        {Array.isArray(data.subsheets) &&
          data.subsheets.map((sub, i) => {
            const midpoint = Math.ceil(sub.fields.length / 2);
            const leftFields = sub.fields.slice(0, midpoint);
            const rightFields = sub.fields.slice(midpoint);

            const renderTable = (fields: typeof sub.fields, key: string) => (
              <table key={key} className="w-full table-auto text-sm border">
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
                    const label = getLabel(fieldKey, fieldLabelMap, f.label);
                    const options = f.options?.length
                      ? optionMap[f.originalId?.toString() ?? ""] ?? f.options
                      : null;
                    const uom = getConvertedUOM(f.uom);

                    return (
                      <tr key={j} className={j % 2 === 0 ? "bg-white" : "bg-gray-50"}>
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

            const subsheetKey = sub.originalId?.toString() ?? sub.name;
            const subsheetName = getLabel(subsheetKey, subsheetLabelMap, sub.name);

            return (
              <div key={i} className="mb-6">
                <h3 className="font-semibold mb-2">{subsheetName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderTable(leftFields, `left-${i}`)}
                  {renderTable(rightFields, `right-${i}`)}
                </div>
              </div>
            );
          })}
      </fieldset>

      {/* Notes */}
      {(effectiveSheetId > 0 || (initialNotes?.length ?? 0) > 0) && (
        <SheetNotesPanel
          sheetId={effectiveSheetId || 0}
          initialNotes={initialNotes}
          permissions={notePermissions}
          className="border rounded p-4"
        />
      )}

      {/* Attachments */}
      {sheetId > 0 && (
        <SheetAttachmentsPanel
          sheetId={sheetId}
          isLocked={isSheetLocked}
          permissions={attachmentPermissions}
          initialAttachments={initialAttachments ?? undefined}
          className="border rounded p-4"
        />
      )}

      {/* === NEW: Audit Trail (TemplateChangeLogs) === */}
      {effectiveSheetId > 0 && <TemplateAuditTrail sheetId={effectiveSheetId} />}
    </div>
  );
}
