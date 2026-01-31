'use client'

import React, { useState } from 'react'
import Link from 'next/link'

type ContextTab = 'Requirement' | 'Offered' | 'AsBuilt'

interface Props {
  sheetId: number
  onRequirementView: () => void
  children: React.ReactNode
}

export default function ContextSelector({ sheetId, onRequirementView, children }: Props) {
  const [tab, setTab] = useState<ContextTab>('Requirement')
  const [partyId, setPartyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const addOffered = async () => {
    const pid = partyId.trim()
    if (!pid) {
      setMessage('Enter Party ID')
      return
    }
    const num = Number.parseInt(pid, 10)
    if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) {
      setMessage('Party ID must be a positive integer')
      return
    }
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/backend/sheets/${sheetId}/valuesets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'Offered', partyId: num }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Failed ${res.status}`)
      }
      setMessage('Vendor response added (Requirement copied). View Compare to see offered values.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to add vendor response')
    } finally {
      setBusy(false)
    }
  }

  const ensureAsBuilt = async () => {
    setMessage(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/backend/sheets/${sheetId}/valuesets`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'AsBuilt' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `Failed ${res.status}`)
      }
      setMessage('As-Built set ready (Requirement copied). View Compare to see as-built values.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to create As-Built set')
    } finally {
      setBusy(false)
    }
  }

  if (tab === 'Requirement') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => { setTab('Requirement'); onRequirementView(); }}
            className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm font-medium"
          >
            Requirement
          </button>
          <button
            type="button"
            onClick={() => setTab('Offered')}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
          >
            Offered
          </button>
          <button
            type="button"
            onClick={() => setTab('AsBuilt')}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
          >
            As-Built
          </button>
        </div>
        {children}
      </div>
    )
  }

  if (tab === 'Offered') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => { setTab('Requirement'); onRequirementView(); }}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
          >
            Requirement
          </button>
          <button
            type="button"
            onClick={() => setTab('Offered')}
            className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm font-medium"
          >
            Offered
          </button>
          <button
            type="button"
            onClick={() => setTab('AsBuilt')}
            className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
          >
            As-Built
          </button>
        </div>
        <div className="rounded border border-gray-200 p-4 space-y-3">
          <p className="text-sm text-gray-600">Add or view vendor (Offered) responses. Adding a vendor copies Requirement values.</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">Party ID (vendor):</label>
            <input
              type="text"
              inputMode="numeric"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
              placeholder="e.g. 99"
              className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
            />
            <button
              type="button"
              disabled={busy}
              onClick={addOffered}
              className="rounded bg-amber-100 px-3 py-1 text-sm hover:bg-amber-200 disabled:opacity-50"
            >
              Add vendor response
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={partyId.trim() ? `/datasheets/filled/${sheetId}/compare?offeredPartyId=${encodeURIComponent(partyId.trim())}` : `/datasheets/filled/${sheetId}/compare`}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View compare {partyId.trim() ? `(Party ${partyId.trim()})` : '(all offered)'}
            </Link>
          </div>
          {message && (
            <p className="text-sm text-amber-800">{message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => { setTab('Requirement'); onRequirementView(); }}
          className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
        >
          Requirement
        </button>
        <button
          type="button"
          onClick={() => setTab('Offered')}
          className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
        >
          Offered
        </button>
        <button
          type="button"
          onClick={() => setTab('AsBuilt')}
          className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm font-medium"
        >
          As-Built
        </button>
      </div>
        <div className="rounded border border-gray-200 p-4 space-y-3">
        <p className="text-sm text-gray-600">Create or view As-Built value set. Copies Requirement values when creating.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={ensureAsBuilt}
            className="rounded bg-green-100 px-3 py-1 text-sm hover:bg-green-200 disabled:opacity-50"
          >
            Copy Requirement → As-Built
          </button>
          <Link
            href={`/datasheets/filled/${sheetId}/compare`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            View compare
          </Link>
        </div>
        {message && (
          <p className="text-sm text-amber-800">{message}</p>
        )}
      </div>
    </div>
  )
}
