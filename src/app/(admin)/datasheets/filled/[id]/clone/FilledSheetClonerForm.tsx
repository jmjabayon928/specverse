'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZodError } from 'zod'
import { unifiedSheetSchemaForClone } from '@/validation/sheetSchema'
import { renderInput, renderSelect, renderDate } from '@/components/ui/form/FormHelper'
import FilledSheetSubsheetForm from '../../create/FilledSheetSubsheetForm'
import type { UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'
import type { Option } from '@/domain/shared/commonTypes'

// --- util helpers (mirrors editor, reused here) ---
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

/** Map BE fieldErrors (infoTemplateId + message) to form error keys for inline display. Matches by field.id or field.originalId. */
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

type FieldErrorDisplayItem = {
  subsheetName: string
  fieldLabel: string
  message: string
}

/** Resolve backend fieldErrors to human-readable items (subsheet name, field label, message) for the error banner. */
function getFieldErrorDisplayItems(
  fieldErrors: FieldErrorItem[],
  subsheets: UnifiedSubsheet[]
): FieldErrorDisplayItem[] {
  return fieldErrors.map((err) => {
    const msg = displayMessage(err)
    for (let i = 0; i < subsheets.length; i++) {
      const sub = subsheets[i]
      const field = sub.fields.find(
        (f) => f.id === err.infoTemplateId || f.originalId === err.infoTemplateId
      )
      if (field) {
        return {
          subsheetName: sub.name ?? `Subsheet #${i + 1}`,
          fieldLabel: field.label ?? `Field ${err.infoTemplateId}`,
          message: msg,
        }
      }
    }
    return {
      subsheetName: 'Unknown',
      fieldLabel: `Field ${err.infoTemplateId}`,
      message: msg,
    }
  })
}

/** Build fieldValues keyed by TEMPLATE InfoTemplateID (originalId ?? id) so backend createFilledSheet finds values. Omit keys for null/undefined/blank. Returns skipped count for fields with no id/originalId. */
function buildFieldValueMap(subsheets: UnifiedSubsheet[]): {
  fieldValues: Record<string, string>
  skippedFieldsCount: number
} {
  const fieldValues: Record<string, string> = {}
  let skippedFieldsCount = 0

  for (const subsheet of subsheets) {
    for (const field of subsheet.fields) {
      const templateId = field.originalId ?? field.id
      if (templateId === undefined || templateId === null) {
        skippedFieldsCount += 1
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[FilledSheetClonerForm] Field skipped (no id/originalId):',
            field.label ?? 'unnamed'
          )
        }
        continue
      }
      const raw = field.value
      if (raw === null || raw === undefined) continue
      if (typeof raw === 'string' && raw.trim() === '') continue
      if (field.options && field.options.length > 0) {
        const rawStr = String(raw).trim()
        if (rawStr !== '' && !field.options.includes(rawStr)) continue
      }
      fieldValues[String(templateId)] = String(raw)
    }
  }

  return { fieldValues, skippedFieldsCount }
}

function buildSheetToValidate(
  datasheet: UnifiedSheet,
  fieldValues: Record<string, string>
): UnifiedSheet {
  return {
    ...datasheet,
    subsheets: datasheet.subsheets.map((subsheet) => ({
      ...subsheet,
      fields: subsheet.fields.map((field) => {
        const templateId = field.originalId ?? field.id
        const value = templateId != null ? (fieldValues[String(templateId)] ?? '') : ''
        return { ...field, value: value || '' }
      }),
    })),
  }
}

function validateParsedSheetForClone(
  parsed: UnifiedSheet
): Record<string, string[]> {
  const manualErrors: Record<string, string[]> = {}

  const hasTag =
    parsed.equipmentTagNum != null &&
    String(parsed.equipmentTagNum).trim() !== ''

  if (!hasTag) {
    manualErrors['Equipment Tag Number'] = ['Equipment tag is required.']
  }

  if (parsed.subsheets.length === 0) {
    manualErrors['Subsheet(s)'] = ['At least one subsheet is required.']
    return manualErrors
  }

  for (let i = 0; i < parsed.subsheets.length; i++) {
    const subsheet = parsed.subsheets[i]
    const number = i + 1

    if (subsheet.fields.length === 0) {
      manualErrors[`Subsheet #${number}`] = [
        'At least one information template is required.',
      ]
      continue
    }

    for (let j = 0; j < subsheet.fields.length; j++) {
      const field = subsheet.fields[j]
      const isMissing = field.value === undefined || String(field.value).trim() === ''

      if (field.required && isMissing) {
        const key = `Subsheet #${number} - Template #${j + 1} - value`
        manualErrors[key] = ['This field is required.']
      }
    }
  }

  return manualErrors
}
// -------------------------------------------------------------

interface Props {
  sourceSheetId: number
  defaultValues: UnifiedSheet
  areas: Option[]
  manufacturers: Option[]
  suppliers: Option[]
  categories: Option[]
  clients: Option[]
  projects: Option[]
}

