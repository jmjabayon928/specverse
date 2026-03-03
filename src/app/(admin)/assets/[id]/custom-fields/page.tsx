// src/app/(admin)/assets/[id]/custom-fields/page.tsx
import Link from 'next/link'
import { headers } from 'next/headers'

type CustomFieldRow = {
  customFieldId: number
  fieldKey: string
  displayLabel: string
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'json'
  value: string | number | boolean | null
}

const getBaseUrl = (h: Headers): string => {
  const host = h.get('host')
  if (!host) return 'http://localhost:3000'

  const protoHeader = h.get('x-forwarded-proto')
  const proto =
    protoHeader === 'https' || protoHeader === 'http'
      ? protoHeader
      : process.env.NODE_ENV === 'production'
        ? 'https'
        : 'http'

  return `${proto}://${host}`
}

const mustParseAssetId = (raw: string): number => {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) throw new Error('Invalid asset id')
  return n
}

export default async function AssetCustomFieldsPage(
  props: { params: { id: string } }
) {
  const assetId = mustParseAssetId(props.params.id)

  const h = await headers()
  const baseUrl = getBaseUrl(h)
  const cookie = h.get('cookie') ?? ''

  const res = await fetch(
    `${baseUrl}/api/backend/assets/${assetId}/custom-fields`,
    {
      method: 'GET',
      headers: {
        cookie,
      },
      cache: 'no-store',
    }
  )

  if (!res.ok) {
    throw new Error(`Failed to load custom fields (${res.status})`)
  }

  const rows = (await res.json()) as CustomFieldRow[]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Custom Fields</h1>
          <div className="text-sm text-gray-600">
            Asset ID <span className="font-medium">{assetId}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/assets/${assetId}`}
            className="text-sm text-blue-600 underline whitespace-nowrap"
          >
            Back to Asset 360
          </Link>
          <Link
            href="/assets"
            className="text-sm text-blue-600 underline whitespace-nowrap"
          >
            Back to MEL
          </Link>
        </div>
      </div>

      <div className="border rounded p-4">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-600">No custom fields found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-3">Label</th>
                  <th className="py-2 pr-3">Key</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.customFieldId} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium">{r.displayLabel}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.fieldKey}</td>
                    <td className="py-2 pr-3 text-gray-600">{r.dataType}</td>
                    <td className="py-2 pr-3">
                      {r.value == null ? '—' : String(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}