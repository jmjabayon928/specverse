// src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";
import type { SheetNoteDTO } from "@/types/sheetNotes";
import { translations as labelTranslations } from "@/constants/translations";
import { convertToUSC } from "@/utils/unitConversionTable";
import SheetNotesPanel from "@/components/notes/SheetNotesPanel";
import SheetAttachmentsPanel from "@/components/attachments/SheetAttachmentsPanel";
import type { AttachmentDTO } from "@/types/attachments";

// ✅ Local fallback type (no need for types/unit.ts)
type UnitSystem = "SI" | "USC";

// ✅ Local conversion function (replaces missing convertValue)
function convertValue(
  value: string,
  unitSystem: UnitSystem,
  uom?: string
): { value: string; uom: string } {
  if (!value || !uom || unitSystem === "SI") return { value, uom: uom ?? "" };
  const result = convertToUSC(value, uom); // value is string, uom is string | null | undefined
  return { value: result.value, uom: result.unit };
}

function formatFieldValue(
  unitSystem: UnitSystem,
  value: string,
  uom?: string,
  includeUOM = true
): string {
  const converted = convertValue(value, unitSystem, uom);
  return includeUOM && converted.uom ? `${converted.value} ${converted.uom}` : converted.value;
}

function getConvertedUOM(unitSystem: UnitSystem, uom?: string): string {
  if (!uom) return "";
  return unitSystem === "USC" ? convertToUSC("1", uom).unit : uom;
}

function getUILabel(key: string, language: string) {
  return labelTranslations[key]?.[language] ?? key;
}

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

/** ---------- Audit (Filled) ---------- */
type FilledAuditRow = {
  ChangeLogID: number;
  SheetID: number;
  InfoTemplateID: number;
  OldValue: string | null;
  NewValue: string | null;
  UOM: string | null;
  ChangedBy: number | null;
  ChangeDate: string; // stringified date from API
  ChangedByName?: string | null;
  InfoLabel?: string | null; // returned by service (optional)
};

async function fetchFilledAudit(
  sheetId: number,
  limit = 50,
  offset = 0
): Promise<{ entries: FilledAuditRow[]; limit: number; offset: number }> {
  const res = await fetch(`/api/backend/filledsheets/${sheetId}/audit?limit=${limit}&offset=${offset}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      `Failed to load filled audit (HTTP ${res.status})${msg ? `: ${msg}` : ""}`
    );
  }
  return res.json();
}

const isFiniteNumber = (s: string | null | undefined) => {
  if (s == null) return false;
  const n = Number(s);
  return Number.isFinite(n);
};

function maybeConvertAuditValue(
  unitSystem: UnitSystem,
  value: string | null,
  uom?: string | null
): { value: string; uom: string } {
  const raw = value ?? "";
  if (!raw || !uom) return { value: raw, uom: uom ?? "" };
  if (unitSystem === "USC" && isFiniteNumber(raw)) {
    const c = convertToUSC(raw, uom);
    return { value: c.value, uom: c.unit };
  }
  return { value: raw, uom: uom ?? "" };
}

function FilledAuditTrail({
  sheetId,
  unitSystem,
}: {
  sheetId: number;
  unitSystem: UnitSystem;
}) {
  const PAGE_SIZE = 50;
  const [entries, setEntries] = useState<FilledAuditRow[]>([]);
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
      const { entries: page, limit } = await fetchFilledAudit(sheetId, PAGE_SIZE, nextOffset);
      setEntries((prev) => (append ? [...prev, ...page] : page));
      setHasMore(page.length === limit);
      setOffset(nextOffset);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
      setError(msg || "Failed to load audit.");
    } finally {
      setLoading(false);
    }
  };

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

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

      {!error && entries.length === 0 && !loading && (
        <div className="text-sm text-gray-500">No audit entries yet.</div>
      )}

      <div className="space-y-3">
        {entries.map((e) => {
          const label = e.InfoLabel || `Field #${e.InfoTemplateID}`;
          const oldDisp = maybeConvertAuditValue(unitSystem, e.OldValue, e.UOM);
          const newDisp = maybeConvertAuditValue(unitSystem, e.NewValue, e.UOM);

          // choose a single unit to display (prefer new's unit if present)
          const unitText = newDisp.uom || oldDisp.uom;
          return (
            <div key={e.ChangeLogID} className="rounded-xl border p-3">
              <div className="text-sm text-gray-600">
                {formatDateTime(e.ChangeDate)}
                {e.ChangedByName ? ` • ${e.ChangedByName}` : ""}
              </div>
              <div className="text-sm">
                <span className="font-medium">{label}</span>:{" "}
                {oldDisp.value} → {newDisp.value}
                {unitText ? ` (${unitText})` : ""}
              </div>
            </div>
          );
        })}
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

