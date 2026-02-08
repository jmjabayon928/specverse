// Read-only view for a single datasheet template
'use client'

import React from 'react'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import { translations as labelTranslations } from '@/constants/translations'
import { convertToUSC } from '@/utils/unitConversionTable'
import ChangeLogTable from '@/components/datasheets/ChangeLogTable'
import VerificationRecordsList from '@/components/datasheets/VerificationRecordsList'
import RatingsBlocksList from '@/components/datasheets/RatingsBlocksList'
import InstrumentsLoopsSection from '@/components/datasheets/InstrumentsLoopsSection'

function safeFormatDate(input: string | Date | null | undefined): string {
  if (!input) return '-'
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10)
}

const getUILabel = (key: string, lang: string): string =>
  labelTranslations[key]?.[lang] ?? key

// Prefer ids for stable React keys
function hashString(s: string): string {
  let hash = 0

  for (const char of s) {
    const cp = char.codePointAt(0) ?? 0
    hash = (hash << 5) - hash + cp
    hash = Math.trunc(hash)
  }

  return `h${Math.abs(hash)}`
}

function stableFieldKey(field: {
  id?: number | null
  originalId?: number | null
  fieldId?: number | null
  code?: string | null
  label?: string | null
  uom?: string | null
  required?: boolean
  options?: unknown[]
}) {
  const id = field.originalId ?? field.id ?? field.fieldId ?? field.code
  if (id != null) return String(id)

  // Fallback when there is no explicit id
  const sig = JSON.stringify({
    label: field.label ?? '',
    uom: field.uom ?? '',
    req: Boolean(field.required),
    opts: field.options ?? [],
  })

  return `fld:${hashString(sig)}`
}

function stableSubsheetKey(subsheet: {
  id?: number | null
  originalId?: number | null
  name?: string | null
}) {
  const id = subsheet.originalId ?? subsheet.id
  if (id != null) return String(id)

  // Fallback when we cannot derive an id
  const sig = JSON.stringify({ name: subsheet.name ?? '' })
  return `sub:${hashString(sig)}`
}

// View types for notes and attachments
type SheetNoteDTO = {
  id: number
  noteTypeId: number | null
  noteTypeName?: string | null  // from NoteTypes join
  orderIndex: number | null
  body: string
  createdAt: string              // ISO date
  createdBy?: number | null
  createdByName?: string | null
}

type SheetAttachmentDTO = {
  // link (SheetAttachments)
  sheetAttachmentId: number
  orderIndex: number
  sheetId: number
  attachmentId: number
  description?: string | null

  // file (Attachments)
  name: string
  path: string
  fileType?: string | null
  sizeBytes?: number | null
  uploadedBy?: number | null
  uploadedByName?: string | null
  uploadedAt: string             // ISO date

  // derived
  url?: string
}

// Base sheet with optional extras from the service
type SheetWithExtras = UnifiedSheet & {
  notes?: SheetNoteDTO[]
  attachments?: SheetAttachmentDTO[]
}

// Props for this viewer
type Props = {
  data: UnifiedSheet
  unitSystem: 'SI' | 'USC'
  language: string
  translations?: SheetTranslations
  onAddNote?: (templateSheetId: number) => void
  onAddAttachment?: (templateSheetId: number) => void
}

type SheetTranslations = {
  fieldLabelMap?: Record<string, string>
  subsheetLabelMap?: Record<string, string>
  optionMap?: Record<string, string[]>
}

// Helpers for rendering safe display values
function getCircularReplacer() {
  const seen = new WeakSet<object>()
  return (_key: string, value: unknown) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  }
}

function toDisplayString(raw: unknown): string {
  if (raw == null || raw === '') return '-'
  if (raw instanceof Date) return safeFormatDate(raw)

  switch (typeof raw) {
    case 'string':
      return raw
    case 'number':
      return Number.isFinite(raw) ? `${raw}` : '-'
    case 'boolean':
      return raw ? 'true' : 'false'
    case 'bigint':
      return raw.toString()
    case 'symbol':
      return raw.description ?? raw.toString()
    case 'function':
      return '[Function]'
    case 'object':
      try {
        return JSON.stringify(raw, getCircularReplacer())
      } catch {
        return '[Unserializable]'
      }
    default:
      return '-'
  }
}

function formatMaybeDate(raw: unknown, isDate: boolean): string {
  if (isDate) {
    if (typeof raw === 'string' || raw instanceof Date) {
      return safeFormatDate(raw)
    }
    return '-'
  }

  return toDisplayString(raw)
}

