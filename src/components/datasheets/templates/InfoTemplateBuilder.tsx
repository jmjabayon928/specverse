// src/components/datasheets/templates/InfoTemplateBuilder.tsx
'use client';

import React from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Subsheet, TemplateField } from '@/types/datasheetTemplate';
import { groupedSIUnits } from "@/utils/units";

interface Props {
  subsheet: Subsheet;
  onTemplatesChange: (templates: TemplateField[]) => void;
  isEditMode: boolean;
}

export default function InfoTemplateBuilder({
  subsheet,
  onTemplatesChange,
  isEditMode,
}: Props) {
  const handleTemplateChange = (
    templateIndex: number,
    field: keyof TemplateField,
    value: string | number
  ) => {
    const updated = [...subsheet.templates];
    updated[templateIndex] = {
      ...updated[templateIndex],
      [field]: value,
    };
    onTemplatesChange(updated);
  };

  const handleOptionsChange = (templateIndex: number, newOptions: string[]) => {
    const updated = [...subsheet.templates];
    updated[templateIndex].options = newOptions;
    onTemplatesChange(updated);
  };

  const handleAddTemplate = () => {
    const newTemplate: TemplateField = {
      id: Date.now(),
      name: '',
      type: 'varchar',
      uom: '',
      options: [],
    };
    onTemplatesChange([...subsheet.templates, newTemplate]);
  };

  const handleDelete = (index: number) => {
    const updated = subsheet.templates.filter((_, i) => i !== index);
    onTemplatesChange(updated);
  };

  const handleMove = (index: number, direction: number) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= subsheet.templates.length) return;

    const updated = [...subsheet.templates];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    onTemplatesChange(updated);
  };

  if (!isEditMode) return null;

  return (
    <div className="space-y-3">
      {subsheet.templates.map((template, templateIndex) => (
        <div
          key={templateIndex}
          className="border border-gray-200 rounded-md p-3 bg-gray-50"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
            <input
              type="text"
              value={template.name}
              onChange={(e) => handleTemplateChange(templateIndex, 'name', e.target.value)}
              placeholder="Label"
              className="border px-2 py-1 rounded"
            />
            <select
              value={template.type}
              onChange={(e) => handleTemplateChange(templateIndex, 'type', e.target.value)}
              className="border px-2 py-1 rounded"
              aria-label='Type'
            >
              <option value="varchar">Text</option>
              <option value="int">Integer</option>
              <option value="decimal">Decimal</option>
            </select>
            <select
              value={template.uom}
              onChange={(e) => handleTemplateChange(templateIndex, "uom", e.target.value)}
              className="border rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              aria-label="Unit of Measure"
            >
              <option value="">Select UOM</option>
              {Object.entries(groupedSIUnits).map(([category, units]: [string, string[]]) => (
                <optgroup key={category} label={category}>
                  {units.map((unit: string) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex justify-end gap-1">
              <button
                type="button"
                title="Move Up"
                onClick={() => handleMove(templateIndex, -1)}
                disabled={templateIndex === 0}
                className="p-1 hover:bg-gray-100 border rounded shadow-sm"
              >
                <ChevronUpIcon className="h-4 w-4 text-gray-600" />
              </button>
              <button
                type="button"
                title="Move Down"
                onClick={() => handleMove(templateIndex, 1)}
                disabled={templateIndex === subsheet.templates.length - 1}
                className="p-1 hover:bg-gray-100 border rounded shadow-sm"
              >
                <ChevronDownIcon className="h-4 w-4 text-gray-600" />
              </button>
              <button
                type="button"
                title="Delete"
                onClick={() => handleDelete(templateIndex)}
                className="p-1 hover:bg-red-100 border rounded shadow-sm"
              >
                <TrashIcon className="h-4 w-4 text-red-500" />
              </button>
            </div>
          </div>

          {/* Dropdown options */}
          <div className="mt-2 space-y-1">
            {(template.options ?? []).map((opt, optIdx) => (
              <div key={optIdx} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...(template.options ?? [])];
                    newOptions[optIdx] = e.target.value;
                    handleOptionsChange(templateIndex, newOptions);
                  }}
                  placeholder={`Option ${optIdx + 1}`}
                  className="border px-2 py-1 rounded w-full"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newOptions = [...(template.options ?? [])];
                    newOptions.splice(optIdx, 1);
                    handleOptionsChange(templateIndex, newOptions);
                  }}
                  className="px-2 text-sm bg-red-500 text-white rounded"
                >
                  x
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                handleOptionsChange(templateIndex, [...(template.options ?? []), ''])
              }
              className="mt-1 px-3 py-1 text-sm bg-blue-500 text-white rounded"
            >
              + Add Option
            </button>
          </div>
        </div>
      ))}

      {/* Add new template */}
      <div className="text-right mt-4">
        <button
          type="button"
          onClick={handleAddTemplate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          + Add Template
        </button>
      </div>
    </div>
  );
}
