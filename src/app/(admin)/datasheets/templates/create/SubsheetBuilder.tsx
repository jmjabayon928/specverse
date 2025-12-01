// src/components/datasheets/templates/create/SubsheetBuilder.tsx

"use client";

import React from "react";
import InfoTemplateBuilder from "./InfoTemplateBuilder";
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import type { SheetMode, UnifiedSubsheet, InfoField } from "@/domain/datasheets/sheetTypes";

interface Props {
  subsheets: UnifiedSubsheet[];
  onChange: (updated: UnifiedSubsheet[]) => void;
  formErrors?: Record<string, string[]>;
  mode: SheetMode;
  previewMode: boolean;
  readOnly: boolean;
}

export default function SubsheetBuilder(props: Readonly<Props>) {
  const { subsheets,
  onChange,
  formErrors = {},
  mode,
  previewMode, } = props;
  const isEditMode = mode === "create" || mode === "edit";

  // Stable key mapping for subsheets to avoid array-index keys
  const keyMapRef = React.useRef(new WeakMap<UnifiedSubsheet, string>());
  const getKey = (s: UnifiedSubsheet, idx: number): string => {
    if (typeof s.id === "number") return `id:${s.id}`;
    let k = keyMapRef.current.get(s);
    if (!k) {
      k = `tmp:${idx}-${Date.now()}`;
      keyMapRef.current.set(s, k);
    }
    return k;
  };

  const handleRename = (index: number, name: string) => {
    const updated = [...subsheets];
    updated[index].name = name;
    onChange(updated);
  };

  const handleAdd = () => {
    const updated = [
      ...subsheets,
      {
        id: Date.now(),
        name: "",
        fields: [],
      },
    ];
    onChange(updated);
  };

  const handleDelete = (index: number) => {
    const updated = subsheets.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleMove = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= subsheets.length) return;

    const updated = [...subsheets];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    onChange(updated);
  };

  const handleFieldsChange = (index: number, fields: InfoField[]) => {
    const updated = [...subsheets];
    updated[index].fields = fields;
    onChange(updated);
  };

  return (
    <div className="space-y-6">
      {subsheets.map((subsheet, index) => {
        const base = `subsheets.${index}`;
        const getError = (field: string) => formErrors?.[`${base}.${field}`]?.[0];

        return (
          <div
            key={getKey(subsheet, index)}
            className="border rounded p-4 bg-white shadow space-y-4"
          >
            <div className="flex justify-between items-center">
              <input
                type="text"
                value={subsheet.name}
                onChange={(e) => handleRename(index, e.target.value)}
                disabled={!isEditMode || previewMode}
                placeholder="Subsheet Name"
                className={`text-lg font-semibold border rounded px-2 py-1 w-full ${
                  getError("name") ? "border-red-500" : ""
                }`}
                title={getError("name")}
              />
              {isEditMode && (
                <div className="flex gap-2 ml-2">
                  <button
                    type="button"
                    title="Move Up"
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className="p-1 border rounded hover:bg-gray-100"
                  >
                    <ChevronUpIcon className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    title="Move Down"
                    onClick={() => handleMove(index, 1)}
                    disabled={index === subsheets.length - 1}
                    className="p-1 border rounded hover:bg-gray-100"
                  >
                    <ChevronDownIcon className="h-4 w-4 text-gray-600" />
                  </button>
                  <button
                    type="button"
                    title="Delete Subsheet"
                    onClick={() => handleDelete(index)}
                    className="p-1 border rounded hover:bg-red-100"
                  >
                    <TrashIcon className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              )}
            </div>

            <InfoTemplateBuilder
              subsheet={subsheet}
              subsheetIndex={index}
              onFieldsChange={(fields) => handleFieldsChange(index, fields)}
              isEditMode={isEditMode && !previewMode}
              formErrors={formErrors}
            />
          </div>
        );
      })}

      {isEditMode && !previewMode && (
        <div className="text-right">
          <button
            type="button"
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            + Add Subsheet
          </button>
        </div>
      )}
    </div>
  );
}
