// src/components/assets/AssetIdentityPanel.tsx

export type AssetIdentityAsset = {
  system?: string
  service?: string
  criticality?: string
  createdAt?: string
  updatedAt?: string
}

type Props = {
  asset: AssetIdentityAsset
}

const FALLBACK = '—'

function safeDisplay(value: string | null | undefined): string {
  if (value == null || value.trim() === '') return FALLBACK
  return value
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  const display = safeDisplay(value)
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className="font-medium text-sm text-right">{display}</span>
    </div>
  )
}

export default function AssetIdentityPanel({ asset }: Props) {
  return (
    <div className="border rounded p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Identity</h2>
      <div className="space-y-0">
        <Row label="System" value={asset?.system} />
        <Row label="Service" value={asset?.service} />
        <Row label="Criticality" value={asset?.criticality} />
        <Row label="Created" value={asset?.createdAt} />
        <Row label="Updated" value={asset?.updatedAt} />
      </div>
    </div>
  )
}
