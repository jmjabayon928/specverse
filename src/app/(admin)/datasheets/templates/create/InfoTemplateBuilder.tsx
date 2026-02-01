// src/components/datasheets/templates/create/InfoTemplateBuilder.tsx

'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { TrashIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { groupedSIUnits } from '@/utils/units'
import type { InfoField } from '@/domain/datasheets/sheetTypes'

type InfoTemplateBuilderProps = {
  subsheet: {
    id?: number
    name: string
    fields: InfoField[]
  }
  subsheetIndex: number
  onFieldsChange: (fields: InfoField[]) => void
  isEditMode: boolean
  formErrors?: Record<string, string[]>
  /** When provided, called after field add so parent can persist. */
  onAddField?: (field: InfoField) => void | Promise<void>
  /** When provided, called after field edit so parent can persist. */
  onUpdateField?: (fieldIndex: number, field: InfoField) => void | Promise<void>
  /** When provided, called after field delete so parent can persist. */
  onDeleteField?: (fieldIndex: number) => void | Promise<void>
  /** When provided, called after field reorder so parent can persist. */
  onReorderFields?: (fields: InfoField[]) => void | Promise<void>
}

const buildFieldError = (
  formErrors: Record<string, string[]>,
  subsheetIndex: number,
  fieldIndex: number,
  key: keyof InfoField
): string | undefined => {
  const base = `subsheets.${subsheetIndex}.fields.${fieldIndex}`
  const messages = formErrors[`${base}.${key}`]
  if (messages === undefined || messages.length === 0) {
    return undefined
  }

  return messages[0]
}

const createEmptyField = (currentCount: number): InfoField => ({
  label: '',
  infoType: 'varchar',
  uom: '',
  required: false,
  sortOrder: currentCount + 1,
  options: [],
})

const updateFieldAt = (
  fields: InfoField[],
  index: number,
  update: Partial<InfoField>
): InfoField[] => {
  const updated = [...fields]
  updated[index] = {
    ...updated[index],
    ...update,
  }
  return updated
}

const removeFieldAt = (fields: InfoField[], index: number) =>
  fields.filter((_, currentIndex) => currentIndex !== index)

const moveField = (fields: InfoField[], index: number, direction: number): InfoField[] => {
  const nextIndex = index + direction
  const lastIndex = fields.length - 1

  const isOutOfRange = nextIndex < 0 || nextIndex > lastIndex
  if (isOutOfRange) {
    return fields
  }

  const updated = [...fields]
  const [moved] = updated.splice(index, 1)
  updated.splice(nextIndex, 0, moved)

  return updated
}

