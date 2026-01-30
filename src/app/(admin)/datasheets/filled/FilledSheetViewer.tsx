// src/app/(admin)/datasheets/filled/FilledSheetViewer.tsx
import React from "react";
import type { UnifiedSheet, UnifiedSubsheet } from "@/domain/datasheets/sheetTypes";
import type { InfoField } from "@/domain/datasheets/sheetTypes";
import type { SheetTranslations } from "@/domain/i18n/translationTypes";
import { translations as labelTranslations } from "@/constants/translations";
import { convertToUSC } from "@/utils/unitConversionTable";
import OtherConversionsCell from "@/utils/OtherConversionsCell";
import ChangeLogTable from "@/components/datasheets/ChangeLogTable";
import { computeCompleteness, getSubsheetKey } from "@/utils/datasheetCompleteness";
import type { SubsheetCompleteness } from "@/utils/datasheetCompleteness";
import SectionCompletenessSummary from "@/components/datasheets/SectionCompletenessSummary";
import SheetCompletenessBanner from "@/components/datasheets/SheetCompletenessBanner";

// ✅ Local fallback type (no need for types/unit.ts)
type UnitSystem = "SI" | "USC";

// ✅ Local conversion function
function convertValue(value: string, unitSystem: UnitSystem, uom?: string): { value: string; uom: string } {
  if (!value || !uom || unitSystem === "SI") return { value, uom: uom ?? "" };
  const result = convertToUSC(value, uom);
  return { value: result.value, uom: result.unit };
}

