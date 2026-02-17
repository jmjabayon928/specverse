'use client'

import React, { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import { useSession } from '@/hooks/useSession'
import type {
  CompareResponse,
  CompareSubsheet,
  CompareFieldValue,
  ValueSetListItem,
  VarianceStatus,
} from '@/domain/datasheets/compareTypes'

interface Props {
  sheetId: number
  compareData: CompareResponse
  valueSets: ValueSetListItem[]
  offeredPartyId?: number
}

function getValueSetStatus(valueSets: ValueSetListItem[], valueSetId: number): string | null {
  const vs = valueSets.find((v) => v.ValueSetID === valueSetId)
  return vs?.Status ?? null
}

function canEditValueSet(valueSets: ValueSetListItem[], valueSetId: number): boolean {
  const status = getValueSetStatus(valueSets, valueSetId)
  return status === 'Draft'
}

export default function ComparePageClient({
  sheetId,
  compareData,
  valueSets,
  offeredPartyId: initialOfferedPartyId,
}: Props) {
  const router = useRouter()
  const { user } = useSession()
  const [offeredPartyId, setOfferedPartyId] = useState<string>(
    initialOfferedPartyId != null ? String(initialOfferedPartyId) : ''
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheetLocked, setSheetLocked] = useState(false)
  const [sheetLockReason, setSheetLockReason] = useState<string | null>(null)

  const hasEdit = Boolean(
    user && Array.isArray(user.permissions) && user.permissions.includes(PERMISSIONS.DATASHEET_EDIT)
  )

  const applyOfferedFilter = useCallback(() => {
    const q = offeredPartyId.trim() ? `?offeredPartyId=${encodeURIComponent(offeredPartyId.trim())}` : ''
    router.push(`/datasheets/filled/${sheetId}/compare${q}`)
  }, [router, sheetId, offeredPartyId])

  const patchVariance = useCallback(
    async (valueSetId: number, infoTemplateId: number, status: VarianceStatus | null) => {
      if (!hasEdit) return
      setError(null)
      setBusy(true)
      try {
        const res = await fetch(
          `/api/backend/sheets/${sheetId}/valuesets/${valueSetId}/variances`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ infoTemplateId, status }),
          }
        )
        if (!res.ok) {
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}))
            const msg =
              (typeof data?.message === 'string' ? data.message : null) ??
              (typeof data?.error === 'string' ? data.error : null) ??
              'This datasheet is not editable in its current status.'
            setSheetLocked(true)
            setSheetLockReason(msg)
            setError(msg)
            return
          }
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? `PATCH failed ${res.status}`)
        }
        setSheetLocked(false)
        setSheetLockReason(null)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update variance')
      } finally {
        setBusy(false)
      }
    },
    [sheetId, hasEdit, router]
  )

  const postStatus = useCallback(
    async (valueSetId: number, status: 'Locked' | 'Verified') => {
      if (!hasEdit) return
      setError(null)
      setBusy(true)
      try {
        const res = await fetch(
          `/api/backend/sheets/${sheetId}/valuesets/${valueSetId}/status`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        )
        if (!res.ok) {
          if (res.status === 409) {
            const data = await res.json().catch(() => ({}))
            const msg =
              (typeof data?.message === 'string' ? data.message : null) ??
              (typeof data?.error === 'string' ? data.error : null) ??
              'This datasheet is not editable in its current status.'
            setSheetLocked(true)
            setSheetLockReason(msg)
            setError(msg)
            return
          }
          const data = await res.json().catch(() => ({}))
          throw new Error(data?.error ?? `POST status failed ${res.status}`)
        }
        setSheetLocked(false)
        setSheetLockReason(null)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update status')
      } finally {
        setBusy(false)
      }
    },
    [sheetId, hasEdit, router]
  )

  const reqValueSet = valueSets.find((v) => v.Code === 'Requirement')
  const offeredValueSets = valueSets.filter((v) => v.Code === 'Offered')
  const asBuiltValueSet = valueSets.find((v) => v.Code === 'AsBuilt')

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/datasheets/filled/${sheetId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to sheet
        </Link>
        <h1 className="text-xl font-semibold">Compare: Requirement vs Offered vs As-Built</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-gray-600">Offered vendor (Party ID):</label>
        <input
          type="text"
          inputMode="numeric"
          value={offeredPartyId}
          onChange={(e) => setOfferedPartyId(e.target.value)}
          placeholder="All"
          className="border border-gray-300 rounded px-2 py-1 text-sm w-24"
        />
        <button
          type="button"
          onClick={applyOfferedFilter}
          className="rounded bg-gray-200 px-3 py-1 text-sm hover:bg-gray-300"
        >
          Filter
        </button>
      </div>

      {error && (
        <div className="rounded bg-red-50 text-red-800 px-3 py-2 text-sm" role="alert">
          {error}
        </div>
      )}

      {sheetLocked && (
        <div
          className="rounded border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {sheetLockReason ?? 'This datasheet is not editable in its current status.'}
        </div>
      )}

      {hasEdit && !sheetLocked && (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {reqValueSet && canEditValueSet(valueSets, reqValueSet.ValueSetID) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postStatus(reqValueSet.ValueSetID, 'Locked')}
              className="rounded bg-amber-100 px-3 py-1 hover:bg-amber-200 disabled:opacity-50"
            >
              Lock Requirement
            </button>
          )}
          {offeredValueSets.map(
            (vs) =>
              canEditValueSet(valueSets, vs.ValueSetID) && (
                <button
                  key={vs.ValueSetID}
                  type="button"
                  disabled={busy}
                  onClick={() => postStatus(vs.ValueSetID, 'Locked')}
                  className="rounded bg-amber-100 px-3 py-1 hover:bg-amber-200 disabled:opacity-50"
                >
                  Lock Offered (Party {vs.PartyID ?? '—'})
                </button>
              )
          )}
          {asBuiltValueSet && canEditValueSet(valueSets, asBuiltValueSet.ValueSetID) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => postStatus(asBuiltValueSet.ValueSetID, 'Verified')}
              className="rounded bg-green-100 px-3 py-1 hover:bg-green-200 disabled:opacity-50"
            >
              Verify As-Built
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1 text-left">Field</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Requirement</th>
              <th className="border border-gray-300 px-2 py-1 text-left">Offered</th>
              <th className="border border-gray-300 px-2 py-1 text-left">As-Built</th>
            </tr>
          </thead>
          <tbody>
            {compareData.subsheets.map((sub: CompareSubsheet) =>
              sub.fields.map((field: CompareFieldValue) => (
                <tr key={`${sub.id}-${field.infoTemplateId}`}>
                  <td className="border border-gray-300 px-2 py-1 font-medium">{field.label}</td>
                  <td className="border border-gray-300 px-2 py-1">
                    {field.requirement.value}
                    {field.requirement.uom ? ` ${field.requirement.uom}` : ''}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {field.offered.length === 0 ? (
                      '—'
                    ) : (
                      <div className="space-y-1">
                        {field.offered.map((o) => (
                          <OfferedCell
                            key={o.valueSetId}
                            value={o.value}
                            uom={o.uom}
                            varianceStatus={o.varianceStatus}
                            partyId={o.partyId}
                            valueSetId={o.valueSetId}
                            infoTemplateId={field.infoTemplateId}
                            canEdit={
                              hasEdit &&
                              !sheetLocked &&
                              canEditValueSet(valueSets, o.valueSetId)
                            }
                            busy={busy}
                            onPatch={patchVariance}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="border border-gray-300 px-2 py-1">
                    {field.asBuilt == null ? (
                      '—'
                    ) : (
                      <AsBuiltCell
                        value={field.asBuilt.value}
                        uom={field.asBuilt.uom}
                        varianceStatus={field.asBuilt.varianceStatus}
                        valueSetId={asBuiltValueSet?.ValueSetID}
                        infoTemplateId={field.infoTemplateId}
                        canEdit={
                          hasEdit &&
                          !sheetLocked &&
                          asBuiltValueSet != null &&
                          canEditValueSet(valueSets, asBuiltValueSet.ValueSetID)
                        }
                        busy={busy}
                        onPatch={patchVariance}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function VarianceBadge({ status }: { status: VarianceStatus }) {
  const label = status === 'DeviatesAccepted' ? 'Accepted' : 'Rejected'
  const cls =
    status === 'DeviatesAccepted'
      ? 'bg-green-100 text-green-800 rounded px-1 text-xs'
      : 'bg-red-100 text-red-800 rounded px-1 text-xs'
  return <span className={cls}>{label}</span>
}

function OfferedCell({
  value,
  uom,
  varianceStatus,
  partyId,
  valueSetId,
  infoTemplateId,
  canEdit,
  busy,
  onPatch,
}: {
  value: string
  uom: string | null
  varianceStatus?: VarianceStatus
  partyId: number | null
  valueSetId: number
  infoTemplateId: number
  canEdit: boolean
  busy: boolean
  onPatch: (valueSetId: number, infoTemplateId: number, status: VarianceStatus | null) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span>
        {value}
        {uom ? ` ${uom}` : ''}
      </span>
      {varianceStatus != null && <VarianceBadge status={varianceStatus} />}
      {canEdit && (
        <span className="flex gap-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, 'DeviatesAccepted')}
            className="text-xs text-green-700 hover:underline disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, 'DeviatesRejected')}
            className="text-xs text-red-700 hover:underline disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, null)}
            className="text-xs text-gray-600 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </span>
      )}
      {partyId != null && (
        <span className="text-gray-500 text-xs">(Party {partyId})</span>
      )}
    </div>
  )
}

function AsBuiltCell({
  value,
  uom,
  varianceStatus,
  valueSetId,
  infoTemplateId,
  canEdit,
  busy,
  onPatch,
}: {
  value: string
  uom: string | null
  varianceStatus?: VarianceStatus
  valueSetId: number | undefined
  infoTemplateId: number
  canEdit: boolean
  busy: boolean
  onPatch: (valueSetId: number, infoTemplateId: number, status: VarianceStatus | null) => void
}) {
  if (valueSetId == null) return null
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span>
        {value}
        {uom ? ` ${uom}` : ''}
      </span>
      {varianceStatus != null && <VarianceBadge status={varianceStatus} />}
      {canEdit && (
        <span className="flex gap-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, 'DeviatesAccepted')}
            className="text-xs text-green-700 hover:underline disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, 'DeviatesRejected')}
            className="text-xs text-red-700 hover:underline disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch(valueSetId, infoTemplateId, null)}
            className="text-xs text-gray-600 hover:underline disabled:opacity-50"
          >
            Clear
          </button>
        </span>
      )}
    </div>
  )
}
