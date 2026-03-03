// src/app/(admin)/assets/[id]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'

type PageProps = {
  params: { id: string }
}

type AssetDetail = {
  assetId: number
  assetTag: string
  assetName: string | null
  location: string | null
  system: string | null
  service: string | null
  criticality: string | null
  disciplineId: number | null
  subtypeId: number | null
  clientId: number | null
  projectId: number | null
}

const parseAssetId = (raw: string): number | null => {
  const id = Number(raw)
  if (Number.isInteger(id) && id > 0) return id
  return null
}

const getBaseUrl = async (): Promise<string> => {
  const h = await headers()
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

const fetchAssetById = async (assetId: number): Promise<AssetDetail> => {
  const baseUrl = await getBaseUrl()
  const c = await cookies()

  const res = await fetch(`${baseUrl}/api/backend/assets/${assetId}`, {
    headers: {
      cookie: c.toString(),
    },
    cache: 'no-store',
  })

  if (res.status === 404) {
    notFound()
  }

  if (!res.ok) {
    throw new Error(`Failed to load asset (HTTP ${res.status})`)
  }

  const data = (await res.json()) as unknown

  if (data == null || typeof data !== 'object') {
    throw new Error('Failed to load asset (invalid payload)')
  }

  return data as AssetDetail
}

export default async function AssetDetailPage({ params }: PageProps) {
  const assetId = parseAssetId(params.id)
  if (assetId == null) notFound()

  const asset = await fetchAssetById(assetId)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Asset 360</h1>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{asset.assetTag}</span>
            {asset.assetName ? <span> · {asset.assetName}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/assets"
            className="text-sm text-blue-600 underline whitespace-nowrap"
          >
            Back to MEL
          </Link>
        </div>
      </div>

      <div className="border-b pb-3">
        <div className="flex gap-6 text-sm">
          <Link
            href={`/assets/${assetId}`}
            className="font-medium text-gray-900"
          >
            Overview
          </Link>

          <Link
            href={`/assets/${assetId}/custom-fields`}
            className="text-blue-600 underline"
          >
            Custom Fields
          </Link>
        </div>
      </div>

      <div className="border rounded p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-600">Asset Tag</div>
            <div className="font-medium">{asset.assetTag}</div>
          </div>

          <div>
            <div className="text-gray-600">Asset Name</div>
            <div className="font-medium">{asset.assetName ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Location</div>
            <div className="font-medium">{asset.location ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">System</div>
            <div className="font-medium">{asset.system ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Service</div>
            <div className="font-medium">{asset.service ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Criticality</div>
            <div className="font-medium">{asset.criticality ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Discipline ID</div>
            <div className="font-medium">{asset.disciplineId ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Subtype ID</div>
            <div className="font-medium">{asset.subtypeId ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Client ID</div>
            <div className="font-medium">{asset.clientId ?? '—'}</div>
          </div>

          <div>
            <div className="text-gray-600">Project ID</div>
            <div className="font-medium">{asset.projectId ?? '—'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}