function getLabel(
  key: string,
  map: Record<string, string> | undefined,
  fallback: string | null | undefined
): string {
  if (map?.[key]) return map[key]
  if (fallback) return fallback
  return key
}

export default function TemplateViewer(props: Readonly<Props>) {
  const {
    data,
    unitSystem,
    language,
    translations,
    onAddNote,
    onAddAttachment,
  } = props

  const fieldLabelMap = translations?.fieldLabelMap ?? {}
  const subsheetLabelMap = translations?.subsheetLabelMap ?? {}
  const optionMap = translations?.optionMap ?? {}

  const getConvertedUOM = (uom?: string) => {
    if (!uom) return ''
    return unitSystem === 'USC' ? convertToUSC('1', uom).unit : uom
  }

  // Normalize possibly undefined arrays from the service
  const dataWithExtras = data as SheetWithExtras
  const sheetId = typeof data.sheetId === 'number' ? data.sheetId : null

  const safeNotes = React.useMemo<SheetNoteDTO[]>(
    () => (Array.isArray(dataWithExtras.notes) ? dataWithExtras.notes : []),
    [dataWithExtras.notes]
  )

  const safeAttachments = React.useMemo<SheetAttachmentDTO[]>(
    () =>
      Array.isArray(dataWithExtras.attachments)
        ? dataWithExtras.attachments
        : [],
    [dataWithExtras.attachments]
  )

  // Group notes by type for rendering
  const groupedNotes = React.useMemo(() => {
    const groups = new Map<string, { label: string; items: SheetNoteDTO[] }>()

    for (const note of safeNotes) {
      const hasTypeId = typeof note.noteTypeId === 'number'
      const key = hasTypeId ? String(note.noteTypeId) : 'unknown'
      const labelFromType = hasTypeId ? `Type ${note.noteTypeId}` : 'Uncategorized'
      const label = note.noteTypeName?.trim() ?? labelFromType

      const existingGroup = groups.get(key)

      if (existingGroup) {
        existingGroup.items.push(note)
      } else {
        groups.set(key, { label, items: [note] })
      }
    }

    const result: Array<{ label: string; items: SheetNoteDTO[] }> = []

    for (const group of groups.values()) {
      const itemsCopy = [...group.items]

      itemsCopy.sort((a: SheetNoteDTO, b: SheetNoteDTO) => {
        const aTimeRaw = new Date(a.createdAt).getTime()
        const bTimeRaw = new Date(b.createdAt).getTime()

        const aTime = Number.isNaN(aTimeRaw) ? 0 : aTimeRaw
        const bTime = Number.isNaN(bTimeRaw) ? 0 : bTimeRaw

        return aTime - bTime
      })

      result.push({
        label: group.label,
        items: itemsCopy,
      })
    }

    return result
  }, [safeNotes])

  // Click handlers with explicit types
  const handleAddNoteClick = () => {
    if (onAddNote && typeof data.sheetId === 'number') {
      onAddNote(data.sheetId)
    }
  }

  const handleAddAttachmentClick = () => {
    if (onAddAttachment && typeof data.sheetId === 'number') {
      onAddAttachment(data.sheetId)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Datasheet details */}
      <fieldset className='border rounded p-4'>
        <div className='text-xl font-semibold mb-4'>
          {getUILabel('Datasheet Details', language)}
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          {[
            'sheetName',
            'sheetDesc',
            'sheetDesc2',
            'clientDocNum',
            'clientProjectNum',
            'companyDocNum',
            'companyProjectNum',
            'areaName',
            'packageName',
            'revisionNum',
            'revisionDate',
            'preparedByName',
            'preparedByDate',
            'modifiedByName',
            'modifiedByDate',
            'rejectedByName',
            'rejectedByDate',
            'rejectComment',
            'verifiedByName',
            'verifiedDate',
            'approvedByName',
            'approvedDate',
          ].map((key) => {
            const label = getUILabel(key, language)
            const rawValue = data[key as keyof UnifiedSheet]
            const isDate = key.toLowerCase().includes('date')
            const value = formatMaybeDate(rawValue, isDate)

            return (
              <div
                key={key}
                className={key === 'rejectComment' ? 'md:col-span-2' : ''}
              >
                <label className='font-medium text-sm text-gray-700'>
                  {label}
                </label>
                <div className='bg-gray-100 text-gray-900 rounded px-3 py-2 whitespace-pre-line'>
                  {value}
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>

      {/* Equipment details */}
      <fieldset className='border rounded p-4'>
        <div className='text-xl font-semibold mb-4'>
          {getUILabel('Equipment Details', language)}
        </div>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='font-medium text-sm text-gray-700'>
              Discipline · Subtype
            </label>
            <div className='bg-gray-100 text-gray-900 rounded px-3 py-2'>
              {[data.disciplineName, data.subtypeName].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          {[
            'equipmentName',
            'equipmentTagNum',
            'equipmentNum',
            'categoryName',
            'supplierName',
            'manufacturerName',
            'projectName',
          ].map((key) => {
            const label = getUILabel(key, language)
            const rawValue = data[key as keyof UnifiedSheet]
            const value = formatMaybeDate(rawValue, false)

            return (
              <div key={key}>
                <label className='font-medium text-sm text-gray-700'>
                  {label}
                </label>
                <div className='bg-gray-100 text-gray-900 rounded px-3 py-2'>
                  {value}
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>

      {/* Subsheets */}
      <fieldset className='border rounded p-4'>
        <div className='text-xl font-semibold mb-4'>
          {getUILabel('Subsheets', language)}
        </div>
        {Array.isArray(data.subsheets) && data.subsheets.length > 0 ? (
          <div className='space-y-6'>
            {data.subsheets.map((sub) => {
              const subsheetKey = sub.originalId?.toString() ?? sub.name
              const subsheetStableKey = stableSubsheetKey(sub)
              const subsheetName = getLabel(
                subsheetKey,
                subsheetLabelMap,
                sub.name
              )

              const fields = sub.fields ?? []
              const midpoint = Math.ceil(fields.length / 2)
              const leftFields = fields.slice(0, midpoint)
              const rightFields = fields.slice(midpoint)

              const renderTable = (
                fieldList: typeof fields,
                tableKey: string
              ) => (
                <table
                  key={tableKey}
                  className='w-full table-auto text-sm border'
                >
                  <thead className='bg-gray-100'>
                    <tr>
                      <th className='border px-2 py-1'>
                        {getUILabel('InfoLabel', language)}
                      </th>
                      <th className='border px-2 py-1'>
                        {getUILabel('InfoUOM', language)}
                      </th>
                      <th className='border px-2 py-1'>
                        {getUILabel('InfoOptions', language)}
                      </th>
                      <th className='border px-2 py-1'>
                        {getUILabel('InfoValue', language)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fieldList.map((field, index) => {
                      const fieldKey =
                        field.originalId?.toString() ?? field.label
                      const fieldStableKey = stableFieldKey(field)
                      const label = getLabel(
                        fieldKey,
                        fieldLabelMap,
                        field.label
                      )
                      const options = field.options?.length
                        ? optionMap[field.originalId?.toString() ?? ''] ??
                          field.options
                        : null
                      const uom = getConvertedUOM(field.uom)

                      return (
                        <tr
                          key={`row:${subsheetStableKey}:${fieldStableKey}:${index}`}
                          className={
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }
                        >
                          <td className='border px-2 py-1 align-top'>
                            {label}
                          </td>
                          <td className='border px-2 py-1 align-top'>
                            {uom || '-'}
                          </td>
                          <td className='border px-2 py-1 align-top'>
                            {options?.length ? options.join(', ') : '-'}
                          </td>
                          <td className='border px-2 py-1 align-top whitespace-pre-line'>
                            {toDisplayString(field.value)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )

              return (
                <div key={subsheetStableKey} className='space-y-2'>
                  <div className='font-semibold text-sm text-gray-800'>
                    {subsheetName}
                  </div>
                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                    {renderTable(leftFields, `${subsheetStableKey}:left`)}
                    {renderTable(rightFields, `${subsheetStableKey}:right`)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className='text-sm text-gray-600'>
            {getUILabel('NoSubsheets', language) ?? 'No subsheets'}
          </div>
        )}
      </fieldset>

      {/* Notes and Add Note button */}
      <fieldset className='border rounded p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div className='text-xl font-semibold'>
            {getUILabel('Notes', language)}
          </div>
          {onAddNote && (
            <button
              type='button'
              className='px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700'
              onClick={handleAddNoteClick}
            >
              {getUILabel('AddNote', language) ?? 'Add note'}
            </button>
          )}
        </div>
        {groupedNotes.length > 0 ? (
          <div className='space-y-4'>
            {groupedNotes.map((group) => (
              <div key={group.label} className='space-y-2'>
                <div className='font-semibold text-sm text-gray-800'>
                  {group.label}
                </div>
                <div className='space-y-2'>
                  {group.items.map((note) => (
                    <div
                      key={note.id}
                      className='bg-gray-100 rounded px-3 py-2 text-sm'
                    >
                      <div className='text-gray-900 whitespace-pre-line'>
                        {note.body}
                      </div>
                      <div className='mt-1 text-xs text-gray-600'>
                        {note.createdByName
                          ? `${note.createdByName} • ${safeFormatDate(note.createdAt)}`
                          : safeFormatDate(note.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='text-sm text-gray-600'>
            {getUILabel('NoNotes', language) ?? 'No notes'}
          </div>
        )}
      </fieldset>

      {/* Attachments and Add Attachment button */}
      <fieldset className='border rounded p-4'>
        <div className='flex items-center justify-between mb-4'>
          <div className='text-xl font-semibold'>
            {getUILabel('Attachments', language)}
          </div>
          {onAddAttachment && (
            <button
              type='button'
              className='px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700'
              onClick={handleAddAttachmentClick}
            >
              {getUILabel('AddAttachment', language) ?? 'Add attachment'}
            </button>
          )}
        </div>
        {safeAttachments.length > 0 ? (
          <div className='space-y-2'>
            {safeAttachments.map((attachment) => (
              <div
                key={attachment.sheetAttachmentId}
                className='bg-gray-100 rounded px-3 py-2 text-sm flex flex-col md:flex-row md:items-center md:justify-between gap-2'
              >
                <div>
                  <div className='font-medium text-gray-900'>
                    {attachment.name}
                  </div>
                  {attachment.description && (
                    <div className='text-xs text-gray-700'>
                      {attachment.description}
                    </div>
                  )}
                  <div className='mt-1 text-xs text-gray-600'>
                    {attachment.uploadedByName &&
                      `${attachment.uploadedByName} • `}
                    {safeFormatDate(attachment.uploadedAt)}
                    {attachment.sizeBytes != null &&
                      ` • ${Math.round(attachment.sizeBytes / 1024)} kB`}
                  </div>
                </div>
                {attachment.url && (
                  <div>
                    <a
                      href={attachment.url}
                      target='_blank'
                      rel='noreferrer'
                      className='text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700'
                    >
                      {getUILabel('Download', language) ?? 'Download'}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className='text-sm text-gray-600'>
            {getUILabel('NoAttachments', language) ?? 'No attachments'}
          </div>
        )}
      </fieldset>

      {/* Verification Records */}
      {sheetId != null && (
        <fieldset className='border rounded p-4'>
          <div className='text-xl font-semibold mb-2'>Verification Records</div>
          <div className='text-sm text-gray-600 mb-4'>
            Verification records linked to this datasheet.
          </div>
          <VerificationRecordsList
            sheetId={sheetId}
            sheetAttachments={safeAttachments.map((a) => ({
              attachmentId: a.attachmentId,
              originalName: a.name ?? `Attachment ${a.attachmentId}`,
            }))}
          />
        </fieldset>
      )}

      {/* Ratings & Nameplate */}
      {sheetId != null && (
        <fieldset className='border rounded p-4'>
          <div className='text-xl font-semibold mb-2'>Ratings &amp; Nameplate</div>
          <div className='text-sm text-gray-600 mb-4'>
            Ratings blocks linked to this datasheet.
          </div>
          <RatingsBlocksList sheetId={sheetId} sheetStatus={data.status} />
        </fieldset>
      )}

      {/* Instruments & Loops */}
      {sheetId != null && (
        <fieldset className='border rounded p-4'>
          <div className='text-xl font-semibold mb-2'>Instruments &amp; Loops</div>
          <div className='text-sm text-gray-600 mb-4'>
            Instruments linked to this datasheet and their loop context.
          </div>
          <InstrumentsLoopsSection sheetId={sheetId} readOnly={true} />
        </fieldset>
      )}

      {sheetId != null && (
        <fieldset className='border rounded p-4'>
          <div className='text-xl font-semibold mb-2'>Audit &amp; Change Log</div>
          <div className='text-sm text-gray-600 mb-4'>
            Latest activity and field-level changes (newest first).
          </div>
          <ChangeLogTable sheetId={sheetId} />
        </fieldset>
      )}
    </div>
  )
}
