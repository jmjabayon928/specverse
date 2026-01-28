// src/app/(admin)/datasheets/templates/[id]/notes/new/page.tsx
'use client'

import type { FormEvent } from 'react'
import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

const NOTE_TYPES_ENDPOINT = '/api/backend/templates/note-types'

const SHEET_DETAILS_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}?lang=eng`

const CREATE_NOTE_ENDPOINT = (sheetId: number) =>
  `/api/backend/templates/${sheetId}/notes`

type NoteType = {
  noteTypeId: number
  noteType: string
  description?: string | null
}

type MinimalSheetHeader = {
  sheetName?: string | null
  equipmentTagNum?: string | number | null
}

const isPositiveInt = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

const NewTemplateNotePage = () => {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()

  const sheetId = useMemo(() => Number(params?.id), [params?.id])

  const [header, setHeader] = useState<MinimalSheetHeader | null>(null)
  const [headerLoading, setHeaderLoading] = useState(false)

  const [noteTypes, setNoteTypes] = useState<NoteType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [noteTypeId, setNoteTypeId] = useState<number | ''>('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasSheetId = isPositiveInt(sheetId)

  const returnTo =
    searchParams?.get('returnTo')
    || (hasSheetId ? `/datasheets/templates/${sheetId}` : '/datasheets/templates')

  const hasNoteType = typeof noteTypeId === 'number' && noteTypeId > 0
  const hasBody = body.trim().length > 0
  const canSubmit = hasSheetId && hasNoteType && hasBody && !saving

  useEffect(() => {
    let cancelled = false

    const fetchNoteTypes = async () => {
      try {
        setLoadingTypes(true)
        setError(null)

        const response = await fetch(NOTE_TYPES_ENDPOINT, {
          credentials: 'include',
        })

        if (!response.ok) {
          const status = response.status
          throw new Error(`Failed to load note types (${status})`)
        }

        const list: NoteType[] = await response.json()

        if (!cancelled) {
          setNoteTypes(Array.isArray(list) ? list : [])
        }
      } catch (fetchError: unknown) {
        if (!cancelled) {
          const message = fetchError instanceof Error
            ? fetchError.message
            : 'Failed to load note types'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes(false)
        }
      }
    }

    fetchNoteTypes()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hasSheetId) {
      return
    }

    let cancelled = false

    const fetchHeader = async () => {
      try {
        setHeaderLoading(true)

        const response = await fetch(SHEET_DETAILS_ENDPOINT(sheetId), {
          credentials: 'include',
        })

        if (!response.ok) {
          const status = response.status
          throw new Error(`Failed to load template (${status})`)
        }

        const json = await response.json()
        const datasheet = json?.datasheet ?? json

        if (!cancelled) {
          setHeader({
            sheetName: datasheet?.sheetName ?? null,
            equipmentTagNum: datasheet?.equipmentTagNum ?? null,
          })
        }
      } catch {
        if (!cancelled) {
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

    return 'Create Note'
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!canSubmit) {
      return
    }

    if (typeof noteTypeId !== 'number' || noteTypeId <= 0) {
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        noteTypeId,
        text: body.trim(),
      }

      const response = await fetch(CREATE_NOTE_ENDPOINT(sheetId), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        router.push(returnTo)
        router.refresh()
        return
      }

      const text = await response.text().catch(() => '')
      const message = text || `Failed to create note (${response.status})`
      throw new Error(message)
    } catch (submitError: unknown) {
      setSaving(false)
      const message = submitError instanceof Error
        ? submitError.message
        : 'Failed to create note'
      setError(message)
    }
  }

  const handleCancel = () => {
    router.push(returnTo)
  }

  const handleNoteTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const rawValue = event.target.value
    const nextValue = rawValue.length > 0 ? Number(rawValue) : ''
    setNoteTypeId(nextValue)
  }

  const handleBodyChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(event.target.value)
  }

  const hasNoteTypes = !loadingTypes && noteTypes.length > 0

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
            'Create Note'
          )}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className='space-y-5'
      >
        <div>
          <label
            htmlFor='noteTypeSelect'
            className='mb-1 block text-sm font-medium text-gray-700'
          >
            Note Type <span className='text-red-500'>*</span>
          </label>
          {loadingTypes ? (
            <div className='text-sm text-gray-500'>
              Loading note types…
            </div>
          ) : (
            <select
              id='noteTypeSelect'
              className='w-full rounded border px-3 py-2 text-sm'
              title='Select a note type'
              value={noteTypeId}
              onChange={handleNoteTypeChange}
              required
            >
              <option value=''>
                Select a note type…
              </option>
              {noteTypes.map((noteType) => (
                <option
                  key={noteType.noteTypeId}
                  value={noteType.noteTypeId}
                >
                  {noteType.noteType}
                </option>
              ))}
            </select>
          )}
          {hasNoteTypes === false && (
            <div className='mt-1 text-xs text-amber-600'>
              No note types available. Please add NoteTypes first.
            </div>
          )}
        </div>

        <div>
          <label
            htmlFor='noteBody'
            className='mb-1 block text-sm font-medium text-gray-700'
          >
            Note Text <span className='text-red-500'>*</span>
          </label>
          <textarea
            id='noteBody'
            className='min-h-[160px] w-full rounded border px-3 py-2 text-sm'
            value={body}
            onChange={handleBodyChange}
            placeholder='Enter the note body…'
            required
          />
          <p className='mt-1 text-xs text-gray-500'>
            This note will be added at the end of its note-type group automatically.
          </p>
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
            {saving ? 'Saving…' : 'Save Note'}
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

export default NewTemplateNotePage
