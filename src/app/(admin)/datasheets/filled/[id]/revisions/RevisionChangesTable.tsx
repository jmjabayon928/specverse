'use client'

import type { DiffRow } from '@/domain/datasheets/revisionDiff'
import { formatDiffValue } from './formatDiffValue'

type Props = Readonly<{
  rows: DiffRow[]
  showUnchanged: boolean
  onShowUnchangedChange: (value: boolean) => void
}>

export default function RevisionChangesTable({
  rows,
  showUnchanged,
  onShowUnchangedChange,
}: Props) {
  const visible = showUnchanged ? rows : rows.filter((r) => r.kind !== 'unchanged')

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showUnchanged}
          onChange={(e) => onShowUnchangedChange(e.target.checked)}
        />
        Show unchanged
      </label>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Section / Subsheet
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Field
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Old value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                New value
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kind
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-500">
                  No changes to display
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.key} className="hover:bg-gray-50">
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{r.subsheetName}</td>
                  <td className="px-4 py-2 text-sm text-gray-900">{r.label}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 font-mono">{formatDiffValue(r.oldValue)}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 font-mono">{formatDiffValue(r.newValue)}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{r.kind}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
