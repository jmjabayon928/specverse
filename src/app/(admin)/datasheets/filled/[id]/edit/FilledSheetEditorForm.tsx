'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZodError } from 'zod'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
import { renderInput, renderSelect, renderDate } from '@/components/ui/form/FormHelper'
import FilledSheetSubsheetForm from '../../create/FilledSheetSubsheetForm'
import SheetCompletenessBanner from '@/components/datasheets/SheetCompletenessBanner'
import { useDatasheetCompleteness } from '@/hooks/useDatasheetCompleteness'
import { getSubsheetKey } from '@/utils/datasheetCompleteness'
import type { UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'
import type { Option } from '@/domain/shared/commonTypes'
import { isFiniteNumericString } from '@/utils/numericFieldHelpers'

interface FilledSheetEditorFormProps {
  defaultValues: UnifiedSheet
  areas: Option[]
  manufacturers: Option[]
  suppliers: Option[]
  categories: Option[]
  clients: Option[]
  projects: Option[]
  /** When true, header/metadata fields are read-only; only InformationValues are editable. */
  readOnlyHeader?: boolean
}

function flattenErrors(zodError: ZodError): Record<string, string[]> {
  const flattened: Record<string, string[]> = {}

  for (const err of zodError.errors) {
    if (err.path == null || err.path.length === 0) {
      continue
    }

    const path = err.path.join('.')

    if (path.startsWith('subsheets.')) {
      const matchField = /subsheets\.(\d+)\.fields\.(\d+)\.(.+)/.exec(path)
      if (matchField) {
        const [, subsheetIndexStr, templateIndexStr, field] = matchField
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1
        const templateIndex = Number.parseInt(templateIndexStr, 10) + 1
        const key = `Subsheet #${subsheetIndex} - Template #${templateIndex} - ${field}`
        flattened[key] = [err.message]
        continue
      }

      const matchSubsheet = /subsheets\.(\d+)\.(.+)/.exec(path)
      if (matchSubsheet) {
        const [, subsheetIndexStr, field] = matchSubsheet
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1
        const key = `Subsheet #${subsheetIndex} - ${field}`
        flattened[key] = [err.message]
        continue
      }
    }

    flattened[path] = [err.message]
  }

  return flattened
}

type FieldErrorItem = {
  infoTemplateId: number
  message: string
  optionsPreview?: string[]
  optionsCount?: number
}

function displayMessage(err: FieldErrorItem): string {
  if (Array.isArray(err.optionsPreview) && err.optionsPreview.length > 0) {
    const list = err.optionsPreview.join(', ')
    const more =
      err.optionsCount != null && err.optionsCount > err.optionsPreview.length
        ? ` and ${err.optionsCount - err.optionsPreview.length} more`
        : ''
    return `Choose one of: ${list}${more}.`
  }
  return err.message
}

/** Map BE fieldErrors (infoTemplateId + message) to form error keys for inline display. Matches by field.id (edit) or field.originalId (clone). */
function mapFieldErrorsToFormErrors(
  fieldErrors: FieldErrorItem[],
  subsheets: UnifiedSubsheet[]
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const err of fieldErrors) {
    const msg = displayMessage(err)
    let found = false
    for (let i = 0; i < subsheets.length; i++) {
      for (let j = 0; j < subsheets[i].fields.length; j++) {
        const field = subsheets[i].fields[j]
        if (field.id === err.infoTemplateId || field.originalId === err.infoTemplateId) {
          const key = `Subsheet #${i + 1} - Template #${j + 1} - value`
          out[key] = [msg]
          found = true
          break
        }
      }
      if (found) break
    }
    if (!found) {
      out['Unknown'] = out['Unknown'] ?? []
      out['Unknown'].push(msg)
    }
  }
  return out
}

function buildFieldValueMap(subsheets: UnifiedSubsheet[]): Record<string, string> {
  const result: Record<string, string> = {}

  for (const subsheet of subsheets) {
    for (const field of subsheet.fields) {
      const hasId = field.id !== undefined
      const hasValue = field.value !== undefined && field.value !== null

      if (hasId && hasValue) {
        result[String(field.id)] = String(field.value)
      }
    }
  }

  return result
}

function validateParsedSheet(parsed: UnifiedSheet): Record<string, string[]> {
  const manualErrors: Record<string, string[]> = {}

  if (parsed.subsheets.length === 0) {
    manualErrors['Subsheet(s)'] = ['At least one subsheet is required.']
    return manualErrors
  }

  for (let i = 0; i < parsed.subsheets.length; i++) {
    const subsheet = parsed.subsheets[i]
    const number = i + 1

    if (subsheet.fields.length === 0) {
      manualErrors[`Subsheet #${number}`] = [
        'At least one information template is required in this subsheet.',
      ]
      continue
    }

    for (let j = 0; j < subsheet.fields.length; j++) {
      const field = subsheet.fields[j]
      const isMissing = field.value === undefined || String(field.value).trim() === ''

      if (field.required && isMissing) {
        const label = field.label || `Field ${j + 1}`
        const key = `Subsheet #${number} - ${label}`
        manualErrors[key] = ['This field is required.']
      }
    }
  }

  return manualErrors
}

