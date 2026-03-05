// src/app/(admin)/assets/[id]/documents/page.tsx
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AssetHeader from '@/components/assets/AssetHeader'
import AssetTabs from '@/components/assets/AssetTabs'

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
  createdAt: string
  updatedAt: string
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
  let proto = 'http'
  if (protoHeader === 'https' || protoHeader === 'http') {
    proto = protoHeader
  } else if (process.env.NODE_ENV === 'production') {
    proto = 'https'
  }
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

export default async function AssetDocumentsPage({ params }: PageProps) {
  const assetId = parseAssetId(params.id)
  if (assetId == null) notFound()

  const asset = await fetchAssetById(assetId)

  const headerAsset = {
    assetId: asset.assetId,
    assetTag: asset.assetTag,
    assetName: asset.assetName ?? '',
    disciplineId: asset.disciplineId ?? undefined,
    location: asset.location ?? undefined,
    criticality: asset.criticality ?? undefined,
  }

  const identityAsset = {
    system: asset.system ?? undefined,
    service: asset.service ?? undefined,
    criticality: asset.criticality ?? undefined,
    createdAt: asset.createdAt ?? undefined,
    updatedAt: asset.updatedAt ?? undefined,
  }

  return (
    <div className="p-6 space-y-6">
      <AssetHeader asset={headerAsset} assetId={assetId} />
      <AssetTabs
        assetId={assetId}
        identityAsset={identityAsset}
        lastUpdated={asset.updatedAt ?? undefined}
        activeTab="documents-submittals"
      />
      <div className="p-6 bg-gray-50 rounded-md border border-gray-200">
        <p className="text-gray-600 mb-4">Coming soon</p>
        <p className="text-sm text-gray-500 mb-4">
          Documents and submittals for this asset will be available here.
        </p>
        <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
          <li>View documents and submittals linked to this asset</li>
          <li>Track document lifecycle and approvals</li>
          <li>Manage submittal packages</li>
        </ul>
      </div>
    </div>
  )
}
