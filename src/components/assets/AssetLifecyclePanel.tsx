// src/components/assets/AssetLifecyclePanel.tsx

type Props = {
  assetId: number
  lastUpdated?: string
}

const FALLBACK = '—'

function safeDisplay(value: string | null | undefined): string {
  if (value == null || value.trim() === '') return FALLBACK
  return value
}

const LIFECYCLE_LABELS = ['Commissioned', 'Operational', 'Maintenance'] as const

export default function AssetLifecyclePanel({ lastUpdated }: Props) {
  const lastUpdatedDisplay = safeDisplay(lastUpdated)
  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Lifecycle</h2>
      <ul className="space-y-2 text-sm">
        {LIFECYCLE_LABELS.map((label) => (
          <li key={label} className="flex justify-between gap-4">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium">{FALLBACK}</span>
          </li>
        ))}
        <li className="flex justify-between gap-4 pt-2 border-t border-gray-100">
          <span className="text-gray-600">Last Updated</span>
          <span className="font-medium">{lastUpdatedDisplay}</span>
        </li>
      </ul>
    </div>
  )
}
