// src/app/(admin)/datasheets/templates/[id]/TemplateViewer.tsx
"use client";

import React from "react";
import type { UnifiedSheet } from "@/types/sheet";
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
}

export default function TemplateViewer({
  data,
  unitSystem,
  language,
  translations,
}: Props) {
  const fieldLabelMap = translations?.fieldLabelMap || {};
  const subsheetLabelMap = translations?.subsheetLabelMap || {};
  const optionMap = translations?.optionMap || {};

  const getConvertedUOM = (uom?: string) => {
    if (!uom) return "";
    return unitSystem === "USC" ? convertToUSC("1", uom).unit : uom;
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
        {Array.isArray(data.subsheets) && data.subsheets.map((sub, i) => {
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
    </div>
  );
}
