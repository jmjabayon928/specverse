// src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx
"use client";

import React from "react";
import type { UnifiedSubsheet, InfoField } from "@/domain/datasheets/sheetTypes";
import FieldCompletenessHint from "@/components/datasheets/FieldCompletenessHint";
import SectionCompletenessSummary from "@/components/datasheets/SectionCompletenessSummary";
import type { SubsheetCompleteness } from "@/utils/datasheetCompleteness";

interface Props {
  subsheet: UnifiedSubsheet;
  subsheetIndex: number;
  fieldValues: Record<number, string>; // keyed by InfoTemplateID (number or string key both work)
  onFieldValueChange: (subsheetIndex: number, infoTemplateId: number, value: string) => void;
  formErrors?: Record<string, string[]>;
  /** Optional section-level completeness for hint (UX only) */
  sectionCompleteness?: SubsheetCompleteness;
}

export default function FilledSheetSubsheetForm(props: Readonly<Props>) {
  const {
    subsheet,
    subsheetIndex,
    fieldValues,
    onFieldValueChange,
    formErrors = {},
    sectionCompleteness,
  } = props;

  const handleInputChange = (infoTemplateId: number, value: string) => {
    onFieldValueChange(subsheetIndex, infoTemplateId, value);
  };

  const renderField = (field: InfoField, index: number) => {
    const key = `subsheet-${subsheetIndex}-field-${index}`;
    const infoTemplateId = field.id!;
    const label = field.label;
    const value = fieldValues[infoTemplateId] ?? "";
    const valueStr = typeof value === "string" ? value : String(value ?? "");
    const isIncompleteHint = field.required && valueStr.trim() === "";

    const errorKey = `Subsheet #${subsheetIndex + 1} - Template #${index + 1} - value`;
    const hasError = formErrors?.[errorKey]?.length > 0;
    const errorMessage = formErrors?.[errorKey]?.[0];

    const isRequired = field.required;

    if (field.options && field.options.length > 0) {
      return (
        <div key={key} className="mb-4">
          <label
            className={`block text-sm font-medium mb-1 ${
              hasError ? "text-red-600" : "text-gray-700"
            }`}
          >
            {field.uom ? `${label} (${field.uom})` : label}
            {isRequired && <span className="text-red-500 ml-1">*</span>}
            <FieldCompletenessHint show={isIncompleteHint} />
          </label>
          <select
            value={value}
            title="Select field"
            onChange={(e) => handleInputChange(infoTemplateId, e.target.value)}
            className={`w-full border rounded px-3 py-2 ${
              hasError ? "border-red-500" : "border-gray-300"
            }`}
            required={isRequired}
          >
            <option value="">-- Select --</option>
            {field.options.map((opt) => (
              <option key={`opt:${infoTemplateId}:${opt}`} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {hasError && <p className="text-sm text-red-600 mt-1">{errorMessage}</p>}
        </div>
      );
    }

    const inputType =
      field.infoType === "int" || field.infoType === "decimal" ? "number" : "text";

    return (
      <div key={key} className="mb-4">
        <label
          className={`block text-sm font-medium mb-1 ${
            hasError ? "text-red-600" : "text-gray-700"
          }`}
        >
          {field.uom ? `${label} (${field.uom})` : label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
          <FieldCompletenessHint show={isIncompleteHint} />
        </label>
        <input
          type={inputType}
          title="Input field"
          value={value}
          onChange={(e) => handleInputChange(infoTemplateId, e.target.value)}
          className={`w-full border rounded px-3 py-2 ${
            hasError ? "border-red-500" : "border-gray-300"
          }`}
          required={isRequired}
        />
        {hasError && <p className="text-sm text-red-600 mt-1">{errorMessage}</p>}
      </div>
    );
  };

  return (
    <fieldset className="border border-gray-400 rounded p-4 mb-6">
      <legend className="text-lg font-semibold">{subsheet.name}</legend>
      {sectionCompleteness != null && (
        <SectionCompletenessSummary
          totalRequired={sectionCompleteness.totalRequired}
          filledRequired={sectionCompleteness.filledRequired}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {subsheet.fields.map((field, index) => renderField(field, index))}
      </div>
    </fieldset>
  );
}
