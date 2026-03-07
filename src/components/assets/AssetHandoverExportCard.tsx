'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'

type ExportJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
const POLL_INTERVAL_MS = 2000

type Props = {
  assetId: number
}

export default function AssetHandoverExportCard({ assetId }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [exportJobId, setExportJobId] = useState<number | null>(() => {
    const id = searchParams.get('exportJobId')
    const n = id ? parseInt(id, 10) : NaN
    return Number.isInteger(n) && n > 0 ? n : null
  })
  const [exportStatus, setExportStatus] = useState<ExportJobStatus | null>(null)
  const [exportFileName, setExportFileName] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportDownloadUrl, setExportDownloadUrl] = useState<string | null>(null)
  const [exportRetrying, setExportRetrying] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync exportJobId from URL when it changes
  useEffect(() => {
    const id = searchParams.get('exportJobId')
    const n = id ? parseInt(id, 10) : NaN
    const next = Number.isInteger(n) && n > 0 ? n : null
    setExportJobId((prev) => (prev !== next ? next : prev))
  }, [searchParams])

  // Start export job
  const handleExportBinder = useCallback(async () => {
    setExportError(null)
    setExportDownloadUrl(null)
    setExportFileName(null)
    try {
      const r = await fetch('/api/backend/exports/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          jobType: 'handover_binder',
          params: { assetId },
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({ message: 'Failed to start export' }))
        toast.error(err.message || 'Failed to start export')
        setExportError(err.message || 'Failed to start export')
        return
      }
      const data = (await r.json()) as { jobId: number; status: string }
      setExportJobId(data.jobId)
      setExportStatus(data.status as ExportJobStatus)
      const next = new URLSearchParams(searchParams.toString())
      next.set('exportJobId', String(data.jobId))
      router.replace(`?${next.toString()}`, { scroll: false })
      toast.success('Handover binder export started')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to start export')
      setExportError('Failed to start export')
    }
  }, [assetId, router, searchParams])

  // Poll export job status when jobId is set
  useEffect(() => {
    if (exportJobId == null) return
    let isMounted = true
    const tick = async () => {
      if (!isMounted) return
      try {
        const r = await fetch(`/api/backend/exports/jobs/${exportJobId}`, {
          credentials: 'include',
        })
        if (!isMounted) return
        if (!r.ok) {
          if (r.status === 404) {
            if (isMounted) {
              setExportStatus('failed')
              setExportError('Job not found')
            }
            return
          }
          return
        }
        const job = (await r.json()) as {
          status: string
          errorMessage?: string | null
          fileName?: string | null
        }
        if (!isMounted) return
        setExportStatus(job.status as ExportJobStatus)
        if (job.status === 'completed') {
          setExportError(null)
          const urlRes = await fetch(`/api/backend/exports/jobs/${exportJobId}/download-url`, {
            credentials: 'include',
          })
          if (!isMounted) return
          if (urlRes.ok) {
            const urlData = (await urlRes.json()) as {
              downloadUrl: string
              fileName: string
            }
            if (isMounted) {
              setExportDownloadUrl(urlData.downloadUrl)
              setExportFileName(urlData.fileName)
            }
          }
          return
        }
        if (job.status === 'failed' || job.status === 'cancelled') {
          if (isMounted) {
            setExportError(job.errorMessage || job.status)
          }
        }
      } catch {
        // keep polling on network error (only if still mounted)
        if (!isMounted) return
      }
    }
    void tick()
    const id = setInterval(() => {
      void tick()
    }, POLL_INTERVAL_MS)
    pollRef.current = id
    return () => {
      isMounted = false
      clearInterval(id)
      pollRef.current = null
    }
  }, [exportJobId])

  // Stop polling when status is terminal
  useEffect(() => {
    const terminal = ['completed', 'failed', 'cancelled']
    if (exportStatus && terminal.includes(exportStatus) && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [exportStatus])

  const clearExportJob = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setExportJobId(null)
    setExportStatus(null)
    setExportFileName(null)
    setExportError(null)
    setExportDownloadUrl(null)
    const next = new URLSearchParams(searchParams.toString())
    next.delete('exportJobId')
    const q = next.toString()
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    router.replace(q ? `?${q}` : currentPath, { scroll: false })
  }, [router, searchParams])

  const handleRetryExport = useCallback(async () => {
    if (exportJobId == null || exportStatus !== 'failed') return
    setExportRetrying(true)
    setExportError(null)
    try {
      const r = await fetch(`/api/backend/exports/jobs/${exportJobId}/retry`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await r.json().catch(() => ({} as Record<string, unknown>))
      if (!r.ok) {
        const msg = (data as { message?: string }).message ?? 'Failed to retry export'
        toast.error(msg)
        setExportError(msg)
        return
      }
      setExportStatus((data as { status?: string }).status as ExportJobStatus ?? 'queued')
      toast.success('Export retry started')
    } catch (err) {
      console.error('Retry export error:', err)
      toast.error('Failed to retry export')
    } finally {
      setExportRetrying(false)
    }
  }, [exportJobId, exportStatus])

  return (
    <div className="border rounded p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">Export Handover Binder</h3>
        {!exportJobId && (
          <button
            onClick={handleExportBinder}
            className="border rounded px-3 py-1.5 bg-blue-600 text-white text-sm hover:bg-blue-700"
          >
            Export Binder
          </button>
        )}
      </div>

      {exportJobId != null && (
        <div className="mt-3 space-y-2">
          <div className="text-xs text-gray-600">
            <span className="font-medium">Export job #{exportJobId}</span>
            {exportStatus && (
              <span className="ml-2">
                Status: {exportStatus}
                {(exportStatus === 'queued' || exportStatus === 'running') && '…'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {exportStatus === 'completed' && exportDownloadUrl && (
              <a
                href={exportDownloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border rounded px-3 py-1.5 bg-green-600 text-white text-xs hover:bg-green-700"
              >
                Download {exportFileName || 'Binder'}
              </a>
            )}
            {exportStatus === 'failed' && (
              <button
                type="button"
                onClick={handleRetryExport}
                disabled={exportRetrying}
                className="border rounded px-3 py-1.5 bg-amber-600 text-white text-xs hover:bg-amber-700 disabled:opacity-50"
              >
                {exportRetrying ? 'Retrying…' : 'Retry'}
              </button>
            )}
            {(exportStatus === 'failed' || exportStatus === 'cancelled' || exportStatus === 'completed') && (
              <button
                type="button"
                onClick={clearExportJob}
                className="border rounded px-3 py-1.5 text-xs"
              >
                Dismiss
              </button>
            )}
          </div>
          {exportError && <p className="text-xs text-red-600">{exportError}</p>}
        </div>
      )}

      {!exportJobId && (
        <p className="text-xs text-gray-600 mt-2">
          Generate a ZIP file containing asset summary, checklists, documents, and datasheets for handover.
        </p>
      )}
    </div>
  )
}
