// src/components/datasheets/templates/SubsheetTabs.tsx
'use client';

import React from 'react';
import {
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import type { UnifiedSubsheet } from "@/types/sheet";

type Props = {
  subsheets: UnifiedSubsheet[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onRename: (index: number, newName: string) => void;
  onAdd: () => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  children: React.ReactNode;
};

export default function SubsheetTabs({
  subsheets,
  activeIndex,
  setActiveIndex,
  onRename,
  onAdd,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: Props) {
  return (
    <div className="flex gap-4">
      {/* Left column: Vertical tab list */}
      <div className="w-64 border rounded-md bg-white shadow-sm p-2 space-y-2">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-blue-700">Subsheet Tabs</h3>
          <button type="button" onClick={onAdd} className="text-green-600 hover:underline text-sm">
            <PlusIcon className="w-4 h-4 inline" /> Add
          </button>
        </div>

        {subsheets.map((sheet, index) => (
          <div
            key={sheet.id}
            className={`p-2 rounded border text-sm cursor-pointer ${
              index === activeIndex ? 'bg-blue-100 border-blue-500 font-semibold' : 'hover:bg-gray-100'
            }`}
            onClick={() => setActiveIndex(index)}
          >
            <input
              type="text"
              value={sheet.name}
              onChange={(e) => onRename(index, e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-sm font-medium"
              aria-label='Subsheet name'
            />
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <div className="flex gap-1">
                <button
                  type="button"
                  title='Move up'
                  disabled={index === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveUp(index);
                  }}
                >
                  <ChevronUpIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title='Move down'
                  disabled={index === subsheets.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveDown(index);
                  }}
                >
                  <ChevronDownIcon className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                title='Delete subsheet'
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(index);
                }}
              >
                <TrashIcon className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Right column: Content area */}
      <div className="flex-1">{children}</div>
    </div>
  );
}
