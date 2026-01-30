// src/components/datasheets/templates/edit/TemplateEditorForm.tsx

'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZodError } from 'zod'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
import { renderInput, renderSelect, renderDate } from '@/components/ui/form/FormHelper'
import SubsheetBuilder from '../../create/SubsheetBuilder'
import type { UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'
import type { Option } from '@/domain/shared/commonTypes'

type TemplateEditorFormProps = {
  defaultValues: UnifiedSheet
  areas: Option[]
  manufacturers: Option[]
  suppliers: Option[]
  categories: Option[]
  clients: Option[]
  projects: Option[]
  session: string
}

const fieldPathRegex = /^subsheets\.(\d+)\.fields\.(\d+)\.(.+)$/
const subsheetPathRegex = /^subsheets\.(\d+)\.(.+)$/

const flattenErrors = (error: ZodError): Record<string, string[]> => {
  const flattened: Record<string, string[]> = {}

  for (const issue of error.errors) {
    if (issue.path === undefined || issue.path.length === 0) {
      continue
    }

    const path = issue.path.join('.')

    if (path.startsWith('subsheets.')) {
      const fieldMatch = fieldPathRegex.exec(path)
      if (fieldMatch) {
        const [, subsheetIndexStr, templateIndexStr, field] = fieldMatch
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1
        const templateIndex = Number.parseInt(templateIndexStr, 10) + 1
        const key = `Subsheet #${subsheetIndex} - Template #${templateIndex} - ${field}`
        flattened[key] = [issue.message]
        continue
      }

      const subsheetMatch = subsheetPathRegex.exec(path)
      if (subsheetMatch) {
        const [, subsheetIndexStr, field] = subsheetMatch
        const subsheetIndex = Number.parseInt(subsheetIndexStr, 10) + 1
        const key = `Subsheet #${subsheetIndex} - ${field}`
        flattened[key] = [issue.message]
        continue
      }
    }

    flattened[path] = [issue.message]
  }

  return flattened
}

const buildManualErrors = (validated: UnifiedSheet): Record<string, string[]> => {
  const manualErrors: Record<string, string[]> = {}

  if (validated.subsheets.length === 0) {
    manualErrors['Subsheet(s)'] = ['At least one subsheet is required.']
    return manualErrors
  }

  let index = 0
  for (const subsheet of validated.subsheets) {
    const displayIndex = index + 1

    if (subsheet.fields.length === 0) {
      manualErrors[`Subsheet #${displayIndex}`] = [
        'At least one information template is required in this subsheet.',
      ]
    }

    index += 1
  }

  return manualErrors
}

export default function TemplateEditorForm(props: Readonly<TemplateEditorFormProps>) {
  const {
    defaultValues,
    areas,
    manufacturers,
    suppliers,
    categories,
    clients,
    projects,
    session,
  } = props

  const router = useRouter()

  const [datasheet, setDatasheet] = useState<UnifiedSheet>(defaultValues)
  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [disciplineOptions, setDisciplineOptions] = useState<Option[]>([])
  const [subtypesRaw, setSubtypesRaw] = useState<Array<{ id: number; disciplineId: number; name: string }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/backend/templates/reference-options', {
          credentials: 'include',
        })
        const payload = await response.json()
        if (!response.ok || payload == null) return
        const disciplines = Array.isArray(payload.disciplines) ? payload.disciplines : []
        const subtypes = Array.isArray(payload.subtypes) ? payload.subtypes : []
        setDisciplineOptions(disciplines.map((d: { id: number; name: string }) => ({ value: d.id, label: d.name })))
        setSubtypesRaw(subtypes)
      } catch (error) {
        console.error('Failed to load discipline/subtype options', error)
      }
    }
    void load()
  }, [])

  const handleChange = <K extends keyof UnifiedSheet>(field: K, value: UnifiedSheet[K]) => {
    setDatasheet((previous) => {
      const next = { ...previous, [field]: value }
      if (field === 'disciplineId') {
        next.subtypeId = undefined
      }
      return next
    })
  }

  const subtypeOptions: Option[] =
    datasheet.disciplineId != null && datasheet.disciplineId > 0
      ? subtypesRaw
          .filter((s) => s.disciplineId === datasheet.disciplineId)
          .map((s) => ({ value: s.id, label: s.name }))
      : []

  const handleSubsheetsChange = (subsheets: UnifiedSubsheet[]) => {
    setDatasheet((previous) => ({
      ...previous,
      subsheets,
    }))
  }

  const handleSubmit = async () => {
    try {
      const parseResult = unifiedSheetSchema.safeParse(datasheet)

      if (!parseResult.success) {
        setFormErrors(flattenErrors(parseResult.error))
        return
      }

      const validated = parseResult.data
      const manualErrors = buildManualErrors(validated)

      if (Object.keys(manualErrors).length > 0) {
        setFormErrors(manualErrors)
        return
      }

      const sheetId = validated.sheetId
      const response = await fetch(`/api/backend/templates/${sheetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validated),
      })

      const payload = await response.json()
      if (!response.ok) {
        const message = payload?.error ?? 'Update failed'
        throw new Error(message)
      }

      router.push(`/datasheets/templates/${payload.sheetId}`)
    } catch (error) {
      if (error instanceof ZodError) {
        setFormErrors(flattenErrors(error))
      } else {
        const message = error instanceof Error ? error.message : 'Update failed'
        setFormErrors({
          Unknown: [message],
        })
      }

      console.error('Template update error', error)
    }
  }

  const hasErrors = Object.keys(formErrors).length > 0
  const safeSession = typeof session === 'string' ? session : ''

  return (
    <div className='space-y-6' data-has-session={safeSession.length > 0 ? '1' : '0'}>
      <h1 className='text-xl font-semibold'>Edit Template</h1>

      {hasErrors && (
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
        <legend className='text-md font-semibold px-2'>Discipline</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderSelect(
            'Discipline',
            'disciplineId',
            { ...datasheet, disciplineId: datasheet.disciplineId ?? 0 },
            (_, value) => handleChange('disciplineId', value === 0 ? undefined : value),
            false,
            disciplineOptions,
            formErrors
          )}
          {renderSelect(
            'Subtype (optional)',
            'subtypeId',
            { ...datasheet, subtypeId: datasheet.subtypeId ?? 0 },
            (_, value) => handleChange('subtypeId', value === 0 ? undefined : value),
            datasheet.disciplineId == null || datasheet.disciplineId <= 0,
            subtypeOptions,
            formErrors
          )}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Datasheet Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Sheet Name', 'sheetName', datasheet, handleChange, false, formErrors)}
          {renderInput('Sheet Description', 'sheetDesc', datasheet, handleChange, false, formErrors)}
          {renderInput(
            'Additional Description',
            'sheetDesc2',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput(
            'Client Doc #',
            'clientDocNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
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
          {renderSelect('Area', 'areaId', datasheet, handleChange, false, areas, formErrors)}
          {renderInput('Package Name', 'packageName', datasheet, handleChange, false, formErrors)}
          {renderInput(
            'Revision Number',
            'revisionNum',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderDate(
            'Revision Date',
            'revisionDate',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Equipment Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput(
            'Equipment Name',
            'equipmentName',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput(
            'Equipment Tag #',
            'equipmentTagNum',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput('Service Name', 'serviceName', datasheet, handleChange, false, formErrors)}
          {renderSelect(
            'Category',
            'categoryId',
            datasheet,
            handleChange,
            false,
            categories,
            formErrors
          )}
          {renderSelect(
            'Manufacturer',
            'manuId',
            datasheet,
            handleChange,
            false,
            manufacturers,
            formErrors
          )}
          {renderSelect(
            'Supplier',
            'suppId',
            datasheet,
            handleChange,
            false,
            suppliers,
            formErrors
          )}
          {renderInput(
            'Equipment Size',
            'equipSize',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderInput('Model #', 'modelNum', datasheet, handleChange, false, formErrors)}
          {renderInput('Driver', 'driver', datasheet, handleChange, false, formErrors)}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Project & Location</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderSelect('Client', 'clientId', datasheet, handleChange, false, clients, formErrors)}
          {renderSelect(
            'Project',
            'projectId',
            datasheet,
            handleChange,
            false,
            projects,
            formErrors
          )}
          {renderInput(
            'Item Location',
            'itemLocation',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput(
            'Required Quantity',
            'requiredQty',
            datasheet,
            handleChange,
            false,
            formErrors,
            'number'
          )}
          {renderInput('Code / Std', 'codeStd', datasheet, handleChange, false, formErrors)}
          {renderInput(
            'Location DWG',
            'locationDwg',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput('PID #', 'pid', datasheet, handleChange, false, formErrors, 'number')}
          {renderInput(
            'Install DWG',
            'installDwg',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
          {renderInput(
            'Install Package #',
            'installPackNum',
            datasheet,
            handleChange,
            false,
            formErrors
          )}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Subsheet Templates</legend>
        
        <div className='p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 rounded mb-4'>
          <p className='text-sm font-medium'>
            Template structure editing is temporarily disabled. You can edit metadata above, but subsheet and field structure changes will not be saved yet.
          </p>
        </div>

        <SubsheetBuilder
          subsheets={datasheet.subsheets}
          onChange={handleSubsheetsChange}
          formErrors={formErrors}
          mode='edit'
          previewMode={false}
          readOnly={true}
        />
      </fieldset>

      <div className='flex justify-end'>
        <button
          type='button'
          className='px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700'
          onClick={handleSubmit}
        >
          Save Changes
        </button>
      </div>
    </div>
  )
}
