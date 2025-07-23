import React from "react";
import type { UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";
import { translations as labelTranslations } from "@/constants/translations";
import { convertToUSC } from "@/utils/unitConversionTable";

// ✅ Local fallback type (no need for types/unit.ts)
type UnitSystem = "SI" | "USC";

// ✅ Local conversion function (replaces missing convertValue)
function convertValue(value: string, unitSystem: UnitSystem, uom?: string): { value: string; uom: string } {
  if (!value || !uom || unitSystem === "SI") return { value, uom: uom ?? "" };

  const result = convertToUSC(value, uom); // value is string, uom is string | null | undefined
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
  return isNaN(date.getTime()) ? "-" : date.toISOString().slice(0, 10);
}

interface Props {
  sheet: UnifiedSheet;
  translations: SheetTranslations | null;
  language: string;
  unitSystem: UnitSystem;
}

const FilledSheetViewer: React.FC<Props> = ({
  sheet,
  translations,
  language,
  unitSystem,
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
            "equipmentName", "equipmentTagNum", "serviceName", "requiredQty", "itemLocation",
            "manuName", "suppName", "installPackNum", "equipSize", "modelNum",
            "driver", "locationDwg", "pid", "installDwg", "codeStd",
            "categoryName", "clientName", "projectName"
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
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">
                  {value}
                </div>
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
                      const numericValueOnly = formatFieldValue(unitSystem, String(field.value ?? ""), field.uom, false);
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
    </div>
  );
};

export default FilledSheetViewer;