export default function FilledSheetClonerForm(
  props: Readonly<Props>
) {
  const router = useRouter()

  // Start from the given default values, but clear a couple fields that should be unique or versioned
  const initial: UnifiedSheet = {
    ...props.defaultValues,
    sheetId: 0,
    revisionNum: 1,
    equipmentTagNum: '',
  }

  const [initialBuild] = useState(() => buildFieldValueMap(initial.subsheets))
  const [datasheet, setDatasheet] = useState<UnifiedSheet>(initial)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initialBuild.fieldValues
  )
  const [lastFieldErrors, setLastFieldErrors] = useState<FieldErrorItem[] | null>(null)
  const skippedFieldsCount = initialBuild.skippedFieldsCount

  const handleChange = <K extends keyof UnifiedSheet>(
    field: K,
    value: UnifiedSheet[K]
  ) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }))
  }

  const handleFieldValueChange = (
    subsheetIndex: number,
    infoTemplateId: number,
    value: string
  ) => {
    setFieldValues((prev) => ({ ...prev, [String(infoTemplateId)]: value }))

    setDatasheet((prev) => {
      const updatedSubsheets = [...prev.subsheets]
      const targetSubsheet = { ...updatedSubsheets[subsheetIndex] }
      const templateId = infoTemplateId
      targetSubsheet.fields = targetSubsheet.fields.map((field) =>
        (field.originalId ?? field.id) === templateId ? { ...field, value } : field
      )
      updatedSubsheets[subsheetIndex] = targetSubsheet
      return { ...prev, subsheets: updatedSubsheets }
    })
  }

  // --- Uniqueness check helpers (Equipment Tag) ---
  const [tagExists, setTagExists] = useState<boolean | null>(null)
  const [checkingTag, setCheckingTag] = useState(false)

  useEffect(() => {
    const tag = String(datasheet.equipmentTagNum ?? '').trim()

    if (tag.length === 0) {
      setTagExists(null)
      return
    }

    const controller = new AbortController()
    setCheckingTag(true)

    const query = new URLSearchParams({
      tag,
      projectId: String(datasheet.projectId ?? ''),
    })

    fetch(`/api/backend/filledsheets/check-equipment-tag?${query.toString()}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then(async (response) => {
        if (!response.ok) {
          setTagExists(null)
          return
        }

        const body = await response.json()
        setTagExists(body.exists === true)
      })
      .catch(() => {
        setTagExists(null)
      })
      .finally(() => {
        setCheckingTag(false)
      })

    return () => controller.abort()
  }, [datasheet.equipmentTagNum, datasheet.projectId])

  const tagFeedback = useMemo(() => {
    if (checkingTag) {
      return 'Checking tag…'
    }

    if (tagExists === true) {
      return <span className='text-red-600'>This tag already exists.</span>
    }

    if (tagExists === false) {
      return <span className='text-green-600'>Tag is available.</span>
    }

    return null
  }, [checkingTag, tagExists])

  const handleSubmit = async () => {
    setLastFieldErrors(null)
    try {
      const sheetToValidate = buildSheetToValidate(datasheet, fieldValues)
      const result = unifiedSheetSchemaForClone.safeParse(sheetToValidate)

      if (!result.success) {
        setFormErrors(flattenErrors(result.error))
        return
      }

      const parsed = result.data
      const manualErrors = validateParsedSheetForClone(parsed)

      if (tagExists) {
        manualErrors['Equipment Tag Number'] = [
          'This tag already exists. Please choose a unique tag.',
        ]
      }

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors)
        return
      }

      const payload = {
        ...datasheet,
        fieldValues,
      }

      if (process.env.NODE_ENV !== 'production') {
        const sample = Object.entries(fieldValues).slice(0, 10)
        console.debug('[FilledSheetClonerForm] clone submit', {
          sourceSheetId: props.sourceSheetId,
          templateId: datasheet.templateId,
          fieldValuesKeyCount: Object.keys(fieldValues).length,
          fieldValuesSample: sample,
        })
      }

      const response = await fetch(`/api/backend/filledsheets/${props.sourceSheetId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 400 && Array.isArray(body.fieldErrors)) {
          const fieldErrorsList = body.fieldErrors as FieldErrorItem[]
          setLastFieldErrors(fieldErrorsList)
          const mapped = mapFieldErrorsToFormErrors(fieldErrorsList, datasheet.subsheets)
          setFormErrors(mapped)
          const firstKey = Object.keys(mapped)[0]
          if (firstKey) {
            requestAnimationFrame(() => {
              const el = document.querySelector(`[data-error-key="${CSS.escape(firstKey)}"]`)
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
              }
            })
          }
          return
        }
        setFormErrors({ Unknown: [body.error ?? 'Create failed'] })
        return
      }

      router.push(`/datasheets/filled/${body.sheetId}?success=cloned`)
    } catch (err) {
      if (err instanceof ZodError) {
        setFormErrors(flattenErrors(err))
      } else {
        const message = err instanceof Error ? err.message : 'Create failed.'
        setFormErrors({ Unknown: [message] })
      }

      console.error('❌ Clone submit error:', err)
    }
  }

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-semibold'>Clone Filled Sheet</h1>

      <div className='p-4 bg-blue-50 text-blue-800 border border-blue-200 rounded text-sm' role='status'>
        Template structure and units (UOM) are inherited from the template. Cloning creates a new filled sheet; edit values and identity fields only.
      </div>

      {skippedFieldsCount > 0 && (
        <div className='p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded text-sm' role='alert'>
          Some fields could not be copied because they have no identifier. They will use template defaults.
        </div>
      )}

      {formErrors && Object.keys(formErrors).length > 0 && (
        <div className='p-4 bg-red-100 text-red-700 border border-red-400 rounded' role='alert'>
          <ul className='list-disc pl-5 space-y-1'>
            {lastFieldErrors && lastFieldErrors.length > 0
              ? getFieldErrorDisplayItems(lastFieldErrors, datasheet.subsheets).map(
                  (item, idx) => (
                    <li key={idx}>
                      <strong>{item.subsheetName} – {item.fieldLabel}</strong>: {item.message}
                    </li>
                  )
                )
              : Object.entries(formErrors).map(([key, messages]) => (
                  <li key={key}>
                    <strong>{key}</strong>: {messages.join(', ')}
                  </li>
                ))}
          </ul>
        </div>
      )}

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Datasheet Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Sheet Name', 'sheetName', datasheet, handleChange, false, formErrors)}
          {renderInput('Sheet Description', 'sheetDesc', datasheet, handleChange, false, formErrors)}
          {renderInput('Additional Description', 'sheetDesc2', datasheet, handleChange, false, formErrors)}
          {renderInput('Client Doc #', 'clientDocNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput(
            'Client Project #',
            'clientProjectNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderInput(
            'Company Doc #',
            'companyDocNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderInput(
            'Company Project #',
            'companyProjectNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderSelect('Area', 'areaId', datasheet, handleChange, false, props.areas, formErrors)}
          {renderInput('Package Name', 'packageName', datasheet, handleChange, false, formErrors)}
          {renderInput('Revision Number', 'revisionNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderDate('Revision Date', 'revisionDate', datasheet, handleChange, false, formErrors)}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Equipment Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Equipment Name', 'equipmentName', datasheet, handleChange, false, formErrors)}
          <div>
            {renderInput(
              'Equipment Tag Number',
              'equipmentTagNum',
              datasheet,
              handleChange,
              false,
              formErrors
            )}
            <div className='text-xs mt-1'>{tagFeedback}</div>
          </div>
          {renderInput('Service Name', 'serviceName', datasheet, handleChange, false, formErrors)}
          {renderInput(
            'Required Quantity',
            'requiredQty',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderInput('Item Location', 'itemLocation', datasheet, handleChange, false, formErrors)}
          {renderSelect(
            'Manufacturer',
            'manuId',
            datasheet,
            handleChange,
            false,
            props.manufacturers,
            formErrors
          )}
          {renderSelect('Supplier', 'suppId', datasheet, handleChange, false, props.suppliers, formErrors)}
          {renderInput('Install Package #', 'installPackNum', datasheet, handleChange, false, formErrors)}
          {renderInput('Equipment Size', 'equipSize', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Model Number', 'modelNum', datasheet, handleChange, false, formErrors)}
          {renderInput('Driver', 'driver', datasheet, handleChange, false, formErrors)}
          {renderInput('Location DWG', 'locationDwg', datasheet, handleChange, false, formErrors)}
          {renderInput('PID', 'pid', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Install DWG', 'installDwg', datasheet, handleChange, false, formErrors)}
          {renderInput('Code Standard', 'codeStd', datasheet, handleChange, false, formErrors)}
          {renderSelect(
            'Category',
            'categoryId',
            datasheet,
            handleChange,
            false,
            props.categories,
            formErrors
          )}
          {renderSelect('Client', 'clientId', datasheet, handleChange, false, props.clients, formErrors)}
          {renderSelect('Project', 'projectId', datasheet, handleChange, false, props.projects, formErrors)}
        </div>
      </fieldset>

      <div className='mt-6'>
        <h2 className='text-lg font-semibold mb-2'>Subsheet(s)</h2>
        {datasheet.subsheets.map((subsheet, index) => (
          <FilledSheetSubsheetForm
            key={subsheet.id ?? index}
            subsheet={subsheet}
            subsheetIndex={index}
            fieldValues={fieldValues}
            onFieldValueChange={handleFieldValueChange}
            formErrors={formErrors}
            valueKeyPreferTemplateId
          />
        ))}
      </div>

      <div className='flex justify-end'>
        <button
          onClick={handleSubmit}
          className='px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700'
        >
          Create Cloned Sheet
        </button>
      </div>
    </div>
  )
}
