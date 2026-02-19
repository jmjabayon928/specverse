// src/app/(admin)/verification-records/page.tsx
'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import SecurePage from '@/components/security/SecurePage'
import PageContextBanner from '@/components/demo/PageContextBanner'
import { PERMISSIONS } from '@/constants/permissions'

type VerificationRecordRow = {
  verificationRecordId: number
  accountId: number
}

type EvidenceItem = {
  attachmentId: number
  verificationRecordId: number
}

export default function VerificationRecordsPage() {
  const [records, setRecords] = useState<VerificationRecordRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20
  const [idFilter, setIdFilter] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [evidenceData, setEvidenceData] = useState<Map<number, EvidenceItem[]>>(new Map())
  const [evidenceLoading, setEvidenceLoading] = useState<Map<number, boolean>>(new Map())
  const [evidenceError, setEvidenceError] = useState<Map<number, string | null>>(new Map())
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadRecords = useCallback(async () => {
    if (!isMountedRef.current) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const idFilterNum = idFilter.trim() ? Number.parseInt(idFilter.trim(), 10) : null

      if (idFilterNum !== null && Number.isFinite(idFilterNum) && idFilterNum > 0) {
        const response = await fetch(`/api/backend/verification-records/${idFilterNum}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          if (response.status === 404) {
            if (isMountedRef.current) {
              setError(`Verification record ${idFilterNum} not found`)
              setRecords([])
            }
            return
          }
          throw new Error(`Failed to load verification record (${response.status})`)
        }

        const data = (await response.json()) as VerificationRecordRow

        if (isMountedRef.current) {
          setRecords([data])
        }
      } else {
        const offset = (page - 1) * pageSize
        const response = await fetch(
          `/api/backend/verification-records?limit=${pageSize}&offset=${offset}`,
          {
            credentials: 'include',
          }
        )

        if (!response.ok) {
          throw new Error(`Failed to load verification records (${response.status})`)
        }

        const data = (await response.json()) as VerificationRecordRow[]

        if (isMountedRef.current) {
          setRecords(Array.isArray(data) ? data : [])
        }
      }
    } catch (e) {
      if (isMountedRef.current) {
        const message = e instanceof Error ? e.message : 'Unable to load verification records'
        setError(message)
        setRecords([])
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [idFilter, page, pageSize])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  const loadEvidence = useCallback(async (verificationRecordId: number) => {
    if (!isMountedRef.current) {
      return
    }

    setEvidenceLoading((prev) => new Map(prev).set(verificationRecordId, true))
    setEvidenceError((prev) => new Map(prev).set(verificationRecordId, null))

    try {
      const response = await fetch(
        `/api/backend/verification-records/${verificationRecordId}/attachments`,
        {
          credentials: 'include',
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to load evidence (${response.status})`)
      }

      const data = (await response.json()) as EvidenceItem[]

      if (isMountedRef.current) {
        setEvidenceData((prev) => new Map(prev).set(verificationRecordId, Array.isArray(data) ? data : []))
      }
    } catch (e) {
      if (isMountedRef.current) {
        const message = e instanceof Error ? e.message : 'Unable to load evidence'
        setEvidenceError((prev) => new Map(prev).set(verificationRecordId, message))
      }
    } finally {
      if (isMountedRef.current) {
        setEvidenceLoading((prev) => new Map(prev).set(verificationRecordId, false))
      }
    }
  }, [])

  const toggleEvidence = (verificationRecordId: number) => {
    if (expandedId === verificationRecordId) {
      setExpandedId(null)
    } else {
      setExpandedId(verificationRecordId)
      if (!evidenceData.has(verificationRecordId)) {
        loadEvidence(verificationRecordId)
      }
    }
  }

  const handleApplyFilter = () => {
    setPage(1)
    loadRecords()
  }

  const handleClearFilter = () => {
    setIdFilter('')
    setPage(1)
  }

  const showPagination = idFilter.trim() === ''
  const hasNext = showPagination && records.length === pageSize
  const hasPrevious = showPagination && page > 1

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      <PageContextBanner module="verification" />
      <div className='p-6 space-y-4'>
        <h1 className='text-2xl font-bold'>Verification Records</h1>

        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium'>Filter by ID:</label>
          <input
            type='text'
            value={idFilter}
            onChange={(e) => setIdFilter(e.target.value)}
            placeholder='Enter verification record ID'
            className='border rounded px-3 py-1 text-sm'
          />
          <button
            type='button'
            onClick={handleApplyFilter}
            className='px-3 py-1 text-sm rounded border hover:shadow'
          >
            Apply
          </button>
          {idFilter.trim() && (
            <button
              type='button'
              onClick={handleClearFilter}
              className='px-3 py-1 text-sm rounded border hover:shadow'
            >
              Clear
            </button>
          )}
        </div>

        {loading && <p className='text-sm text-gray-500'>Loading verification records…</p>}

        {error && (
          <p className='text-sm text-red-600' aria-live='polite'>
            {error}
          </p>
        )}

        {!loading && !error && records.length === 0 && (
          <p className='text-sm text-gray-500'>No verification records found.</p>
        )}

        {!loading && !error && records.length > 0 && (
          <div className='space-y-2'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='text-left border-b'>
                  <th className='py-2 px-2'>ID</th>
                  <th className='py-2 px-2'>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isExpanded = expandedId === record.verificationRecordId
                  const evidence = evidenceData.get(record.verificationRecordId) ?? []
                  const evidenceIsLoading = evidenceLoading.get(record.verificationRecordId) ?? false
                  const evidenceErr = evidenceError.get(record.verificationRecordId)

                  return (
                    <React.Fragment key={record.verificationRecordId}>
                      <tr className='border-b'>
                        <td className='py-2 px-2'>VR-{record.verificationRecordId}</td>
                        <td className='py-2 px-2'>
                          <button
                            type='button'
                            onClick={() => toggleEvidence(record.verificationRecordId)}
                            className='px-2 py-1 text-xs rounded border hover:shadow'
                          >
                            Evidence {isExpanded ? '▲' : '▼'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className='border-b'>
                          <td colSpan={2} className='py-2 px-2'>
                            <div className='pl-4 space-y-1'>
                              {evidenceIsLoading && (
                                <p className='text-xs text-gray-500'>Loading evidence…</p>
                              )}

                              {evidenceErr && (
                                <p className='text-xs text-red-600' aria-live='polite'>
                                  {evidenceErr}
                                </p>
                              )}

                              {!evidenceIsLoading && !evidenceErr && evidence.length === 0 && (
                                <p className='text-xs text-gray-500'>No evidence attached.</p>
                              )}

                              {!evidenceIsLoading && !evidenceErr && evidence.length > 0 && (
                                <div className='space-y-1'>
                                  <div className='text-xs font-medium text-gray-700'>Evidence:</div>
                                  {evidence.map((item) => (
                                    <div key={item.attachmentId} className='text-xs pl-2'>
                                      Attachment {item.attachmentId}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {showPagination && (
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrevious}
              className='px-3 py-1 text-sm rounded border hover:shadow disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Previous
            </button>
            <span className='text-sm text-gray-600'>Page {page}</span>
            <button
              type='button'
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasNext}
              className='px-3 py-1 text-sm rounded border hover:shadow disabled:opacity-50 disabled:cursor-not-allowed'
            >
              Next
            </button>
          </div>
        )}
      </div>
    </SecurePage>
  )
}