function formatFieldValue(unitSystem: UnitSystem, value: string, uom?: string, includeUOM = true): string {
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
  return Number.isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

// Avoid “[object Object]” warnings by normalizing values to safe strings
function toDisplay(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (v instanceof Date) return safeFormatDate(v);
  const t = typeof v;
  switch (t) {
    case "string":
      return v as string;
    case "number":
      return Number.isFinite(v as number) ? `${v as number}` : "-";
    case "boolean":
      return (v as boolean) ? "true" : "false";
    default:
      return "-";
  }
}

// Memoized viewer row: only rerenders when field, unitSystem, or translatedLabel change
interface ViewerFieldRowProps {
  field: InfoField;
  unitSystem: UnitSystem;
  translatedLabel: string;
}

function ViewerFieldRowInner({ field, unitSystem, translatedLabel }: Readonly<ViewerFieldRowProps>) {
  const numericValueOnly = formatFieldValue(
    unitSystem,
    String(field.value ?? ""),
    field.uom,
    false
  );
  const convertedUOM = getConvertedUOM(unitSystem, field.uom);
  const baseUnitForAlternates =
    unitSystem === "USC" ? (convertedUOM || field.uom || "") : (field.uom || "");

  return (
    <tr className="odd:bg-white even:bg-gray-50">
      <td className="border px-2 py-1">
        {field.required && <span className="text-red-500 font-bold mr-1">*</span>}
        {translatedLabel}
      </td>
      <td className="border px-2 py-1">
        {Array.isArray(field.options) && field.options.length > 0
          ? field.options.join(", ")
          : "-"}
      </td>
      <td className="border px-2 py-1">{numericValueOnly}</td>
      <td className="border px-2 py-1">{convertedUOM || "-"}</td>
      <td className="border px-2 py-1">
        <OtherConversionsCell
          numericValue={numericValueOnly}
          unit={baseUnitForAlternates}
          system={unitSystem}
        />
      </td>
    </tr>
  );
}

const ViewerFieldRow = React.memo(ViewerFieldRowInner);

// Memoized subsheet section: only rerenders when subsheet, completeness, language, or unitSystem change
interface SubsheetSectionProps {
  subsheet: UnifiedSubsheet;
  sectionCompleteness: SubsheetCompleteness | null | undefined;
  language: string;
  unitSystem: UnitSystem;
  subsheetLabelMap: Record<string, string>;
  fieldLabelMap: Record<string, string>;
}

function SubsheetSectionInner({
  subsheet,
  sectionCompleteness,
  language,
  unitSystem,
  subsheetLabelMap,
  fieldLabelMap,
}: Readonly<SubsheetSectionProps>) {
  const originalSubId = subsheet.originalId ?? subsheet.id;
  const translatedSubName =
    originalSubId !== undefined && originalSubId !== null
      ? (subsheetLabelMap[String(originalSubId)] ?? subsheet.name)
      : subsheet.name;

  const totalFields = subsheet.fields.length;
  const midpoint = Math.ceil(totalFields / 2);
  const leftFields = subsheet.fields.slice(0, midpoint);
  const rightFields = subsheet.fields.slice(midpoint);

  const renderFieldGroup = (fieldGroup: InfoField[], side: "left" | "right") => (
    <table key={`tbl-${originalSubId}-${side}`} className="w-full table-auto border text-sm">
      <thead className="bg-gray-100">
        <tr>
          <th className="border px-2 py-1">{getUILabel("InfoLabel", language)}</th>
          <th className="border px-2 py-1">{getUILabel("InfoOptions", language)}</th>
          <th className="border px-2 py-1">{getUILabel("InfoValue", language)}</th>
          <th className="border px-2 py-1">{getUILabel("InfoUOM", language)}</th>
          <th className="border px-2 py-1">{getUILabel("OtherConversions", language) ?? "Other Conversions"}</th>
        </tr>
      </thead>
      <tbody>
        {fieldGroup.map((field, index) => {
          const originalFieldId = field.originalId ?? field.id;
          const translatedLabel =
            originalFieldId !== undefined && originalFieldId !== null
              ? (fieldLabelMap[String(originalFieldId)] ?? field.label)
              : field.label;
          const baseId = field.id ?? originalFieldId ?? "x";
          const rowKey = `field-${originalSubId}-${side}-${baseId}-${index}`;
          return (
            <ViewerFieldRow
              key={rowKey}
              field={field}
              unitSystem={unitSystem}
              translatedLabel={translatedLabel}
            />
          );
        })}
      </tbody>
    </table>
  );

  return (
    <fieldset className="border rounded p-4 mb-6">
      <div className="text-xl font-semibold mb-4">{translatedSubName}</div>
      {sectionCompleteness != null && (
        <SectionCompletenessSummary
          totalRequired={sectionCompleteness.totalRequired}
          filledRequired={sectionCompleteness.filledRequired}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderFieldGroup(leftFields, "left")}
        {renderFieldGroup(rightFields, "right")}
      </div>
    </fieldset>
  );
}

const SubsheetSection = React.memo(SubsheetSectionInner);

/* ──────────────────────────────────────────────────────────────────────────
   Local view-only types for notes & attachments (to avoid using `any`)
   These mirror what your service returns and are optional on `sheet`.
   ────────────────────────────────────────────────────────────────────────── */
type SheetNoteDTO = {
  id: number;
  noteTypeId: number | null;
  /** Optional: supply from backend (JOIN NoteTypes) */
  noteTypeName?: string | null;
  orderIndex: number | null;
  body: string;
  createdAt: string;              // ISO
  createdBy?: number | null;
  createdByName?: string | null;
};

type SheetAttachmentDTO = {
  sheetAttachmentId: number;
  orderIndex: number;
  isFromTemplate: boolean;
  linkedFromSheetId?: number | null;
  cloneOnCreate: boolean;

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
  fileUrl?: string;
};

type WithNotes = { notes?: SheetNoteDTO[] };
type WithAttachments = { attachments?: SheetAttachmentDTO[] };
type SheetWithExtras = UnifiedSheet & WithNotes & WithAttachments;

interface Props {
  sheet: UnifiedSheet;
  translations: SheetTranslations | null;
  language: string;
  unitSystem: UnitSystem;

  // Optional handlers for the buttons
  onAddNote?: (sheetId: number) => void;
  onAddAttachment?: (sheetId: number) => void;
}

const FilledSheetViewer: React.FC<Props> = ({
  sheet,
  translations,
  language,
  unitSystem,
  onAddNote,
  onAddAttachment,
}) => {
  const subsheetLabelMap = translations?.subsheets || {};
  const fieldLabelMap = translations?.labels || {};

  // Access the optional arrays with STABLE refs to satisfy react-hooks/exhaustive-deps
  const sheetX = sheet as SheetWithExtras;

  const notes = React.useMemo<SheetNoteDTO[]>(
    () => (Array.isArray(sheetX.notes) ? sheetX.notes : []),
    [sheetX.notes]
  );

  const attachments = React.useMemo<SheetAttachmentDTO[]>(
    () => (Array.isArray(sheetX.attachments) ? sheetX.attachments : []),
    [sheetX.attachments]
  );

  // Handlers with proper type narrowing for sheetId
  const canAddNote = Boolean(onAddNote && typeof sheet.sheetId === "number");
  const canAddAttachment = Boolean(onAddAttachment && typeof sheet.sheetId === "number");
  const sheetId = typeof sheet.sheetId === "number" ? sheet.sheetId : null;

  const handleAddNote = () => {
    if (onAddNote && typeof sheet.sheetId === "number") onAddNote(sheet.sheetId);
  };
  const handleAddAttachment = () => {
    if (onAddAttachment && typeof sheet.sheetId === "number") onAddAttachment(sheet.sheetId);
  };

  // ─────────────────────────────────────────────────────────────
  // Group notes by note type (name if provided, else by id)
  // ─────────────────────────────────────────────────────────────
  type NoteGroup = { key: string; label: string; items: SheetNoteDTO[] };

  const completeness = React.useMemo(
    () => computeCompleteness(sheet.subsheets),
    [sheet.subsheets]
  );

  const groupedNotes: NoteGroup[] = React.useMemo(() => {
    const byType = new Map<string, NoteGroup>();
    for (const n of notes) {
      const idKey = n.noteTypeId !== null && n.noteTypeId !== undefined ? String(n.noteTypeId) : "unknown";
      const label =
        n.noteTypeName?.trim() ||
        (n.noteTypeId !== null && n.noteTypeId !== undefined ? `Type ${n.noteTypeId}` : "Uncategorized");
      if (!byType.has(idKey)) byType.set(idKey, { key: idKey, label, items: [] });
      byType.get(idKey)!.items.push(n);
    }
    // sort groups by label asc
    const groups = Array.from(byType.values()).sort((a, b) => a.label.localeCompare(b.label));
    // sort items in each group by OrderIndex ASC, CreatedAt DESC
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
  }, [notes]);

  return (
    <div className="space-y-8">
      <SheetCompletenessBanner
        totalRequired={completeness.totalRequired}
        filledRequired={completeness.filledRequired}
      />
      {/* Datasheet Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Datasheet Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {["sheetName", "sheetDesc", "sheetDesc2"].map((key) => {
            const translatedSheet = translations?.sheet as Record<string, unknown> | undefined;
            const maybeTranslated = translatedSheet?.[key];
            const fallback = sheet[key as keyof UnifiedSheet];
            const value = typeof maybeTranslated === "string" ? maybeTranslated : toDisplay(fallback);

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

          {/* Metadata */}
          {[
            "clientDocNum", "clientProjectNum", "companyDocNum", "companyProjectNum",
            "areaName", "packageName", "revisionNum", "revisionDate",
            "preparedByName", "preparedByDate", "modifiedByName", "modifiedByDate",
            "rejectedByName", "rejectedByDate", "rejectComment",
            "verifiedByName", "verifiedDate", "approvedByName", "approvedDate"
          ].map((key) => {
            const label = getUILabel(key, language);
            const rawValue = sheet[key as keyof UnifiedSheet];
            const isDate = key.toLowerCase().includes("date");
            const value = isDate ? safeFormatDate(rawValue as string | Date | null | undefined) : toDisplay(rawValue);

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
            "manuName", "suppName", "installPackNum", "equipSize", "modelNum",
            "driver", "locationDwg", "pid", "installDwg", "codeStd",
            "categoryName", "clientName", "projectName"
          ].map((key) => {
            const raw = sheet[key as keyof UnifiedSheet];
            const value = toDisplay(raw);

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

      {/* Subsheet Sections */}
      {sheet.subsheets.map((sub, subIndex) => (
        <SubsheetSection
          key={`sub-${sub.originalId ?? sub.id ?? subIndex}`}
          subsheet={sub}
          sectionCompleteness={completeness.bySubsheet[getSubsheetKey(sub, subIndex)]}
          language={language}
          unitSystem={unitSystem}
          subsheetLabelMap={subsheetLabelMap}
          fieldLabelMap={fieldLabelMap}
        />
      ))}

      {/* Notes — grouped by note type */}
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
                <div className="text-base font-semibold mb-2">
                  {grp.label}
                </div>
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

      {/* Attachments */}
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

        {attachments.length > 0 ? (
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
                {attachments.map((a) => {
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
                            {getUILabel("ViewDownload", language) ?? "View Image"}
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

      {sheetId != null && (
        <fieldset className="border rounded p-4">
          <div className="text-xl font-semibold mb-2">Audit &amp; Change Log</div>
          <div className="text-sm text-gray-600 mb-4">
            Latest activity and field-level changes (newest first).
          </div>
          <ChangeLogTable sheetId={sheetId} />
        </fieldset>
      )}

    </div>
  );
};

export default FilledSheetViewer;
