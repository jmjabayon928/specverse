// src/components/datasheets/templates/SubsheetBuilder.tsx
'use client';

import React from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import InfoTemplateBuilder from './InfoTemplateBuilder';
import type { Subsheet } from '@/types/datasheetTemplate';

interface Props {
  subsheets: Subsheet[];
  onChange: (subsheets: Subsheet[]) => void;
  isEditMode?: boolean;
  formErrors?: Record<string, string[]>;
}

export default function SubsheetBuilder({
  subsheets,
  onChange,
  isEditMode = true,
  formErrors = {},
}: Props) {
  const handleSubsheetNameChange = (index: number, name: string) => {
    const updated = [...subsheets];
    updated[index].name = name;
    onChange(updated);
  };

  const handleTemplatesChange = (index: number, templates: Subsheet['templates']) => {
    const updated = [...subsheets];
    updated[index].templates = templates;
    onChange(updated);
  };

  const handleAddSubsheet = () => {
    const newSubsheet: Subsheet = {
      id: Date.now(), // temporary ID for frontend only
      name: '',
      templates: [],
    };
    onChange([...subsheets, newSubsheet]);
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

  return (
    <div className="space-y-6">
      {subsheets.map((subsheet, index) => {
        const basePath = `subsheets.${index}.name`;
        const nameError = formErrors[basePath];

        return (
          <fieldset
            key={subsheet.id}
            className="border border-gray-300 rounded shadow-md p-4 bg-white"
          >
            <legend className="text-blue-800 font-semibold px-2">
              {isEditMode ? (
                <div>
                  <input
                    type="text"
                    value={subsheet.name}
                    placeholder="Subsheet Name"
                    onChange={(e) => handleSubsheetNameChange(index, e.target.value)}
                    className={`font-semibold px-2 py-1 border rounded w-full text-sm ${
                      nameError ? 'border-red-500' : ''
                    }`}
                  />
                  {nameError && (
                    <p className="text-red-500 text-xs mt-1">{nameError[0]}</p>
                  )}
                </div>
              ) : (
                subsheet.name
              )}
            </legend>

            {isEditMode && (
              <div className="flex justify-end gap-2 mt-1 mb-3">
                <button
                  type="button"
                  title="Move Up"
                  onClick={() => handleMove(index, -1)}
                  disabled={index === 0}
                  className="p-1 hover:bg-gray-100 border rounded shadow-sm"
                >
                  <ChevronUpIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  title="Move Down"
                  onClick={() => handleMove(index, 1)}
                  disabled={index === subsheets.length - 1}
                  className="p-1 hover:bg-gray-100 border rounded shadow-sm"
                >
                  <ChevronDownIcon className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  type="button"
                  title="Delete Subsheet"
                  onClick={() => handleDelete(index)}
                  className="p-1 hover:bg-red-100 border rounded shadow-sm"
                >
                  <TrashIcon className="h-4 w-4 text-red-500" />
                </button>
              </div>
            )}

            {isEditMode ? (
              <InfoTemplateBuilder
                subsheet={subsheet}
                onTemplatesChange={(newTemplates) => handleTemplatesChange(index, newTemplates)}
                isEditMode
              />
            ) : (
              <table className="w-full mt-3 border">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 border">Label</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">UOM</th>
                    <th className="p-2 border">Allowed Values</th>
                  </tr>
                </thead>
                <tbody>
                  {subsheet.templates.map((t, idx) => (
                    <tr key={idx}>
                      <td className="p-2 border">{t.name}</td>
                      <td className="p-2 border">{t.type}</td>
                      <td className="p-2 border">{t.uom}</td>
                      <td className="p-2 border">
                        {t.options?.length ? t.options.join(", ") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </fieldset>
        );
      })}

      {isEditMode && (
        <div className="text-right mt-4">
          <button
            type="button"
            onClick={handleAddSubsheet}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 shadow"
          >
            + Add Subsheet
          </button>
        </div>
      )}
    </div>
  );
}
