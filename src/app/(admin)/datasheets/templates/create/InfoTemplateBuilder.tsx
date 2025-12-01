// src/components/datasheets/templates/create/InfoTemplateBuilder.tsx
"use client";

import React from "react";
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { groupedSIUnits } from "@/utils/units";
import type { InfoField } from "@/domain/datasheets/sheetTypes";

interface Props {
  subsheet: {
    id?: number;
    name: string;
    fields: InfoField[];
  };
  subsheetIndex: number;
  onFieldsChange: (fields: InfoField[]) => void;
  isEditMode: boolean;
  formErrors?: Record<string, string[]>;
}

export default function InfoTemplateBuilder(props: Readonly<Props>) {
  const { subsheet, subsheetIndex, onFieldsChange, isEditMode, formErrors = {} } = props;

  const safeFields = React.useMemo(() => subsheet.fields ?? [], [subsheet.fields]);

  const [localOptionValues, setLocalOptionValues] = React.useState<string[]>(
    safeFields.map((t) => t.options?.join(", ") || "")
  );

  React.useEffect(() => {
    setLocalOptionValues(safeFields.map((t) => t.options?.join(", ") || ""));
  }, [safeFields]);

  const handleLocalChange = (index: number, value: string) => {
    const updated = [...localOptionValues];
    updated[index] = value;
    setLocalOptionValues(updated);
  };

  const handleOptionBlur = (index: number) => {
    const raw = localOptionValues[index];
    const parsed = raw
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    const updatedFields = [...subsheet.fields];
    updatedFields[index] = {
      ...updatedFields[index],
      options: parsed,
    };

    onFieldsChange(updatedFields);
  };

  const handleChange = <K extends keyof InfoField>(
    index: number,
    field: K,
    value: InfoField[K]
  ) => {
    const updated = [...subsheet.fields];
    updated[index] = { ...updated[index], [field]: value };
    onFieldsChange(updated);
  };

  const handleAdd = () => {
    const newField: InfoField = {
      label: "",
      infoType: "varchar",
      uom: "",
      required: false,
      sortOrder: subsheet.fields.length + 1,
      options: [],
    };

    const updated = [...subsheet.fields, newField];
    onFieldsChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = subsheet.fields.filter((_, i) => i !== index);
    onFieldsChange(updated);
  };

  const handleMove = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= subsheet.fields.length) return;
    const updated = [...subsheet.fields];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    onFieldsChange(updated);
  };

  return (
    <div className="space-y-4">
      {subsheet.fields.map((field, index) => {
        const base = `subsheets.${subsheetIndex}.fields.${index}`;
        const getError = (key: keyof InfoField) => formErrors?.[`${base}.${key}`]?.[0];

        // Stable input ids for a11y labels
        const idLabel = `fld-${subsheetIndex}-${index}-label`;
        const idType = `fld-${subsheetIndex}-${index}-type`;
        const idUom = `fld-${subsheetIndex}-${index}-uom`;
        const idAllowed = `fld-${subsheetIndex}-${index}-allowed`;
        const idRequired = `fld-${subsheetIndex}-${index}-required`;

        return (
          <div
            key={`so:${field.sortOrder}`} // ✅ stable key (no array index)
            className="border p-3 rounded bg-gray-50 shadow-md space-y-2"
          >
            {isEditMode && (
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  title="Move Up"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  className="p-1 hover:bg-gray-100 border rounded"
                >
                  <ChevronUpIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  title="Move Down"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === subsheet.fields.length - 1}
                  className="p-1 hover:bg-gray-100 border rounded"
                >
                  <ChevronDownIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => handleDelete(index)}
                  className="p-1 hover:bg-red-100 border rounded"
                >
                  <TrashIcon className="h-4 w-4 text-red-500" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-5 gap-4">
              <div>
                <label htmlFor={idLabel} className="text-sm font-medium">Label</label>
                <input
                  id={idLabel}
                  type="text"
                  value={field.label}
                  onChange={(e) => handleChange(index, "label", e.target.value)}
                  className={`w-full px-2 py-1 border rounded ${getError("label") ? "border-red-500" : ""}`}
                  placeholder="Field Label"
                  disabled={!isEditMode}
                />
                {getError("label") && (
                  <p className="text-xs text-red-500 mt-1">{getError("label")}</p>
                )}
              </div>

              <div>
                <label htmlFor={idType} className="text-sm font-medium">Type</label>
                <select
                  id={idType}
                  value={field.infoType}
                  onChange={(e) => handleChange(index, "infoType", e.target.value as InfoField["infoType"])}
                  className={`w-full px-2 py-1 border rounded ${getError("infoType") ? "border-red-500" : ""}`}
                  title="Select Field Type"
                  disabled={!isEditMode}
                >
                  <option value="varchar">Text</option>
                  <option value="int">Integer</option>
                  <option value="decimal">Decimal</option>
                </select>
                {getError("infoType") && (
                  <p className="text-xs text-red-500 mt-1">{getError("infoType")}</p>
                )}
              </div>

              <div>
                <label htmlFor={idUom} className="text-sm font-medium">UOM</label>
                <select
                  id={idUom}
                  value={field.uom ?? ""}
                  onChange={(e) => handleChange(index, "uom", e.target.value)}
                  className={`w-full px-2 py-1 border rounded ${getError("uom") ? "border-red-500" : ""}`}
                  title="Select Unit of Measure"
                  disabled={!isEditMode}
                >
                  <option value="">Select UOM</option>
                  {Object.entries(groupedSIUnits).map(([group, units]) => (
                    <optgroup key={group} label={group}>
                      {units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {getError("uom") && (
                  <p className="text-xs text-red-500 mt-1">{getError("uom")}</p>
                )}
              </div>

              <div>
                <label htmlFor={idAllowed} className="text-sm font-medium">Allowed Values</label>
                <input
                  id={idAllowed}
                  type="text"
                  value={localOptionValues[index] || ""}
                  onChange={(e) => handleLocalChange(index, e.target.value)}
                  onBlur={() => handleOptionBlur(index)}
                  placeholder="e.g. Option1, Option2"
                  className="w-full px-2 py-1 border rounded"
                  disabled={!isEditMode}
                />
              </div>

              <div className="flex items-center pt-6">
                <label htmlFor={idRequired} className="text-sm font-medium mr-2">Required</label>
                <input
                  id={idRequired}
                  type="checkbox"
                  title="Required Field"
                  checked={field.required}
                  onChange={(e) => handleChange(index, "required", e.target.checked)}
                  disabled={!isEditMode}
                />
              </div>
            </div>
          </div>
        );
      })}

      {isEditMode && (
        <div className="text-right">
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Info Template
          </button>
        </div>
      )}
    </div>
  );
}
