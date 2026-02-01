// src/components/datasheets/templates/create/SubsheetBuilder.tsx

'use client'

import React from 'react'
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import InfoTemplateBuilder from './InfoTemplateBuilder'
import type { SheetMode, UnifiedSubsheet, InfoField } from '@/domain/datasheets/sheetTypes'

type SubsheetBuilderProps = {
  subsheets: UnifiedSubsheet[]
  onChange: (subsheets: UnifiedSubsheet[]) => void
  formErrors?: Record<string, string[]>
  mode: SheetMode
  previewMode: boolean
  readOnly: boolean
  /** When provided, called after rename so parent can persist (e.g. PATCH subsheet). */
  onRenameSubsheet?: (index: number, name: string) => void | Promise<void>
  /** When provided, called after reorder so parent can persist (e.g. PUT subsheets/order). */
  onReorderSubsheets?: (subsheets: UnifiedSubsheet[]) => void | Promise<void>
  /** When provided, called instead of local delete; parent shows modal, calls API, then updates state. */
  onDeleteSubsheet?: (index: number) => void | Promise<void>
  /** When provided, called instead of local add; parent calls API then adds subsheet to state. */
  onAddSubsheet?: () => void | Promise<void>
  /** When provided, called after field add so parent can persist (POST field). */
  onAddField?: (subsheetIndex: number, field: InfoField) => void | Promise<void>
  /** When provided, called after field edit so parent can persist (PATCH field). */
  onUpdateField?: (subsheetIndex: number, fieldIndex: number, field: InfoField) => void | Promise<void>
  /** When provided, called after field delete so parent can persist (DELETE field). */
  onDeleteField?: (subsheetIndex: number, fieldIndex: number) => void | Promise<void>
  /** When provided, called after field reorder so parent can persist (PATCH orderIndex). */
  onReorderFields?: (subsheetIndex: number, fields: InfoField[]) => void | Promise<void>
}

const buildSubsheetError = (
  formErrors: Record<string, string[]>,
  index: number,
  field: string
): string | undefined => {
  const key = `subsheets.${index}.${field}`
  const messages = formErrors[key]
  if (messages === undefined || messages.length === 0) {
    return undefined
  }

  return messages[0]
}

const createEmptySubsheet = (): UnifiedSubsheet => ({
  id: Date.now(),
  name: '',
  fields: [],
})

const renameSubsheet = (subsheets: UnifiedSubsheet[], index: number, name: string) => {
  const updated = [...subsheets]
  updated[index] = {
    ...updated[index],
    name,
  }
  return updated
}

const removeSubsheetAt = (subsheets: UnifiedSubsheet[], index: number) =>
  subsheets.filter((_, currentIndex) => currentIndex !== index)

const moveSubsheet = (subsheets: UnifiedSubsheet[], index: number, direction: number) => {
  const nextIndex = index + direction
  const lastIndex = subsheets.length - 1

  const isOutOfRange = nextIndex < 0 || nextIndex > lastIndex
  if (isOutOfRange) {
    return subsheets
  }

  const updated = [...subsheets]
  const [moved] = updated.splice(index, 1)
  updated.splice(nextIndex, 0, moved)

  return updated
}

const updateFields = (subsheets: UnifiedSubsheet[], index: number, fields: InfoField[]) => {
  const updated = [...subsheets]
  updated[index] = {
    ...updated[index],
    fields,
  }
  return updated
}

export default function SubsheetBuilder(props: Readonly<SubsheetBuilderProps>) {
  const {
    subsheets,
    onChange,
    formErrors = {},
    mode,
    previewMode,
    readOnly,
    onRenameSubsheet,
    onReorderSubsheets,
    onDeleteSubsheet,
    onAddSubsheet,
    onAddField,
    onUpdateField,
    onDeleteField,
    onReorderFields,
  } = props

  const canEdit = (mode === 'create' || mode === 'edit') && !previewMode && !readOnly

  const handleRename = (index: number, name: string) => {
    onChange(renameSubsheet(subsheets, index, name))
    void onRenameSubsheet?.(index, name)
  }

  const handleAdd = () => {
    if (onAddSubsheet) {
      void onAddSubsheet()
    } else {
      onChange([...subsheets, createEmptySubsheet()])
    }
  }

  const handleDelete = (index: number) => {
    if (onDeleteSubsheet) {
      void onDeleteSubsheet(index)
    } else {
      onChange(removeSubsheetAt(subsheets, index))
    }
  }

  const handleMove = (index: number, direction: number) => {
    const next = moveSubsheet(subsheets, index, direction)
    onChange(next)
    void onReorderSubsheets?.(next)
  }

  const handleFieldsChange = (index: number, fields: InfoField[]) => {
    onChange(updateFields(subsheets, index, fields))
  }

  return (
    <div className='space-y-6'>
      {subsheets.map((subsheet, index) => {
        const errorMessage = buildSubsheetError(formErrors, index, 'name')
        const id = subsheet.id ?? index

        return (
          <div
            key={id}
            className='border rounded p-4 bg-white shadow space-y-4'
          >
            <div className='flex justify-between items-center gap-2'>
              <input
                type='text'
                value={subsheet.name}
                onChange={(event) => handleRename(index, event.target.value)}
                disabled={!canEdit}
                placeholder='Subsheet Name'
                className={`text-lg font-semibold border rounded px-2 py-1 w-full ${
                  errorMessage ? 'border-red-500' : ''
                }`}
                title={errorMessage}
              />

              {canEdit && (
                <div className='flex gap-2'>
                  <button
                    type='button'
                    title='Move Up'
                    onClick={() => handleMove(index, -1)}
                    disabled={index === 0}
                    className='p-1 border rounded hover:bg-gray-100 disabled:opacity-50'
                  >
                    <ChevronUpIcon className='h-4 w-4 text-gray-600' />
                  </button>
                  <button
                    type='button'
                    title='Move Down'
                    onClick={() => handleMove(index, 1)}
                    disabled={index === subsheets.length - 1}
                    className='p-1 border rounded hover:bg-gray-100 disabled:opacity-50'
                  >
                    <ChevronDownIcon className='h-4 w-4 text-gray-600' />
                  </button>
                  <button
                    type='button'
                    title='Delete Subsheet'
                    onClick={() => handleDelete(index)}
                    className='p-1 border rounded hover:bg-red-100'
                  >
                    <TrashIcon className='h-4 w-4 text-red-500' />
                  </button>
                </div>
              )}
            </div>

            <InfoTemplateBuilder
              subsheet={subsheet}
              subsheetIndex={index}
              onFieldsChange={(fields) => handleFieldsChange(index, fields)}
              isEditMode={canEdit}
              formErrors={formErrors}
              onAddField={onAddField ? (field) => onAddField(index, field) : undefined}
              onUpdateField={onUpdateField ? (fi, field) => onUpdateField(index, fi, field) : undefined}
              onDeleteField={onDeleteField ? (fi) => onDeleteField(index, fi) : undefined}
              onReorderFields={onReorderFields ? (f) => onReorderFields(index, f) : undefined}
            />
          </div>
        )
      })}

      {canEdit && (
        <button
          type='button'
          className='px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700'
          onClick={handleAdd}
        >
          Add Subsheet
        </button>
      )}
    </div>
  )
}
