'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ScheduleHeader = {
  scheduleId: number
  name: string
  scope: string | null
  disciplineId: number | null
  subtypeId: number | null
  clientId: number | null
  projectId: number | null
}

export default function SchedulesList() {
  const [schedules, setSchedules] = useState<ScheduleHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clientId, setClientId] = useState<string>('')
  const [projectId, setProjectId] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createScope, setCreateScope] = useState('')
  const [createDisciplineId, setCreateDisciplineId] = useState('')
  const [createSubtypeId, setCreateSubtypeId] = useState('')
  const [createClientId, setCreateClientId] = useState('')
  const [createProjectId, setCreateProjectId] = useState('')
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const fetchSchedules = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (clientId.trim()) params.set('clientId', clientId.trim())
    if (projectId.trim()) params.set('projectId', projectId.trim())
    const res = await fetch(`/api/backend/schedules?${params.toString()}`, { credentials: 'include' })
    if (!res.ok) {
      const text = await res.text()
      setError(text || `Error ${res.status}`)
      setSchedules([])
      setLoading(false)
      return
    }
    const data = await res.json()
    setSchedules(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [clientId, projectId])

  useEffect(() => {
    fetchSchedules()
  }, [fetchSchedules])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError(null)
    const dId = createDisciplineId.trim() ? Number(createDisciplineId) : undefined
    const sId = createSubtypeId.trim() ? Number(createSubtypeId) : undefined
    if (dId == null || !Number.isFinite(dId) || sId == null || !Number.isFinite(sId)) {
      setCreateError('Discipline and Subtype are required numbers')
      return
    }
    setCreateSaving(true)
    const res = await fetch('/api/backend/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: createName.trim() || 'Unnamed Schedule',
        scope: createScope.trim() || null,
        disciplineId: dId,
        subtypeId: sId,
        clientId: createClientId.trim() ? Number(createClientId) : null,
        projectId: createProjectId.trim() ? Number(createProjectId) : null,
      }),
    })
    if (!res.ok) {
      const text = await res.text()
      setCreateError(text || `Error ${res.status}`)
      setCreateSaving(false)
      return
    }
    const created = await res.json()
    setCreateSaving(false)
    setShowCreate(false)
    setCreateName('')
    setCreateScope('')
    setCreateDisciplineId('')
    setCreateSubtypeId('')
    setCreateClientId('')
    setCreateProjectId('')
    if (created?.scheduleId) {
      window.location.href = `/schedules/${created.scheduleId}`
    } else {
      fetchSchedules()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="border rounded px-2 py-1 w-32"
            placeholder="Optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Project ID</label>
          <input
            type="text"
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            className="border rounded px-2 py-1 w-32"
            placeholder="Optional"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded bg-blue-600 text-white px-4 py-2"
        >
          Create schedule
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="border rounded p-4 bg-gray-50 space-y-3 max-w-md">
          <h3 className="font-semibold">New schedule</h3>
          <div>
            <label className="block text-sm">Name</label>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm">Scope (optional)</label>
            <input
              type="text"
              value={createScope}
              onChange={e => setCreateScope(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm">Discipline ID</label>
            <input
              type="text"
              value={createDisciplineId}
              onChange={e => setCreateDisciplineId(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm">Subtype ID</label>
            <input
              type="text"
              value={createSubtypeId}
              onChange={e => setCreateSubtypeId(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm">Client ID (optional)</label>
            <input
              type="text"
              value={createClientId}
              onChange={e => setCreateClientId(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          <div>
            <label className="block text-sm">Project ID (optional)</label>
            <input
              type="text"
              value={createProjectId}
              onChange={e => setCreateProjectId(e.target.value)}
              className="border rounded px-2 py-1 w-full"
            />
          </div>
          {createError && <p className="text-red-600 text-sm">{createError}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={createSaving} className="rounded bg-green-600 text-white px-4 py-2">
              {createSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="rounded border px-4 py-2">
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-red-600">{error}</p>}
      {loading && <p>Loading…</p>}
      {!loading && !error && (
        <table className="min-w-full border-collapse border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Name</th>
              <th className="border px-2 py-1 text-left">Scope</th>
              <th className="border px-2 py-1 text-left">Schedule ID</th>
              <th className="border px-2 py-1 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={4} className="border px-2 py-2 text-gray-500">
                  No schedules found.
                </td>
              </tr>
            ) : (
              schedules.map(s => (
                <tr key={s.scheduleId}>
                  <td className="border px-2 py-1">{s.name}</td>
                  <td className="border px-2 py-1">{s.scope ?? '—'}</td>
                  <td className="border px-2 py-1">{s.scheduleId}</td>
                  <td className="border px-2 py-1">
                    <Link href={`/schedules/${s.scheduleId}`} className="text-blue-600 underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}