/** Validate required int/decimal fields: non-blank and valid number. Returns errors keyed for inline display. */
function validateRequiredNumerics(
  subsheets: UnifiedSubsheet[],
  fieldValues: Record<string, string>
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (let i = 0; i < subsheets.length; i++) {
    const sub = subsheets[i]
    for (let j = 0; j < sub.fields.length; j++) {
      const field = sub.fields[j]
      if (!field.required) continue
      const isNumeric = field.infoType === 'int' || field.infoType === 'decimal'
      if (!isNumeric) continue
      const key = field.id?.toString() ?? ''
      const v = (fieldValues[key] ?? '').trim()
      if (!v) {
        out[`Subsheet #${i + 1} - Template #${j + 1} - value`] = ['This field is required.']
        continue
      }
      if (!isFiniteNumericString(v)) {
        out[`Subsheet #${i + 1} - Template #${j + 1} - value`] = ['Enter a number.']
      }
    }
  }
  return out
}

export default function FilledSheetEditorForm(
  props: Readonly<FilledSheetEditorFormProps>
) {
  const {
    defaultValues,
    areas,
    manufacturers,
    suppliers,
    categories,
    clients,
    projects,
    readOnlyHeader = false,
  } = props

  const headerDisabled = readOnlyHeader

  const router = useRouter()
  const [datasheet, setDatasheet] = useState<UnifiedSheet>(defaultValues)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [formErrorSummary, setFormErrorSummary] = useState<string | null>(null)
  const [headerErrorsByField, setHeaderErrorsByField] = useState<Record<string, string[]>>({})
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    buildFieldValueMap(defaultValues.subsheets)
  )

  // Debounced copy for completeness display only; submit/validation use live fieldValues
  const [debouncedFieldValues, setDebouncedFieldValues] = useState<Record<string, string>>(
    () => buildFieldValueMap(defaultValues.subsheets)
  )

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFieldValues(fieldValues)
    }, 250)
    return () => clearTimeout(t)
  }, [fieldValues])

  const completeness = useDatasheetCompleteness(datasheet.subsheets, debouncedFieldValues)

  const handleChange = useCallback(<K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleFieldValueChange = useCallback((subsheetIndex: number, infoTemplateId: number, value: string) => {
    setFieldValues((prev) => ({ ...prev, [infoTemplateId]: value }))

    setDatasheet((prev) => {
      const updatedSubsheets = [...prev.subsheets]
      const targetSubsheet = { ...updatedSubsheets[subsheetIndex] }

      targetSubsheet.fields = targetSubsheet.fields.map((field) =>
        field.id === infoTemplateId ? { ...field, value } : field
      )

      updatedSubsheets[subsheetIndex] = targetSubsheet
      return { ...prev, subsheets: updatedSubsheets }
    })
  }, [])

  const handleSubmit = async () => {
    setFormErrorSummary(null)
    setHeaderErrorsByField({})
    try {
      const sheetToValidate: UnifiedSheet = {
        ...datasheet,
        subsheets: datasheet.subsheets.map((sub) => ({
          ...sub,
          fields: sub.fields.map((field) => ({
            ...field,
            value: fieldValues[field.id?.toString() ?? ''] || '',
          })),
        })),
      }

      const result = unifiedSheetSchema.safeParse(sheetToValidate)

      if (!result.success) {
        setFormErrors(flattenErrors(result.error))
        return
      }

      const parsed = result.data
      const manualErrors = validateParsedSheet(parsed)

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors)
        return
      }

      const numericErrors = validateRequiredNumerics(datasheet.subsheets, fieldValues)
      if (Object.keys(numericErrors).length > 0) {
        setFormErrors(numericErrors)
        return
      }

      const fieldValuesForPayload: Record<string, string> = {}
      for (const [k, v] of Object.entries(fieldValues)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          fieldValuesForPayload[k] = String(v).trim()
        }
      }

      const payload = {
        ...datasheet,
        fieldValues: fieldValuesForPayload,
      }

      const res = await fetch(`/api/backend/filledsheets/${datasheet.sheetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const resultJson = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 400 && Array.isArray(resultJson.headerFieldErrors) && resultJson.headerFieldErrors.length > 0) {
          const byField: Record<string, string[]> = {}
          for (const item of resultJson.headerFieldErrors as Array<{ field: string; message: string }>) {
            const { field, message } = item
            if (!byField[field]) byField[field] = []
            byField[field].push(message)
          }
          setHeaderErrorsByField(byField)
          const names = (resultJson.headerFieldErrors as Array<{ field: string }>).map((e) => e.field)
          const first3 = names.slice(0, 3).join(', ')
          const more = names.length > 3 ? ` (+${names.length - 3} more)` : ''
          setFormErrorSummary(`Header fields are read-only. Remove changes to: ${first3}${more}.`)
        }
        if (res.status === 400 && Array.isArray(resultJson.fieldErrors)) {
          const mapped = mapFieldErrorsToFormErrors(resultJson.fieldErrors, datasheet.subsheets)
          setFormErrors(mapped)
          const firstKey = Object.keys(mapped)[0]
          if (firstKey) {
            requestAnimationFrame(() => {
              document.querySelector(`[data-error-key="${CSS.escape(firstKey)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            })
          }
          return
        }
        setFormErrors({ Unknown: [resultJson.error ?? 'Update failed'] })
        return
      }

      router.push(`/datasheets/filled/${resultJson.sheetId}?success=updated`)
    } catch (err) {
      if (err instanceof ZodError) {
        setFormErrors(flattenErrors(err))
      } else {
        const message = err instanceof Error ? err.message : 'Update failed.'
        setFormErrors({ Unknown: [message] })
      }

      console.error('❌ Submit error:', err)
    }
  }

  const headerErrors: Record<string, string[]> = { ...formErrors, ...headerErrorsByField }

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-semibold'>Edit Filled Sheet</h1>

      {formErrorSummary && (
        <div className='p-4 bg-red-100 text-red-700 border border-red-400 rounded' role='alert'>
          {formErrorSummary}
        </div>
      )}

      {formErrors && Object.keys(formErrors).length > 0 && (
        <div className='p-4 bg-red-100 text-red-700 border border-red-400 rounded'>
          <ul className='list-disc pl-5 space-y-1'>
            {Object.entries(formErrors).map(([key, messages]) => (
              <li key={key}>
                <strong>{key}</strong>: {messages.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SheetCompletenessBanner
        totalRequired={completeness.totalRequired}
        filledRequired={completeness.filledRequired}
      />

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Datasheet Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Sheet Name', 'sheetName', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Sheet Description', 'sheetDesc', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Additional Description', 'sheetDesc2', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Client Doc #', 'clientDocNum', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderInput('Client Project #', 'clientProjectNum', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderInput('Company Doc #', 'companyDocNum', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderInput(
            'Company Project #',
            'companyProjectNum',
            datasheet,
            handleChange,
            headerDisabled,
            headerErrors,
            'number'
          )}
          {renderSelect('Area', 'areaId', datasheet, handleChange, headerDisabled, areas, headerErrors)}
          {renderInput('Package Name', 'packageName', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Revision Number', 'revisionNum', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderDate('Revision Date', 'revisionDate', datasheet, handleChange, headerDisabled, headerErrors)}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Equipment Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Equipment Name', 'equipmentName', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Equipment Tag Number', 'equipmentTagNum', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Service Name', 'serviceName', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput(
            'Required Quantity',
            'requiredQty',
            datasheet,
            handleChange,
            headerDisabled,
            headerErrors,
            'number'
          )}
          {renderInput('Item Location', 'itemLocation', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderSelect('Manufacturer', 'manuId', datasheet, handleChange, headerDisabled, manufacturers, headerErrors)}
          {renderSelect('Supplier', 'suppId', datasheet, handleChange, headerDisabled, suppliers, headerErrors)}
          {renderInput('Install Package #', 'installPackNum', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Equipment Size', 'equipSize', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderInput('Model Number', 'modelNum', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Driver', 'driver', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Location DWG', 'locationDwg', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('PID', 'pid', datasheet, handleChange, headerDisabled, headerErrors, 'number')}
          {renderInput('Install DWG', 'installDwg', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderInput('Code Standard', 'codeStd', datasheet, handleChange, headerDisabled, headerErrors)}
          {renderSelect('Category', 'categoryId', datasheet, handleChange, headerDisabled, categories, headerErrors)}
          {renderSelect('Client', 'clientId', datasheet, handleChange, headerDisabled, clients, headerErrors)}
          {renderSelect('Project', 'projectId', datasheet, handleChange, headerDisabled, projects, headerErrors)}
        </div>
      </fieldset>

      <div className='mt-6'>
        <h2 className='text-lg font-semibold mb-2'>Subsheet(s)</h2>
        {datasheet.subsheets.map((sub, i) => {
          const sectionKey = getSubsheetKey(sub, i)
          const sectionComp = completeness.bySubsheet[sectionKey]
          return (
            <FilledSheetSubsheetForm
              key={sub.id ?? i}
              subsheet={sub}
              subsheetIndex={i}
              fieldValues={fieldValues}
              onFieldValueChange={handleFieldValueChange}
              formErrors={formErrors}
              sectionTotalRequired={sectionComp?.totalRequired}
              sectionFilledRequired={sectionComp?.filledRequired}
              strictNumericValidation
            />
          )
        })}
      </div>

      <div className='flex justify-end'>
        <button
          onClick={handleSubmit}
          className='px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700'
        >
          Update Filled Sheet
        </button>
      </div>
    </div>
  )
}
