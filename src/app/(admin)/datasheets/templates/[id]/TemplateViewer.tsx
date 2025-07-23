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

const getLabel = (key: string, map?: Record<string, string>, fallback = key): string => {
  return map?.[key] ?? fallback;
};

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

  return (
    <div className="space-y-6">
      {/* Datasheet Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Datasheet Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "SheetName", "SheetDesc", "SheetDesc2", "AreaName", "PackageName",
            "RevisionNum", "RevisionDate", "ClientDocNum", "ClientProjectNum",
            "CompanyDocNum", "CompanyProjectNum",
          ].map((key) => {
            const rawValue = data[key.charAt(0).toLowerCase() + key.slice(1) as keyof UnifiedSheet];
            const isDate = key.toLowerCase().includes("date");
            const value = isDate
              ? safeFormatDate(rawValue as string | Date | null | undefined)
              : String(rawValue ?? "-");
            return (
              <div key={key}>
                <label className="font-medium text-sm text-gray-700">
                  {getLabel(key, fieldLabelMap, getUILabel(key, language))}
                </label>
                <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">
                  {value}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {/* Audit Trail */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Audit Trail", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "preparedByName", "preparedByDate", "modifiedByName", "modifiedByDate",
            "rejectedByName", "rejectedByDate", "verifiedByName", "verifiedDate",
            "approvedByName", "approvedDate",
          ].map((key) => {
            const rawValue = data[key as keyof UnifiedSheet];
            const isDate = key.toLowerCase().includes("date");
            const value = isDate
              ? safeFormatDate(rawValue as string | Date | null | undefined)
              : String(rawValue ?? "-");
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
          <div className="md:col-span-2">
            <label className="font-medium text-sm text-gray-700">
              {getUILabel("rejectComment", language)}
            </label>
            <div className="bg-gray-100 text-gray-900 rounded px-3 py-2">
              {data.rejectComment ?? "-"}
            </div>
          </div>
        </div>
      </fieldset>

      {/* Equipment Details */}
      <fieldset className="border rounded p-4">
        <div className="text-xl font-semibold mb-4">
          {getUILabel("Equipment Details", language)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            "EquipmentName", "EquipmentTagNum", "ServiceName", "RequiredQty", "ItemLocation",
            "ManuName", "SuppName", "InstallPackNum", "EquipSize", "ModelNum", "Driver",
            "LocationDwg", "PID", "InstallDwg", "CodeStd", "CategoryName", "ClientName", "ProjectName",
          ].map((key) => {
            const raw = data[key.charAt(0).toLowerCase() + key.slice(1) as keyof UnifiedSheet];
            const value = typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean"
              ? String(raw)
              : "-";
            return (
              <div key={key}>
                <label className="font-medium text-sm text-gray-700">
                  {getLabel(key, fieldLabelMap, getUILabel(key, language))}
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
                  const uom = unitSystem === "USC" && f.uom
                    ? convertToUSC("0", f.uom).unit
                    : f.uom ?? "-";

                  return (
                    <tr key={j} className={j % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border px-2 py-1">
                        {f.required && <span className="text-red-500 font-bold">*</span>} {label}
                      </td>
                      <td className="border px-2 py-1">{uom}</td>
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
