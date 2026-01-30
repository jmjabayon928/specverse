'use client'

import React, { useState } from 'react'
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

interface FilledSheetEditorFormProps {
  defaultValues: UnifiedSheet
  areas: Option[]
  manufacturers: Option[]
  suppliers: Option[]
  categories: Option[]
  clients: Option[]
  projects: Option[]
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
  } = props

  const router = useRouter()
  const [datasheet, setDatasheet] = useState<UnifiedSheet>(defaultValues)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    buildFieldValueMap(defaultValues.subsheets)
  )

  const completeness = useDatasheetCompleteness(datasheet.subsheets, fieldValues)

  const handleChange = <K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setDatasheet((prev) => ({ ...prev, [field]: value }))
  }

  const handleFieldValueChange = (subsheetIndex: number, infoTemplateId: number, value: string) => {
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

  const handleSubmit = async () => {
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

      const payload = {
        ...datasheet,
        fieldValues,
      }

      const res = await fetch(`/api/backend/filledsheets/${datasheet.sheetId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const resultJson = await res.json()
      if (!res.ok) {
        throw new Error(resultJson.error || 'Update failed')
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

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-semibold'>Edit Filled Sheet</h1>

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
          {renderInput('Sheet Name', 'sheetName', datasheet, handleChange, false, formErrors)}
          {renderInput('Sheet Description', 'sheetDesc', datasheet, handleChange, false, formErrors)}
          {renderInput('Additional Description', 'sheetDesc2', datasheet, handleChange, false, formErrors)}
          {renderInput('Client Doc #', 'clientDocNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Client Project #', 'clientProjectNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Company Doc #', 'companyDocNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput(
            'Company Project #',
            'companyProjectNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderSelect('Area', 'areaId', datasheet, handleChange, false, areas, formErrors)}
          {renderInput('Package Name', 'packageName', datasheet, handleChange, false, formErrors)}
          {renderInput('Revision Number', 'revisionNum', datasheet, handleChange, false, formErrors, 'number')}
          {renderDate('Revision Date', 'revisionDate', datasheet, handleChange, false, formErrors)}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Equipment Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Equipment Name', 'equipmentName', datasheet, handleChange, false, formErrors)}
          {renderInput('Equipment Tag Number', 'equipmentTagNum', datasheet, handleChange, false, formErrors)}
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
          {renderSelect('Manufacturer', 'manuId', datasheet, handleChange, false, manufacturers, formErrors)}
          {renderSelect('Supplier', 'suppId', datasheet, handleChange, false, suppliers, formErrors)}
          {renderInput('Install Package #', 'installPackNum', datasheet, handleChange, false, formErrors)}
          {renderInput('Equipment Size', 'equipSize', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Model Number', 'modelNum', datasheet, handleChange, false, formErrors)}
          {renderInput('Driver', 'driver', datasheet, handleChange, false, formErrors)}
          {renderInput('Location DWG', 'locationDwg', datasheet, handleChange, false, formErrors)}
          {renderInput('PID', 'pid', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput('Install DWG', 'installDwg', datasheet, handleChange, false, formErrors)}
          {renderInput('Code Standard', 'codeStd', datasheet, handleChange, false, formErrors)}
          {renderSelect('Category', 'categoryId', datasheet, handleChange, false, categories, formErrors)}
          {renderSelect('Client', 'clientId', datasheet, handleChange, false, clients, formErrors)}
          {renderSelect('Project', 'projectId', datasheet, handleChange, false, projects, formErrors)}
        </div>
      </fieldset>

      <div className='mt-6'>
        <h2 className='text-lg font-semibold mb-2'>Subsheet(s)</h2>
        {datasheet.subsheets.map((sub, i) => (
          <FilledSheetSubsheetForm
            key={sub.id ?? i}
            subsheet={sub}
            subsheetIndex={i}
            fieldValues={fieldValues}
            onFieldValueChange={handleFieldValueChange}
            formErrors={formErrors}
            sectionCompleteness={completeness.bySubsheet[getSubsheetKey(sub, i)]}
          />
        ))}
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
