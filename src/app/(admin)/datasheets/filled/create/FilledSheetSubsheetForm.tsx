// src/app/(admin)/datasheets/filled/create/FilledSheetSubsheetForm.tsx
"use client";

import React from "react";
import type { UnifiedSubsheet, InfoField } from "@/domain/datasheets/sheetTypes";
import FieldCompletenessHint from "@/components/datasheets/FieldCompletenessHint";
import SectionCompletenessSummary from "@/components/datasheets/SectionCompletenessSummary";

// Memoized row: only this row rerenders when its value (or error) changes
interface FilledSheetFieldRowProps {
  field: InfoField;
  value: string;
  errorMessage: string | undefined;
  onFieldValueChange: (subsheetIndex: number, infoTemplateId: number, value: string) => void;
  subsheetIndex: number;
  /** Fallback for value lookup/callback when field.id and field.originalId are undefined */
  fieldIndex: number;
}

function FilledSheetFieldRowInner({
  field,
  value,
  errorMessage,
  onFieldValueChange,
  subsheetIndex,
  fieldIndex,
}: Readonly<FilledSheetFieldRowProps>) {
  const infoTemplateId = field.id ?? field.originalId ?? fieldIndex;
  const valueStr = typeof value === "string" ? value : String(value ?? "");
  const isIncompleteHint = field.required && valueStr.trim() === "";
  const hasError = Boolean(errorMessage);
  const isRequired = field.required;
  const label = field.label;

  const onValueChange = (nextValue: string) => {
    onFieldValueChange(subsheetIndex, infoTemplateId, nextValue);
  };

  if (field.options && field.options.length > 0) {
    return (
      <div className="mb-4">
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
          onChange={(e) => onValueChange(e.target.value)}
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
    <div className="mb-4">
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
        onChange={(e) => onValueChange(e.target.value)}
        className={`w-full border rounded px-3 py-2 ${
          hasError ? "border-red-500" : "border-gray-300"
        }`}
        required={isRequired}
      />
      {hasError && <p className="text-sm text-red-600 mt-1">{errorMessage}</p>}
    </div>
  );
}

const FilledSheetFieldRow = React.memo(FilledSheetFieldRowInner);

interface Props {
  subsheet: UnifiedSubsheet;
  subsheetIndex: number;
  fieldValues: Record<number, string>; // keyed by InfoTemplateID (number or string key both work)
  onFieldValueChange: (subsheetIndex: number, infoTemplateId: number, value: string) => void;
  formErrors?: Record<string, string[]>;
  /** Optional section-level completeness for hint (UX only) */
  sectionTotalRequired?: number;
  sectionFilledRequired?: number;
}

function FilledSheetSubsheetFormInner(props: Readonly<Props>) {
  const {
    subsheet,
    subsheetIndex,
    fieldValues,
    onFieldValueChange,
    formErrors = {},
    sectionTotalRequired,
    sectionFilledRequired,
  } = props;

  return (
    <fieldset className="border border-gray-400 rounded p-4 mb-6">
      <legend className="text-lg font-semibold">{subsheet.name}</legend>
      {sectionTotalRequired != null && sectionFilledRequired != null && (
        <SectionCompletenessSummary
          totalRequired={sectionTotalRequired}
          filledRequired={sectionFilledRequired}
        />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {subsheet.fields.map((field, index) => {
          const errorKey = `Subsheet #${subsheetIndex + 1} - Template #${index + 1} - value`;
          const errorMessage = formErrors?.[errorKey]?.[0];
          // String key for lookup: Editor/Cloner use Record<string, string>; Creator uses Record<number, string>; both work at runtime
          const value = (fieldValues as Record<string, string>)[String(field.id ?? field.originalId ?? index)] ?? "";
          return (
            <div key={String(field.id ?? field.originalId ?? index)} data-error-key={errorKey}>
              <FilledSheetFieldRow
                field={field}
                value={value}
                errorMessage={errorMessage}
                onFieldValueChange={onFieldValueChange}
                subsheetIndex={subsheetIndex}
                fieldIndex={index}
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export default React.memo(FilledSheetSubsheetFormInner);
