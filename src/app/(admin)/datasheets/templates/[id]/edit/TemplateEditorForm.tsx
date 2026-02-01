// src/components/datasheets/templates/edit/TemplateEditorForm.tsx

'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZodError } from 'zod'
import toast from 'react-hot-toast'
import { templateEditMetadataSchema } from '@/validation/sheetSchema'
import { structureErrorToast, type StructureErrorBody } from '@/utils/structureErrorToast'
import { renderInput, renderSelect, renderDate } from '@/components/ui/form/FormHelper'
import { Modal } from '@/components/ui/modal'
import SubsheetBuilder from '../../create/SubsheetBuilder'
import type { UnifiedSheet, UnifiedSubsheet, InfoField } from '@/domain/datasheets/sheetTypes'
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
  const [deleteSubsheetIndex, setDeleteSubsheetIndex] = useState<number | null>(null)

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

  const sheetId = datasheet.sheetId
  const subsheets = useMemo(() => datasheet.subsheets ?? [], [datasheet.subsheets])

  const handleSubsheetsChange = useCallback(
    (next: UnifiedSubsheet[]) => {
      setDatasheet((prev) => ({ ...prev, subsheets: next }))
    },
    []
  )

  const api = useCallback(
    (path: string, options?: RequestInit) => {
      if (sheetId == null) return Promise.reject(new Error('No sheet ID'))
      return fetch(`/api/backend/templates/${sheetId}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
      })
    },
    [sheetId]
  )

  const handleRenameSubsheet = useCallback(
    async (index: number, name: string) => {
      const sub = subsheets[index]
      const subId = sub?.originalId ?? sub?.id
      if (subId == null || sheetId == null) return
      try {
        const res = await api(`/subsheets/${subId}`, {
          method: 'PATCH',
          body: JSON.stringify({ subName: name }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to rename subsheet')
        }
      } catch {
        toast.error('Failed to rename subsheet')
      }
    },
    [api, subsheets, sheetId]
  )

  const handleReorderSubsheets = useCallback(
    async (next: UnifiedSubsheet[]) => {
      if (sheetId == null) return
      const order = next.map((s, i) => ({
        subId: s.originalId ?? s.id ?? 0,
        orderIndex: i,
      })).filter((o) => o.subId > 0)
      if (order.length === 0) return
      try {
        const res = await api('/subsheets/order', {
          method: 'PUT',
          body: JSON.stringify({ order }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to reorder subsheets')
        }
      } catch {
        toast.error('Failed to reorder subsheets')
      }
    },
    [api, sheetId]
  )

  const handleDeleteSubsheet = useCallback((index: number) => {
    setDeleteSubsheetIndex(index)
  }, [])

  const confirmDeleteSubsheet = useCallback(async () => {
    const index = deleteSubsheetIndex
    if (index == null || sheetId == null) {
      setDeleteSubsheetIndex(null)
      return
    }
    const sub = subsheets[index]
    const subId = sub?.originalId ?? sub?.id
    if (subId == null) {
      setDeleteSubsheetIndex(null)
      return
    }
    try {
      const res = await api(`/subsheets/${subId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as StructureErrorBody
        structureErrorToast(data, 'Failed to delete subsheet')
        setDeleteSubsheetIndex(null)
        return
      }
      setDatasheet((prev) => ({
        ...prev,
        subsheets: prev.subsheets?.filter((_, i) => i !== index) ?? [],
      }))
      toast.success('Subsheet deleted')
    } catch {
      toast.error('Failed to delete subsheet')
    }
    setDeleteSubsheetIndex(null)
  }, [deleteSubsheetIndex, sheetId, subsheets, api])

  const handleAddSubsheet = useCallback(async () => {
    if (sheetId == null) return
    try {
      const res = await api('/subsheets', {
        method: 'POST',
        body: JSON.stringify({ subName: 'New Subsheet' }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as StructureErrorBody
        structureErrorToast(data, 'Failed to add subsheet')
        return
      }
      const data = (await res.json()) as { subId: number; subName: string; orderIndex: number }
      setDatasheet((prev) => ({
        ...prev,
        subsheets: [...(prev.subsheets ?? []), { originalId: data.subId, name: data.subName, fields: [] }],
      }))
    } catch {
      toast.error('Failed to add subsheet')
    }
  }, [api, sheetId])

  const handleAddField = useCallback(
    async (subsheetIndex: number, field: InfoField) => {
      const sub = subsheets[subsheetIndex]
      const subId = sub?.originalId ?? sub?.id
      if (subId == null || sheetId == null) return
      try {
        const res = await api(`/subsheets/${subId}/fields`, {
          method: 'POST',
          body: JSON.stringify({
            label: field.label || 'Field',
            infoType: field.infoType ?? 'varchar',
            uom: field.uom ?? '',
            required: field.required ?? false,
            options: field.options ?? [],
          }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to add field')
          return
        }
        const data = (await res.json()) as { fieldId: number; label: string; infoType: string; uom: string; required: boolean; orderIndex: number; options: string[] }
        setDatasheet((prev) => {
          const next = [...(prev.subsheets ?? [])]
          const subCopy = { ...next[subsheetIndex], fields: [...(next[subsheetIndex]?.fields ?? [])] }
          subCopy.fields.push({
            originalId: data.fieldId,
            id: data.fieldId,
            label: data.label,
            infoType: data.infoType as InfoField['infoType'],
            uom: data.uom,
            required: data.required,
            sortOrder: data.orderIndex,
            options: data.options ?? [],
          })
          next[subsheetIndex] = subCopy
          return { ...prev, subsheets: next }
        })
      } catch {
        toast.error('Failed to add field')
      }
    },
    [api, subsheets, sheetId]
  )

  const handleUpdateField = useCallback(
    async (subsheetIndex: number, fieldIndex: number, field: InfoField) => {
      const sub = subsheets[subsheetIndex]
      const subId = sub?.originalId ?? sub?.id
      const fieldId = field.originalId ?? field.id
      if (subId == null || fieldId == null || sheetId == null) return
      try {
        const res = await api(`/subsheets/${subId}/fields/${fieldId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: field.label,
            infoType: field.infoType,
            uom: field.uom ?? '',
            required: field.required,
            options: field.options ?? [],
            orderIndex: field.sortOrder,
          }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to update field')
        }
      } catch {
        toast.error('Failed to update field')
      }
    },
    [api, subsheets, sheetId]
  )

  const handleDeleteField = useCallback(
    async (subsheetIndex: number, fieldIndex: number) => {
      const sub = subsheets[subsheetIndex]
      const subId = sub?.originalId ?? sub?.id
      const field = sub?.fields?.[fieldIndex]
      const fieldId = field?.originalId ?? field?.id
      if (subId == null || fieldId == null || sheetId == null) return
      try {
        const res = await api(`/subsheets/${subId}/fields/${fieldId}`, { method: 'DELETE' })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to delete field')
          return
        }
        setDatasheet((prev) => {
          const next = [...(prev.subsheets ?? [])]
          const subCopy = { ...next[subsheetIndex], fields: [...(next[subsheetIndex]?.fields ?? [])] }
          subCopy.fields.splice(fieldIndex, 1)
          next[subsheetIndex] = subCopy
          return { ...prev, subsheets: next }
        })
      } catch {
        toast.error('Failed to delete field')
      }
    },
    [api, subsheets, sheetId]
  )

  const handleReorderFields = useCallback(
    async (subsheetIndex: number, fields: InfoField[]) => {
      const sub = subsheets[subsheetIndex]
      const subId = sub?.originalId ?? sub?.id
      if (subId == null || sheetId == null) return
      const order = fields
        .map((f, i) => ({ fieldId: f.originalId ?? f.id, orderIndex: i }))
        .filter((o): o is { fieldId: number; orderIndex: number } => typeof o.fieldId === 'number')
      if (order.length === 0) return
      try {
        const res = await api(`/subsheets/${subId}/fields/order`, {
          method: 'PUT',
          body: JSON.stringify({ order }),
        })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as StructureErrorBody
          structureErrorToast(data, 'Failed to reorder fields')
        }
      } catch {
        toast.error('Failed to reorder fields')
      }
    },
    [api, subsheets, sheetId]
  )

  const handleSubmit = async () => {
    try {
      const parseResult = templateEditMetadataSchema.safeParse(datasheet)

      if (!parseResult.success) {
        setFormErrors(flattenErrors(parseResult.error))
        return
      }

      // Template edit: metadata-only validation. No subsheet/structure checks.
      // Send full datasheet so backend receives unchanged subsheet structure.
      const sheetId = datasheet.sheetId
      if (sheetId === undefined) {
        setFormErrors({ Unknown: ['Sheet ID is required.'] })
        return
      }

      const response = await fetch(`/api/backend/templates/${sheetId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(datasheet),
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

        <SubsheetBuilder
          subsheets={subsheets}
          onChange={handleSubsheetsChange}
          formErrors={formErrors}
          mode='edit'
          previewMode={false}
          readOnly={false}
          onRenameSubsheet={handleRenameSubsheet}
          onReorderSubsheets={handleReorderSubsheets}
          onDeleteSubsheet={handleDeleteSubsheet}
          onAddSubsheet={handleAddSubsheet}
          onAddField={handleAddField}
          onUpdateField={handleUpdateField}
          onDeleteField={handleDeleteField}
          onReorderFields={handleReorderFields}
        />
      </fieldset>

      <Modal
        isOpen={deleteSubsheetIndex !== null}
        onClose={() => setDeleteSubsheetIndex(null)}
        showCloseButton={true}
      >
        <div className='p-6 max-w-md'>
          <h3 className='text-lg font-semibold text-gray-900 mb-2'>Delete subsheet?</h3>
          <p className='text-sm text-gray-600 mb-4'>
            This will delete the subsheet and all fields inside it. This cannot be undone.
          </p>
          <div className='flex gap-2 justify-end'>
            <button
              type='button'
              onClick={() => setDeleteSubsheetIndex(null)}
              className='px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              type='button'
              onClick={() => void confirmDeleteSubsheet()}
              className='px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700'
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

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
