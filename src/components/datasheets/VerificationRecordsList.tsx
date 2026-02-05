// src/components/datasheets/VerificationRecordsList.tsx
'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type VerificationRecordItem = {
  verificationRecordId: number
}

type CreateResponse = {
  verificationRecordId: number
}

type EvidenceItem = {
  attachmentId: number
  verificationRecordId: number
}

type SheetAttachmentOption = {
  attachmentId: number
  originalName: string
}

type VerificationRecordType = {
  verificationTypeId: number
  code: string
  name: string
  status: string
}

interface VerificationRecordsListProps {
  sheetId: number
  sheetAttachments?: SheetAttachmentOption[]
}

export default function VerificationRecordsList(props: Readonly<VerificationRecordsListProps>) {
  const { sheetId, sheetAttachments = [] } = props

  const [records, setRecords] = useState<VerificationRecordItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [defaultVerificationTypeId, setDefaultVerificationTypeId] = useState<number>(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)
  const [evidenceError, setEvidenceError] = useState<string | null>(null)
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<number | null>(null)
  const [isAttaching, setIsAttaching] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadRecords = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/backend/datasheets/${sheetId}/verification-records`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error(`Failed to load verification records (${response.status})`)
      }

      const data = (await response.json()) as VerificationRecordItem[]

      if (isMountedRef.current) {
        setRecords(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      if (isMountedRef.current) {
        const message =
          e instanceof Error ? e.message : 'Unable to load verification records'
        setError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [sheetId])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  useEffect(() => {
    const loadTypes = async () => {
      try {
        const response = await fetch('/api/backend/verification-records/verification-record-types', {
          credentials: 'include',
        })

        if (response.ok) {
          const types = (await response.json()) as VerificationRecordType[]
          const norm = (s: string) => s.trim().toUpperCase()
          const genType = types.find((t) => t.status === 'Active' && norm(t.code) === 'GEN')
          const activeType = genType ?? types.find((t) => t.status === 'Active')
          if (activeType && isMountedRef.current) {
            setDefaultVerificationTypeId(activeType.verificationTypeId)
          }
        }
      } catch {
        // Fallback to default (1) if fetch fails
      }
    }

    loadTypes()
  }, [])

  const handleCreateAndLink = async () => {
    if (!isMountedRef.current) {
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const createResponse = await fetch('/api/backend/verification-records', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ verificationTypeId: defaultVerificationTypeId, result: 'Pending' }),
      })

      if (!createResponse.ok) {
        const status = createResponse.status
        let errorText = 'Unknown error'
        try {
          if (typeof createResponse.text === 'function') {
            errorText = await createResponse.text()
          }
        } catch {
          // Ignore text parsing errors
        }
        throw new Error(`Create failed (${status}): ${errorText}`)
      }

      if (!isMountedRef.current) {
        return
      }

      const created = (await createResponse.json()) as CreateResponse
      const verificationRecordId = created.verificationRecordId

      const linkResponse = await fetch(
        `/api/backend/verification-records/${verificationRecordId}/link`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sheetId }),
        }
      )

      if (!linkResponse.ok) {
        throw new Error(`Link failed (${linkResponse.status})`)
      }

      if (!isMountedRef.current) {
        return
      }

      await loadRecords()
    } catch (e) {
      if (isMountedRef.current) {
        const message =
          e instanceof Error ? e.message : 'Failed to create and link verification record'
        setCreateError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsCreating(false)
      }
    }
  }

  const loadEvidence = useCallback(async (verificationRecordId: number) => {
    if (!isMountedRef.current) {
      return
    }

    setEvidenceLoading(true)
    setEvidenceError(null)

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
        setEvidence(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      if (isMountedRef.current) {
        const message =
          e instanceof Error ? e.message : 'Unable to load evidence'
        setEvidenceError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setEvidenceLoading(false)
      }
    }
  }, [])

  const toggleEvidence = (verificationRecordId: number) => {
    if (expandedId === verificationRecordId) {
      setExpandedId(null)
      setEvidence([])
      setEvidenceError(null)
    } else {
      setExpandedId(verificationRecordId)
      loadEvidence(verificationRecordId)
    }
  }

  const handleAttachEvidence = async (verificationRecordId: number) => {
    if (!isMountedRef.current || !selectedAttachmentId) {
      return
    }

    const alreadyAttached = evidence.some((item) => item.attachmentId === selectedAttachmentId)
    if (alreadyAttached) {
      if (isMountedRef.current) {
        setAttachError('Already attached')
      }
      return
    }

    setIsAttaching(true)
    setAttachError(null)

    try {
      const response = await fetch(
        `/api/backend/verification-records/${verificationRecordId}/attachments`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ attachmentId: selectedAttachmentId }),
        }
      )

      if (!response.ok) {
        if (response.status === 409 || response.status === 400) {
          throw new Error(`Already attached (${response.status})`)
        }
        throw new Error(`Attach failed (${response.status})`)
      }

      if (!isMountedRef.current) {
        return
      }

      setSelectedAttachmentId(null)
      await loadEvidence(verificationRecordId)
    } catch (e) {
      if (isMountedRef.current) {
        const message =
          e instanceof Error ? e.message : 'Failed to attach evidence'
        setAttachError(message)
      }
    } finally {
      if (isMountedRef.current) {
        setIsAttaching(false)
      }
    }
  }

  if (isLoading) {
    return <p className='text-sm text-gray-500'>Loading verification records…</p>
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <button
          type='button'
          onClick={handleCreateAndLink}
          disabled={isLoading || isCreating}
          className='px-3 py-1.5 text-sm rounded border hover:shadow disabled:opacity-50 disabled:cursor-not-allowed'
        >
          {isCreating ? 'Creating…' : 'Create & Link'}
        </button>
      </div>

      {createError && (
        <p className='text-sm text-red-600' aria-live='polite'>
          {createError}
        </p>
      )}

      {error && (
        <p className='text-sm text-red-600' aria-live='polite'>
          {error}
        </p>
      )}

      {records.length === 0 && !error && (
        <p className='text-sm text-gray-500'>No verification records linked to this sheet.</p>
      )}

      {records.length > 0 && (
        <div className='space-y-4'>
          {records.map((record) => {
            const isExpanded = expandedId === record.verificationRecordId
            return (
              <div key={record.verificationRecordId} className='border rounded p-3'>
                <div className='flex items-center justify-between'>
                  <div className='text-sm font-medium'>VR-{record.verificationRecordId}</div>
                  <button
                    type='button'
                    onClick={() => toggleEvidence(record.verificationRecordId)}
                    className='px-2 py-1 text-xs rounded border hover:shadow'
                  >
                    Evidence {isExpanded ? '▲' : '▼'}
                  </button>
                </div>

                {isExpanded && (
                  <div className='mt-3 space-y-2'>
                    {evidenceLoading && (
                      <p className='text-xs text-gray-500'>Loading evidence…</p>
                    )}

                    {evidenceError && (
                      <p className='text-xs text-red-600' aria-live='polite'>
                        {evidenceError}
                      </p>
                    )}

                    {!evidenceLoading && !evidenceError && evidence.length === 0 && (
                      <p className='text-xs text-gray-500'>No evidence attached.</p>
                    )}

                    {!evidenceLoading && !evidenceError && evidence.length > 0 && (
                      <div className='space-y-1'>
                        <div className='text-xs font-medium text-gray-700'>Evidence:</div>
                        {evidence.map((item) => {
                          const attachment = sheetAttachments.find(
                            (a) => a.attachmentId === item.attachmentId
                          )
                          return (
                            <div key={item.attachmentId} className='text-xs pl-2'>
                              {attachment?.originalName ?? `Attachment ${item.attachmentId}`}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {sheetAttachments.length > 0 && (
                      <div className='mt-3 pt-3 border-t space-y-2'>
                        <div className='text-xs font-medium text-gray-700'>Attach evidence:</div>
                        <div className='flex items-center gap-2'>
                          <select
                            value={selectedAttachmentId ?? ''}
                            onChange={(e) =>
                              setSelectedAttachmentId(
                                e.target.value ? Number.parseInt(e.target.value, 10) : null
                              )
                            }
                            className='text-xs border rounded px-2 py-1 flex-1'
                            disabled={isAttaching}
                          >
                            <option value=''>Select attachment…</option>
                            {sheetAttachments.map((att) => (
                              <option key={att.attachmentId} value={att.attachmentId}>
                                {att.originalName}
                              </option>
                            ))}
                          </select>
                          <button
                            type='button'
                            onClick={() => handleAttachEvidence(record.verificationRecordId)}
                            disabled={!selectedAttachmentId || isAttaching}
                            className='px-2 py-1 text-xs rounded border hover:shadow disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            {isAttaching ? 'Attaching…' : 'Attach'}
                          </button>
                        </div>
                        {attachError && (
                          <p className='text-xs text-red-600' aria-live='polite'>
                            {attachError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
