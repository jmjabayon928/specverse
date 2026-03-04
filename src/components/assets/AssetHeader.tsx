// src/components/assets/AssetHeader.tsx
import Link from 'next/link'

export type AssetHeaderAsset = {
  assetId: number
  assetTag: string
  assetName: string
  disciplineId?: number
  location?: string
  criticality?: string
}

type Props = {
  asset: AssetHeaderAsset
  assetId: number
}

const FALLBACK = '—'

function safeDisplayString(value: string | null | undefined): string {
  if (value == null || value.trim() === '') return FALLBACK
  return value
}

function safeDisplayNumber(value: number | null | undefined): string {
  if (value == null) return FALLBACK
  return String(value)
}

function criticalityBadgeClass(criticality: string): string {
  const u = criticality.toUpperCase()
  if (u === 'HIGH') return 'bg-red-100 text-red-800'
  if (u === 'MEDIUM') return 'bg-orange-100 text-orange-800'
  if (u === 'LOW') return 'bg-gray-100 text-gray-800'
  return 'bg-gray-100 text-gray-600'
}

function CriticalityBadge({ criticality }: { criticality?: string | null }) {
  const display = safeDisplayString(criticality)
  if (display === FALLBACK) {
    return <span className="text-sm text-gray-600">{FALLBACK}</span>
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${criticalityBadgeClass(criticality!)}`}>
      {criticality}
    </span>
  )
}

function sep() {
  return <span className="text-gray-400 mx-2">|</span>
}

export default function AssetHeader({ asset }: Props) {
  const disciplineDisplay = safeDisplayNumber(asset?.disciplineId)
  const locationDisplay = safeDisplayString(asset?.location)
  const hasCriticality = asset?.criticality != null && asset.criticality.trim() !== ''

  return (
    <header className="border-b pb-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-gray-900">
            {asset?.assetTag ?? FALLBACK}
            {asset?.assetName?.trim() ? ` – ${asset.assetName}` : ''}
          </h1>
          <div className="text-sm text-gray-600 flex flex-wrap items-center gap-2">
            {hasCriticality ? (
              <CriticalityBadge criticality={asset.criticality} />
            ) : (
              <span>{FALLBACK}</span>
            )}
            {sep()}
            <span>{disciplineDisplay}</span>
            {sep()}
            <span>{locationDisplay}</span>
          </div>
        </div>
        <Link
          href="/assets"
          className="text-sm text-blue-600 underline whitespace-nowrap"
        >
          Back to MEL
        </Link>
      </div>
    </header>
  )
}
