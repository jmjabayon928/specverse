// src/app/(admin)/datasheets/templates/[id]/attachments/new/page.tsx
'use client'

import type { FormEvent } from 'react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const CREATE_ATTACHMENT_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}/attachments`

const SHEET_DETAILS_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}?lang=eng`

const MAX_BYTES = 25 * 1024 * 1024
const ACCEPT =
  'image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.7z,.dwg,.dxf,.svg'

type MinimalSheetHeader = {
  sheetName?: string | null
  equipmentTagNum?: string | number | null
}

const isPositiveInt = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes)) {
    return '-'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let currentUnitIndex = 0
  let remaining = bytes

  while (remaining >= 1024 && currentUnitIndex < units.length - 1) {
    remaining /= 1024
    currentUnitIndex += 1
  }

  const fractionDigits = currentUnitIndex === 0 ? 0 : 1
  const value = remaining.toFixed(fractionDigits)

  return `${value} ${units[currentUnitIndex]}`
}

const NewTemplateAttachmentPage = () => {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const sheetId = useMemo(() => Number(params?.id), [params?.id])

  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [header, setHeader] = useState<MinimalSheetHeader | null>(null)
  const [headerLoading, setHeaderLoading] = useState(false)

  const hasSheetId = isPositiveInt(sheetId)

  const returnTo =
    searchParams?.get('returnTo')
    || (hasSheetId ? `/datasheets/templates/${sheetId}` : '/datasheets/templates')

  const tooLarge = file !== null && file.size > MAX_BYTES
  const hasFile = file !== null
  const canSubmit = hasSheetId && hasFile && !tooLarge && !saving

  useEffect(() => {
    if (!hasSheetId) {
      return
    }

    let cancelled = false

    const fetchHeader = async () => {
      try {
        setHeaderLoading(true)
        setError(null)

        const response = await fetch(SHEET_DETAILS_ENDPOINT(sheetId), {
          credentials: 'include',
        })

        if (!response.ok) {
          const status = response.status
          throw new Error(`Failed to load template (${status})`)
        }

        const data = await response.json()
        const datasheet = data?.datasheet ?? data

        if (!cancelled) {
          setHeader({
            sheetName: datasheet?.sheetName ?? null,
            equipmentTagNum: datasheet?.equipmentTagNum ?? null,
          })
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          console.warn('Template header fetch failed', fetchError)
          setHeader(null)
        }
      } finally {
        if (!cancelled) {
          setHeaderLoading(false)
        }
      }
    }

    fetchHeader()

    return () => {
      cancelled = true
    }
  }, [hasSheetId, sheetId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!canSubmit || file === null) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(CREATE_ATTACHMENT_ENDPOINT(sheetId), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (response.ok) {
        router.push(returnTo)
        router.refresh()
        return
      }

      const text = await response.text().catch(() => '')
      if (response.status === 413) {
        throw new Error('File too large (payload limit).')
      }

      if (response.status === 415) {
        throw new Error('Unsupported file type.')
      }

      const message = text || `Failed to upload attachment (${response.status}).`
      throw new Error(message)
    } catch (submitError: unknown) {
      setSaving(false)
      const message = submitError instanceof Error
        ? submitError.message
        : 'Failed to upload attachment.'
      setError(message)
    }
  }

  const handleCancel = () => {
    router.push(returnTo)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null
    setFile(nextFile)
  }

  const getHeaderTitle = (): string => {
    if (headerLoading) {
      return 'Loading…'
    }

    if (header?.sheetName?.trim()) {
      return header.sheetName
    }

    if (hasSheetId) {
      return `Template #${sheetId}`
    }

    return 'Add Attachment'
  }

  const fileInputId = 'template-attachment-file-input'

  return (
    <div className='mx-auto max-w-3xl space-y-6'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-semibold text-gray-900 md:text-3xl'>
          {getHeaderTitle()}
        </h1>
        <p className='text-base text-gray-700 md:text-lg'>
          {header?.equipmentTagNum ? `Equipment Tag: ${header.equipmentTagNum}` : null}
        </p>
        <p className='text-sm text-gray-600'>
          {hasSheetId && !header?.sheetName ? (
            <>
              Template ID:{' '}
              <span className='font-mono'>
                {sheetId}
              </span>
            </>
          ) : (
            'Add Attachment'
          )}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className='space-y-5'
      >
        <div>
          <label
            htmlFor={fileInputId}
            className='mb-1 block text-sm font-medium text-gray-700'
          >
            File <span className='text-red-500'>*</span>
          </label>
          <input
            id={fileInputId}
            type='file'
            title='Select file to upload'
            accept={ACCEPT}
            onChange={handleFileChange}
            className='block w-full text-sm text-gray-900 file:mr-3 file:rounded file:border file:px-3 file:py-1.5 file:text-sm file:font-medium file:bg-gray-50 file:hover:bg-gray-100'
            required
          />
          <div className='mt-2 space-y-1 text-xs text-gray-600'>
            <div>
              Allowed: images, PDF, Office docs, CSV/TXT/ZIP, CAD (DWG/DXF), SVG.
            </div>
            <div>
              Max size: {formatBytes(MAX_BYTES)}.
            </div>
            {file !== null && (
              <div className={tooLarge ? 'text-red-600' : 'text-gray-600'}>
                Selected:{' '}
                <strong>
                  {file.name}
                </strong>{' '}
                ({formatBytes(file.size)})
              </div>
            )}
          </div>
        </div>

        {error !== null && (
          <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'>
            {error}
          </div>
        )}

        <div className='flex items-center gap-3'>
          <button
            type='submit'
            disabled={!canSubmit}
            className='inline-flex items-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50'
          >
            {saving ? 'Uploading…' : 'Upload'}
          </button>
          <button
            type='button'
            onClick={handleCancel}
            className='inline-flex items-center rounded border px-4 py-2 text-sm font-medium'
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default NewTemplateAttachmentPage
