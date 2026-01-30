// src/components/datasheets/templates/create/TemplateCreatorForm.tsx

'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import 'react-datepicker/dist/react-datepicker.css'
import { ZodError } from 'zod'
import { unifiedSheetSchema } from '@/validation/sheetSchema'
import type { UnifiedSheet, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'
import { renderInput, renderSelect, renderDate } from '@/components/ui/form/FormHelper'
import SubsheetBuilder from './SubsheetBuilder'
import type { Option } from '@/domain/shared/commonTypes'

type RefDataItem = {
  id: number
  name: string
}

const fieldPathRegex = /^subsheets\.(\d+)\.fields\.(\d+)\.(.+)$/
const subsheetPathRegex = /^subsheets\.(\d+)\.(.+)$/

const toOptions = (items: RefDataItem[]): Option[] => {
  if (!Array.isArray(items)) {
    return []
  }

  return items.map((item) => ({
    value: item.id,
    label: item.name,
  }))
}

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

export default function TemplateCreatorForm() {
  const router = useRouter()
  const isReadOnly = false

  const [datasheet, setDatasheet] = useState<UnifiedSheet>({
    sheetName: '',
    sheetDesc: '',
    sheetDesc2: '',
    clientDocNum: 0,
    clientProjectNum: 0,
    companyDocNum: 0,
    companyProjectNum: 0,
    areaId: 0,
    packageName: '',
    revisionNum: 1,
    revisionDate: new Date().toISOString().split('T')[0],
    preparedById: 0,
    preparedByDate: new Date().toISOString(),
    status: 'Draft',
    isLatest: true,
    isTemplate: true,
    autoCADImport: false,
    itemLocation: '',
    requiredQty: 1,
    equipmentName: '',
    equipmentTagNum: '',
    serviceName: '',
    manuId: 0,
    suppId: 0,
    installPackNum: '',
    equipSize: 0,
    modelNum: '',
    driver: '',
    locationDwg: '',
    pid: 0,
    installDwg: '',
    codeStd: '',
    categoryId: 0,
    clientId: 0,
    projectId: 0,
    disciplineId: undefined,
    subtypeId: undefined,
    subsheets: [],
  })

  const [formErrors, setFormErrors] = useState<Record<string, string[]>>({})
  const [areas, setAreas] = useState<Option[]>([])
  const [manufacturers, setManufacturers] = useState<Option[]>([])
  const [suppliers, setSuppliers] = useState<Option[]>([])
  const [categories, setCategories] = useState<Option[]>([])
  const [clients, setClients] = useState<Option[]>([])
  const [projects, setProjects] = useState<Option[]>([])
  const [disciplineOptions, setDisciplineOptions] = useState<Option[]>([])
  const [subtypesRaw, setSubtypesRaw] = useState<Array<{ id: number; disciplineId: number; code: string; name: string }>>([])

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const response = await fetch('/api/backend/references')
        const payload = await response.json()

        if (!response.ok || payload === null || payload === undefined) {
          throw new Error('Reference lookup failed')
        }

        setAreas(toOptions(payload.areas))
        setManufacturers(toOptions(payload.manufacturers))
        setSuppliers(toOptions(payload.suppliers))
        setCategories(toOptions(payload.categories))
        setClients(toOptions(payload.clients))
        setProjects(toOptions(payload.projects))
      } catch (error) {
        console.error('Failed to load reference data', error)
      }
    }

    void loadReferences()
  }, [])

  useEffect(() => {
    const loadTemplateReferenceOptions = async () => {
      try {
        const response = await fetch('/api/backend/templates/reference-options', {
          credentials: 'include',
        })
        const payload = await response.json()
        if (!response.ok || payload == null) {
          return
        }
        const disciplines = Array.isArray(payload.disciplines) ? payload.disciplines : []
        const subtypes = Array.isArray(payload.subtypes) ? payload.subtypes : []
        setDisciplineOptions(disciplines.map((d: { id: number; name: string }) => ({ value: d.id, label: d.name })))
        setSubtypesRaw(subtypes)
      } catch (error) {
        console.error('Failed to load discipline/subtype options', error)
      }
    }
    void loadTemplateReferenceOptions()
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

  const buildManualErrors = (validated: UnifiedSheet): Record<string, string[]> => {
    const manualErrors: Record<string, string[]> = {}

    const disciplineIdNum = validated.disciplineId
    if (disciplineIdNum == null || typeof disciplineIdNum !== 'number' || disciplineIdNum <= 0) {
      manualErrors['disciplineId'] = ['Discipline is required.']
    }

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

      const response = await fetch('/api/backend/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validated),
      })

      const payload = await response.json()
      if (!response.ok) {
        const message = payload?.error ?? 'Template creation failed'
        throw new Error(message)
      }

      router.push(`/datasheets/templates/${payload.sheetId}`)
    } catch (error) {
      if (error instanceof ZodError) {
        setFormErrors(flattenErrors(error))
      } else {
        const message = error instanceof Error ? error.message : 'Submission failed'
        setFormErrors({
          Unknown: [message],
        })
      }

      console.error('Template create error', error)
    }
  }

  const hasErrors = Object.keys(formErrors).length > 0

  return (
    <div className='space-y-6'>
      <h1 className='text-xl font-semibold'>Create Template</h1>

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
            isReadOnly,
            disciplineOptions,
            formErrors
          )}
          {renderSelect(
            'Subtype (optional)',
            'subtypeId',
            { ...datasheet, subtypeId: datasheet.subtypeId ?? 0 },
            (_, value) => handleChange('subtypeId', value === 0 ? undefined : value),
            isReadOnly || datasheet.disciplineId == null || datasheet.disciplineId <= 0,
            subtypeOptions,
            formErrors
          )}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Datasheet Details</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderInput('Sheet Name', 'sheetName', datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput('Sheet Description', 'sheetDesc', datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput(
            'Additional Description',
            'sheetDesc2',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Client Doc #',
            'clientDocNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderInput(
            'Client Project #',
            'clientProjectNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderInput(
            'Company Doc #',
            'companyDocNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderInput(
            'Company Project #',
            'companyProjectNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderSelect('Area', 'areaId', datasheet, handleChange, isReadOnly, areas, formErrors)}
          {renderInput(
            'Package Name',
            'packageName',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Revision Number',
            'revisionNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderDate(
            'Revision Date',
            'revisionDate',
            datasheet,
            handleChange,
            isReadOnly,
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
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Equipment Tag #',
            'equipmentTagNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Service Name',
            'serviceName',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderSelect(
            'Category',
            'categoryId',
            datasheet,
            handleChange,
            isReadOnly,
            categories,
            formErrors
          )}
          {renderSelect(
            'Manufacturer',
            'manuId',
            datasheet,
            handleChange,
            isReadOnly,
            manufacturers,
            formErrors
          )}
          {renderSelect(
            'Supplier',
            'suppId',
            datasheet,
            handleChange,
            isReadOnly,
            suppliers,
            formErrors
          )}
          {renderInput(
            'Equipment Size',
            'equipSize',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderInput('Model #', 'modelNum', datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput('Driver', 'driver', datasheet, handleChange, isReadOnly, formErrors)}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Project & Location</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2'>
          {renderSelect('Client', 'clientId', datasheet, handleChange, isReadOnly, clients, formErrors)}
          {renderSelect(
            'Project',
            'projectId',
            datasheet,
            handleChange,
            isReadOnly,
            projects,
            formErrors
          )}
          {renderInput(
            'Item Location',
            'itemLocation',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Required Quantity',
            'requiredQty',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors,
            'number'
          )}
          {renderInput('Code / Std', 'codeStd', datasheet, handleChange, isReadOnly, formErrors)}
          {renderInput(
            'Location DWG',
            'locationDwg',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput('PID #', 'pid', datasheet, handleChange, isReadOnly, formErrors, 'number')}
          {renderInput(
            'Install DWG',
            'installDwg',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
          {renderInput(
            'Install Package #',
            'installPackNum',
            datasheet,
            handleChange,
            isReadOnly,
            formErrors
          )}
        </div>
      </fieldset>

      <fieldset className='border border-gray-300 rounded p-4'>
        <legend className='text-md font-semibold px-2'>Subsheet Templates</legend>
        <SubsheetBuilder
          subsheets={datasheet.subsheets}
          onChange={handleSubsheetsChange}
          formErrors={formErrors}
          mode='create'
          previewMode={false}
          readOnly={false}
        />
      </fieldset>

      <div className='flex justify-end'>
        <button
          type='button'
          className='px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700'
          onClick={handleSubmit}
        >
          Save Template
        </button>
      </div>
    </div>
  )
}
