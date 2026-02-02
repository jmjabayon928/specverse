'use client'

import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isUnifiedSheet(value: unknown): value is UnifiedSheet {
  if (!isPlainObject(value)) return false
  const subsheets = (value as { subsheets?: unknown }).subsheets
  return Array.isArray(subsheets)
}

function stringifyValue(value: string | number | null | undefined): string {
  if (value == null) return '—'
  return String(value)
}

type RevisionMeta = Readonly<{
  revisionNumber: number
  createdAt: string
  createdByName: string | null
  status: string | null
  comment: string | null
}>

type Props = Readonly<{
  snapshot: unknown
  meta: RevisionMeta
}>

export default function RevisionSnapshotView({ snapshot, meta }: Props) {
  if (!isUnifiedSheet(snapshot)) {
    return (
      <p className="text-sm text-gray-600">
        Snapshot is not in a structured format. Use the Raw JSON tab to inspect.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <span className="font-medium text-gray-700">Revision:</span>{' '}
            <span className="text-gray-900">#{meta.revisionNumber}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Status:</span>{' '}
            <span className="text-gray-900">{meta.status ?? '—'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Date:</span>{' '}
            <span className="text-gray-900">{new Date(meta.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Created by:</span>{' '}
            <span className="text-gray-900">{meta.createdByName ?? '—'}</span>
          </div>
        </div>
        {meta.comment && (
          <div className="mt-2">
            <span className="font-medium text-gray-700">Comment:</span>{' '}
            <span className="text-gray-900">{meta.comment}</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {snapshot.subsheets.map((sub, idx) => (
          <details
            key={sub.originalId ?? sub.id ?? idx}
            className="rounded border border-gray-200 bg-white"
          >
            <summary className="cursor-pointer px-4 py-2 font-medium text-gray-800 hover:bg-gray-50">
              {sub.name}
            </summary>
            <div className="border-t border-gray-200 px-4 py-2">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {sub.fields.map((field) => (
                    <tr key={field.originalId ?? field.id ?? field.label}>
                      <td className="py-1.5 pr-4 font-medium text-gray-700">{field.label}</td>
                      <td className="py-1.5 text-gray-900">
                        {stringifyValue(field.value)}
                        {field.uom ? ` ${field.uom}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
