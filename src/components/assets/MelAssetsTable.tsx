'use client'

import Link from 'next/link'
import type { MelAssetListItem } from './melTypes'

type Props = {
  rows: MelAssetListItem[]
}

function criticalityClass(c: string | null): string {
  if (!c) return 'bg-gray-100 text-gray-600'
  const u = c.toUpperCase()
  if (u === 'HIGH') return 'bg-red-100 text-red-800'
  if (u === 'MEDIUM') return 'bg-orange-100 text-orange-800'
  if (u === 'LOW') return 'bg-gray-100 text-gray-800'
  return 'bg-gray-100 text-gray-600'
}

export default function MelAssetsTable({ rows }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Tag</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Name</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Location</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">System</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Service</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Criticality</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Score</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Discipline</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Subtype</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Client</th>
            <th className="border border-gray-200 px-2 py-1.5 text-left">Project</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.assetId} className="hover:bg-gray-50">
              <td className="border border-gray-200 px-2 py-1.5">
                <Link href={`/assets/${row.assetId}`} className="text-blue-600 underline">
                  {row.assetTag}
                </Link>
              </td>
              <td className="border border-gray-200 px-2 py-1.5">{row.assetName ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.location ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.system ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.service ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${criticalityClass(row.criticality)}`}>
                  {row.criticality ?? '—'}
                </span>
              </td>
              <td className="border border-gray-200 px-2 py-1.5">{row.completenessScore}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.disciplineId ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.subtypeId ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.clientId ?? '—'}</td>
              <td className="border border-gray-200 px-2 py-1.5">{row.projectId ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
