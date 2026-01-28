// src/components/datasheets/ChangeLogTable.tsx
'use client'

import { useEffect, useState } from 'react'

type LogEntry = {
  id: number
  kind: 'audit' | 'change'
  sheetId: number
  action: string
  user: { id: number | null; name: string }
  timestamp: string
  details: Record<string, unknown>
}

type LogsResponse = {
  limit: number
  items: LogEntry[]
}

interface ChangeLogTableProps {
  sheetId: number
}

export default function ChangeLogTable(props: Readonly<ChangeLogTableProps>) {
  const { sheetId } = props

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadLogs() {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/backend/sheets/${sheetId}/logs?limit=50`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error(`Failed to load changelog (${response.status})`)
        }

        const data = (await response.json()) as LogsResponse

        if (!cancelled) {
          setLogs(Array.isArray(data?.items) ? data.items : [])
        }
      } catch (e) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : 'Unable to load changelog entries'
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadLogs()

    return () => {
      cancelled = true
    }
  }, [sheetId])

  if (isLoading) {
    return <p className='text-sm text-gray-500'>Loading change log…</p>
  }

  if (error) {
    return (
      <p className='text-sm text-red-600' aria-live='polite'>
        {error}
      </p>
    )
  }

  if (logs.length === 0) {
    return <p className='text-sm text-gray-500'>No change logs available.</p>
  }

  return (
    <table className='w-full text-sm border'>
      <thead>
        <tr className='bg-gray-100 text-left'>
          <th className='px-4 py-2'>Date</th>
          <th className='px-4 py-2'>Action</th>
          <th className='px-4 py-2'>Performed by</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={`${log.kind}-${log.id}`} className='border-t'>
            <td className='px-4 py-2'>
              {new Date(log.timestamp).toLocaleString()}
            </td>
            <td className='px-4 py-2'>{log.action}</td>
            <td className='px-4 py-2'>{log.user?.name ?? 'Unknown'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
