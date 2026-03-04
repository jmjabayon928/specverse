'use client'

import type { MelAssetsSearchParams } from './melTypes'

type Props = {
  params: MelAssetsSearchParams
  onParamsChange: (next: MelAssetsSearchParams) => void
  onSearchChange: (q: string) => void
  onClearFilters?: () => void
  debouncedQ: string
}

const TAKE_OPTIONS = [25, 50, 100, 200] as const
const CRITICALITY_OPTIONS = ['', 'HIGH', 'MEDIUM', 'LOW'] as const

export default function MelAssetsFilters({
  params,
  onParamsChange,
  onSearchChange,
  onClearFilters,
  debouncedQ,
}: Props) {
  const setOne = (key: keyof MelAssetsSearchParams, value: string | number | undefined) => {
    const next = { ...params, [key]: value }
    if (key === 'q') onSearchChange(value === undefined ? '' : String(value))
    else if (key === 'take') onParamsChange(next)
    else onParamsChange({ ...next, skip: 0 })
  }

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      <div>
        <label htmlFor="mel-q" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
        <input
          id="mel-q"
          type="text"
          value={debouncedQ}
          onChange={e => setOne('q', e.target.value)}
          placeholder="Tag or name…"
          className="w-48 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-criticality" className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
        <select
          id="mel-criticality"
          value={params.criticality ?? ''}
          onChange={e => setOne('criticality', e.target.value || undefined)}
          className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          {CRITICALITY_OPTIONS.map(opt => (
            <option key={opt || 'any'} value={opt}>{opt || 'Any'}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="mel-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
        <input
          id="mel-location"
          type="text"
          value={params.location ?? ''}
          onChange={e => setOne('location', e.target.value || undefined)}
          className="w-40 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-system" className="block text-sm font-medium text-gray-700 mb-1">System</label>
        <input
          id="mel-system"
          type="text"
          value={params.system ?? ''}
          onChange={e => setOne('system', e.target.value || undefined)}
          className="w-40 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-service" className="block text-sm font-medium text-gray-700 mb-1">Service</label>
        <input
          id="mel-service"
          type="text"
          value={params.service ?? ''}
          onChange={e => setOne('service', e.target.value || undefined)}
          className="w-40 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-clientId" className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
        <input
          id="mel-clientId"
          type="number"
          value={params.clientId ?? ''}
          onChange={e => setOne('clientId', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-projectId" className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
        <input
          id="mel-projectId"
          type="number"
          value={params.projectId ?? ''}
          onChange={e => setOne('projectId', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-disciplineId" className="block text-sm font-medium text-gray-700 mb-1">Discipline ID</label>
        <input
          id="mel-disciplineId"
          type="number"
          value={params.disciplineId ?? ''}
          onChange={e => setOne('disciplineId', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-subtypeId" className="block text-sm font-medium text-gray-700 mb-1">Subtype ID</label>
        <input
          id="mel-subtypeId"
          type="number"
          value={params.subtypeId ?? ''}
          onChange={e => setOne('subtypeId', e.target.value === '' ? undefined : Number(e.target.value))}
          className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm"
        />
      </div>
      <div>
        <label htmlFor="mel-take" className="block text-sm font-medium text-gray-700 mb-1">Page size</label>
        <select
          id="mel-take"
          value={params.take}
          onChange={e => setOne('take', Number(e.target.value))}
          className="w-20 px-2 py-1.5 border border-gray-300 rounded text-sm"
        >
          {TAKE_OPTIONS.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      {onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}
