'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZodError } from 'zod'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
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

function buildSheetToValidate(
  datasheet: UnifiedSheet,
  fieldValues: Record<string, string>
): UnifiedSheet {
  return {
    ...datasheet,
    subsheets: datasheet.subsheets.map((subsheet) => ({
      ...subsheet,
      fields: subsheet.fields.map((field) => ({
        ...field,
        value: fieldValues[field.id?.toString() ?? ''] || '',
      })),
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
        const label = field.label || `Field ${j + 1}`
        const key = `Subsheet #${number} - ${label}`
        manualErrors[key] = ['This field is required.']
      }
    }
  }

  return manualErrors
}
// -------------------------------------------------------------

interface Props {
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

  const [datasheet, setDatasheet] = useState<UnifiedSheet>(initial)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    buildFieldValueMap(initial.subsheets)
  )

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
    try {
      const sheetToValidate = buildSheetToValidate(datasheet, fieldValues)
      const result = unifiedSheetSchema.safeParse(sheetToValidate)

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

      const response = await fetch('/api/backend/filledsheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (response.status === 400 && Array.isArray(body.fieldErrors)) {
          const mapped = mapFieldErrorsToFormErrors(body.fieldErrors, datasheet.subsheets)
          setFormErrors(mapped)
          const firstKey = Object.keys(mapped)[0]
          if (firstKey) {
            requestAnimationFrame(() => {
              document.querySelector(`[data-error-key="${CSS.escape(firstKey)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
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