/** ---------- Main Viewer ---------- */
interface Props {
  sheetId: number;
  sheet: UnifiedSheet;
  translations: SheetTranslations | null;
  language: string;
  unitSystem: UnitSystem;
  initialNotes?: SheetNoteDTO[];
  notePermissions?: { canCreate: boolean; canEdit: boolean; canDelete: boolean };
  isSheetLocked: boolean;
  attachmentPermissions?: { canCreate: boolean; canDelete: boolean };
  initialAttachments?: AttachmentDTO[];
}

const FilledSheetViewer: React.FC<Props> = ({
  sheetId,
  sheet,
  translations,
  language,
  unitSystem,
  initialNotes,
  notePermissions,
  isSheetLocked,
  attachmentPermissions,
  initialAttachments,
}) => {
  const subsheetLabelMap = translations?.subsheets || {};
  const fieldLabelMap = translations?.labels || {};

  function getTranslatedSubsheetName(subOriginalId: number | undefined, fallback: string) {
    return subOriginalId !== undefined
      ? subsheetLabelMap?.[String(subOriginalId)] ?? fallback
      : fallback;
  }

  function getTranslatedFieldLabel(fieldOriginalId: number | undefined, fallback: string) {
    return fieldOriginalId !== undefined
      ? fieldLabelMap?.[String(fieldOriginalId)] ?? fallback
      : fallback;
  }

  return (
    <div className="space-y-8">
      {/* Datasheet Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Datasheet Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["sheetName", "sheetDesc", "sheetDesc2"].map((key) => {
            const value =
              typeof translations?.sheet?.[key as keyof typeof translations.sheet] === "string"
                ? translations.sheet?.[key as keyof typeof translations.sheet]
                : String(sheet[key as keyof UnifiedSheet] ?? "-");

            return (
              <div key={key}>
                <label className="font-medium text-sm text-gray-700">
                  {getUILabel(key, language)}
                </label>
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">{value}</div>
              </div>
            );
          })}

          {/* Metadata */}
          {[
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
            const rawValue = sheet[key as keyof UnifiedSheet];
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
            const raw = sheet[key as keyof UnifiedSheet];
            const value =
              typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
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

      {/* Subsheet Sections */}
      {sheet.subsheets.map((sub, subIndex) => {
        const originalSubId = sub.originalId ?? sub.id;
        const translatedSubName = getTranslatedSubsheetName(originalSubId, sub.name);
        const totalFields = sub.fields.length;
        const midpoint = Math.ceil(totalFields / 2);
        const leftFields = sub.fields.slice(0, midpoint);
        const rightFields = sub.fields.slice(midpoint);

        return (
          <fieldset key={`sub-${subIndex}-${originalSubId}`} className="border rounded p-4 mb-6">
            <div className="text-xl font-semibold mb-4">{translatedSubName}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[leftFields, rightFields].map((fieldGroup, groupIndex) => (
                <table key={groupIndex} className="w-full table-auto border text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-2 py-1">{getUILabel("InfoLabel", language)}</th>
                      <th className="border px-2 py-1">{getUILabel("InfoOptions", language)}</th>
                      <th className="border px-2 py-1">{getUILabel("InfoValue", language)}</th>
                      <th className="border px-2 py-1">{getUILabel("InfoUOM", language)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldGroup.map((field, fieldIndex) => {
                      const originalFieldId = field.originalId ?? field.id;
                      const translatedLabel = getTranslatedFieldLabel(originalFieldId, field.label);
                      const numericValueOnly = formatFieldValue(
                        unitSystem,
                        String(field.value ?? ""),
                        field.uom,
                        false
                      );
                      const convertedUOM = getConvertedUOM(unitSystem, field.uom);

                      return (
                        <tr
                          key={`field-${subIndex}-${groupIndex}-${fieldIndex}-${originalFieldId}`}
                          className={fieldIndex % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                          <td className="border px-2 py-1">
                            {field.required && (
                              <span className="text-red-500 font-bold mr-1">*</span>
                            )}
                            {translatedLabel}
                          </td>
                          <td className="border px-2 py-1">
                            {field.options?.length ? field.options.join(", ") : "-"}
                          </td>
                          <td className="border px-2 py-1">{numericValueOnly}</td>
                          <td className="border px-2 py-1">{convertedUOM || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ))}
            </div>
          </fieldset>
        );
      })}

      {/* Notes */}
      {(sheetId > 0 || (initialNotes?.length ?? 0) > 0) && (
        <SheetNotesPanel
          sheetId={sheetId}
          initialNotes={initialNotes}
          permissions={notePermissions}
          className="border rounded p-4"
        />
      )}

      {/* Attachments */}
      <SheetAttachmentsPanel
        sheetId={sheetId}
        isLocked={isSheetLocked}
        permissions={attachmentPermissions}
        initialAttachments={initialAttachments} // optional
        className="border rounded p-4"
      />

      {/* === NEW: Audit Trail (ChangeLogs) === */}
      {sheetId > 0 && <FilledAuditTrail sheetId={sheetId} unitSystem={unitSystem} />}
    </div>
  );
};

export default FilledSheetViewer;