export default function InfoTemplateBuilder(props: Readonly<InfoTemplateBuilderProps>) {
  const {
    subsheet,
    subsheetIndex,
    onFieldsChange,
    isEditMode,
    formErrors = {},
    onAddField,
    onUpdateField,
    onDeleteField,
    onReorderFields,
  } = props

  const fields = useMemo(() => subsheet.fields ?? [], [subsheet.fields])

  const [localOptionValues, setLocalOptionValues] = useState<string[]>(
    fields.map((field) => (field.options ?? []).join(', '))
  )

  useEffect(() => {
    setLocalOptionValues(fields.map((field) => (field.options ?? []).join(', ')))
  }, [fields])

  // groupedSIUnits is a Record<string, string[]>
  // We treat it as [groupLabel, string[]]
  const unitGroups = useMemo(() => Object.entries(groupedSIUnits), [])

  const handleOptionInputChange = (index: number, value: string) => {
    const updated = [...localOptionValues]
    updated[index] = value
    setLocalOptionValues(updated)
  }

  const handleOptionBlur = (index: number) => {
    const raw = localOptionValues[index] ?? ''
    const segments = raw.split(',')
    const parsed: string[] = []

    for (const segment of segments) {
      const trimmed = segment.trim()
      if (trimmed.length > 0) {
        parsed.push(trimmed)
      }
    }

    const updatedFields = updateFieldAt(fields, index, {
      options: parsed,
    })

    onFieldsChange(updatedFields)
    const updated = updatedFields[index]
    if (updated != null) void onUpdateField?.(index, updated)
  }

  const handleFieldChange = <K extends keyof InfoField>(
    index: number,
    key: K,
    value: InfoField[K]
  ) => {
    const updatedFields = updateFieldAt(fields, index, {
      [key]: value,
    })
    onFieldsChange(updatedFields)
    const updated = updatedFields[index]
    if (updated != null) void onUpdateField?.(index, updated)
  }

  const handleAddField = () => {
    const newField = createEmptyField(fields.length)
    if (onAddField) {
      // Parent (e.g. TemplateEditorForm) will call API and add to state on success; avoid double-add.
      void onAddField(newField)
    } else {
      onFieldsChange([...fields, newField])
    }
  }

  const handleDeleteField = (index: number) => {
    onFieldsChange(removeFieldAt(fields, index))
    void onDeleteField?.(index)
  }

  const handleMoveField = (index: number, direction: number) => {
    const next = moveField(fields, index, direction)
    onFieldsChange(next)
    void onReorderFields?.(next)
  }

  return (
    <div className='space-y-4'>
      {fields.map((field, index) => {
        const labelError = buildFieldError(formErrors, subsheetIndex, index, 'label')
        const typeError = buildFieldError(formErrors, subsheetIndex, index, 'infoType')
        const uomError = buildFieldError(formErrors, subsheetIndex, index, 'uom')

        const idPrefix = `fld-${subsheetIndex}-${index}`
        const idLabel = `${idPrefix}-label`
        const idType = `${idPrefix}-type`
        const idUom = `${idPrefix}-uom`
        const idAllowed = `${idPrefix}-allowed`
        const idRequired = `${idPrefix}-required`

        const key = `so:${field.sortOrder}-${index}`

        return (
          <div
            key={key}
            className='border p-3 rounded bg-gray-50 shadow-md space-y-2'
          >
            {isEditMode && (
              <div className='flex justify-end gap-2'>
                <button
                  type='button'
                  title='Move Up'
                  onClick={() => handleMoveField(index, -1)}
                  disabled={index === 0}
                  className='p-1 hover:bg-gray-100 border rounded disabled:opacity-50'
                >
                  <ChevronUpIcon className='h-4 w-4 text-gray-600' />
                </button>
                <button
                  type='button'
                  title='Move Down'
                  onClick={() => handleMoveField(index, 1)}
                  disabled={index === fields.length - 1}
                  className='p-1 hover:bg-gray-100 border rounded disabled:opacity-50'
                >
                  <ChevronDownIcon className='h-4 w-4 text-gray-600' />
                </button>
                <button
                  type='button'
                  title='Delete'
                  onClick={() => handleDeleteField(index)}
                  className='p-1 hover:bg-red-100 border rounded'
                >
                  <TrashIcon className='h-4 w-4 text-red-500' />
                </button>
              </div>
            )}

            <div className='grid grid-cols-5 gap-4'>
              <div>
                <label htmlFor={idLabel} className='text-sm font-medium'>
                  Label
                </label>
                <input
                  id={idLabel}
                  type='text'
                  value={field.label}
                  onChange={(event) => handleFieldChange(index, 'label', event.target.value)}
                  className={`w-full px-2 py-1 border rounded ${
                    labelError ? 'border-red-500' : ''
                  }`}
                  placeholder='Field Label'
                  disabled={!isEditMode}
                />
                {labelError && (
                  <p className='text-xs text-red-500 mt-1'>
                    {labelError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={idType} className='text-sm font-medium'>
                  Type
                </label>
                <select
                  id={idType}
                  value={field.infoType}
                  onChange={(event) =>
                    handleFieldChange(index, 'infoType', event.target.value as InfoField['infoType'])
                  }
                  className={`w-full px-2 py-1 border rounded ${
                    typeError ? 'border-red-500' : ''
                  }`}
                  disabled={!isEditMode}
                >
                  <option value='varchar'>Text</option>
                  <option value='int'>Integer</option>
                  <option value='decimal'>Decimal</option>
                </select>
                {typeError && (
                  <p className='text-xs text-red-500 mt-1'>
                    {typeError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={idUom} className='text-sm font-medium'>
                  UOM
                </label>
                <select
                  id={idUom}
                  value={field.uom}
                  onChange={(event) => handleFieldChange(index, 'uom', event.target.value)}
                  className={`w-full px-2 py-1 border rounded ${
                    uomError ? 'border-red-500' : ''
                  }`}
                  disabled={!isEditMode}
                >
                  <option value=''>None</option>
                  {unitGroups.map(([groupKey, units]) => (
                    <optgroup key={groupKey} label={groupKey}>
                      {units.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {uomError && (
                  <p className='text-xs text-red-500 mt-1'>
                    {uomError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={idAllowed} className='text-sm font-medium'>
                  Allowed Values
                </label>
                <input
                  id={idAllowed}
                  type='text'
                  value={localOptionValues[index] ?? ''}
                  onChange={(event) => handleOptionInputChange(index, event.target.value)}
                  onBlur={() => handleOptionBlur(index)}
                  className='w-full px-2 py-1 border rounded'
                  placeholder='Comma-separated list'
                  disabled={!isEditMode}
                />
              </div>

              <div className='flex items-center'>
                <div className='space-x-2'>
                  <input
                    id={idRequired}
                    type='checkbox'
                    checked={field.required}
                    onChange={(event) => handleFieldChange(index, 'required', event.target.checked)}
                    disabled={!isEditMode}
                  />
                  <label htmlFor={idRequired} className='text-sm font-medium'>
                    Required
                  </label>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {isEditMode && (
        <button
          type='button'
          className='px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700'
          onClick={handleAddField}
        >
          Add Field
        </button>
      )}
    </div>
  )
}
