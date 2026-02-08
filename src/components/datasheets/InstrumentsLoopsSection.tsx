'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Dialog, DialogContent } from '@/components/ui/dialog'

type LinkedInstrument = {
  instrumentId: number
  instrumentTag: string
  instrumentTagNorm: string | null
  instrumentType: string | null
  linkRole: string | null
  loopTags: string[]
}

type InstrumentOption = {
  instrumentId: number
  instrumentTag: string
  instrumentType: string | null
}

interface InstrumentsLoopsSectionProps {
  sheetId: number
  readOnly?: boolean
}

export default function InstrumentsLoopsSection(props: Readonly<InstrumentsLoopsSectionProps>) {
  const { sheetId, readOnly = false } = props
  const [linked, setLinked] = useState<LinkedInstrument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerList, setPickerList] = useState<InstrumentOption[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [linkingId, setLinkingId] = useState<number | null>(null)
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadLinked = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/backend/datasheets/${sheetId}/instruments`, {
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (isMountedRef.current) setError(body?.error ?? `Failed to load (${res.status})`)
        return
      }
      const data = (await res.json()) as LinkedInstrument[]
      if (isMountedRef.current) setLinked(Array.isArray(data) ? data : [])
    } catch {
      if (isMountedRef.current) setError('Unable to load instruments.')
    } finally {
      if (isMountedRef.current) setLoading(false)
    }
  }, [sheetId])

  useEffect(() => {
    loadLinked()
  }, [loadLinked])

  useEffect(() => {
    if (!showPicker) return
    setPickerLoading(true)
    const q = pickerSearch.trim()
    const url = q
      ? `/api/backend/instruments?q=${encodeURIComponent(q)}`
      : '/api/backend/instruments'
    fetch(url, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: InstrumentOption[]) => {
        if (isMountedRef.current) setPickerList(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (isMountedRef.current) setPickerList([])
      })
      .finally(() => {
        if (isMountedRef.current) setPickerLoading(false)
      })
  }, [showPicker, pickerSearch])

  const handleLink = async (instrumentId: number) => {
    setLinkingId(instrumentId)
    try {
      const res = await fetch(
        `/api/backend/datasheets/${sheetId}/instruments/${instrumentId}/link`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (isMountedRef.current) setError(body?.error ?? 'Link failed')
        return
      }
      setShowPicker(false)
      await loadLinked()
    } finally {
      if (isMountedRef.current) setLinkingId(null)
    }
  }

  const handleUnlink = async (instrumentId: number) => {
    setUnlinkingId(instrumentId)
    try {
      const res = await fetch(
        `/api/backend/datasheets/${sheetId}/instruments/${instrumentId}/link`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        if (isMountedRef.current) setError(body?.error ?? 'Unlink failed')
        return
      }
      await loadLinked()
    } finally {
      if (isMountedRef.current) setUnlinkingId(null)
    }
  }

  const linkedIds = new Set(linked.map((i) => i.instrumentId))
  const pickerOptions = pickerList.filter((i) => !linkedIds.has(i.instrumentId))

  if (loading) return <p className="text-sm text-gray-500">Loading instruments…</p>

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="px-3 py-1.5 text-sm rounded border hover:shadow disabled:opacity-50"
          >
            Link instrument
          </button>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600" aria-live="polite">
          {error}
        </p>
      )}
      {linked.length === 0 && !error && (
        <p className="text-sm text-gray-500">No instruments linked to this datasheet.</p>
      )}
      {linked.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">Tag</th>
                <th className="border px-2 py-1 text-left">Type</th>
                <th className="border px-2 py-1 text-left">Loops</th>
                {!readOnly && <th className="border px-2 py-1 text-left">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {linked.map((i) => (
                <tr key={i.instrumentId} className="border-b">
                  <td className="border px-2 py-1">{i.instrumentTag}</td>
                  <td className="border px-2 py-1">{i.instrumentType ?? '—'}</td>
                  <td className="border px-2 py-1">
                    {i.loopTags && i.loopTags.length > 0 ? i.loopTags.join(', ') : '—'}
                  </td>
                  {!readOnly && (
                    <td className="border px-2 py-1">
                      <button
                        type="button"
                        onClick={() => handleUnlink(i.instrumentId)}
                        disabled={unlinkingId === i.instrumentId}
                        className="text-red-600 text-xs hover:underline disabled:opacity-50"
                      >
                        Unlink
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showPicker} onOpenChange={setShowPicker}>
        <DialogContent aria-describedby={undefined}>
          <div className="space-y-3">
            <DialogPrimitive.Title asChild>
              <h3 className="text-lg font-semibold">Link instrument</h3>
            </DialogPrimitive.Title>
            <input
              type="text"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search by tag…"
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
            {pickerLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {!pickerLoading && pickerOptions.length === 0 && (
              <p className="text-sm text-gray-500">No instruments to link (or already linked).</p>
            )}
            {!pickerLoading && pickerOptions.length > 0 && (
              <ul className="max-h-60 overflow-y-auto border rounded divide-y">
                {pickerOptions.map((opt) => (
                  <li key={opt.instrumentId} className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-sm">
                      {opt.instrumentTag}
                      {opt.instrumentType ? ` (${opt.instrumentType})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLink(opt.instrumentId)}
                      disabled={linkingId !== null}
                      className="text-xs px-2 py-1 rounded border hover:bg-gray-100 disabled:opacity-50"
                    >
                      Link
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
