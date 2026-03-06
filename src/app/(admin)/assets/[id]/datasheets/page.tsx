// src/app/(admin)/assets/[id]/datasheets/page.tsx
import AssetHeader from '@/components/assets/AssetHeader'
import AssetTabs from '@/components/assets/AssetTabs'
import Link from 'next/link'
import { z } from 'zod'
import { cookies, headers } from 'next/headers'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
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
    throw new Error(`Asset with ID ${assetId} not found`) // Consistent error handling
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

type AssetDatasheetRow = {
  sheetId: number
  sheetName: string
  equipmentTagNum: string
  status: string
  revisionDate: string
}

const assetDatasheetQueryParamsSchema = z.object({
  q: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed.slice(0, 100)
    }),
  status: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed.slice(0, 50)
    }),
  take: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().min(1).max(200).optional()),
  skip: z
    .string()
    .optional()
    .transform(s => (s ? Number(s) : undefined))
    .pipe(z.number().int().min(0).optional()),
})

const fetchAssetDatasheets = async (
  assetId: number,
  query: Record<string, string | string[] | undefined>
): Promise<{ items: AssetDatasheetRow[]; total: number }> => {
  const baseUrl = await getBaseUrl()
  const c = await cookies()

  const parsed = assetDatasheetQueryParamsSchema.safeParse(query)
  if (!parsed.success) {
    console.error('Invalid query params for asset datasheets', parsed.error)
    return { items: [], total: 0 }
  }

  const url = new URL(`${baseUrl}/api/backend/assets/${assetId}/datasheets`)
  if (parsed.data.q) url.searchParams.set('q', parsed.data.q)
  if (parsed.data.status) url.searchParams.set('status', parsed.data.status)
  url.searchParams.set('take', String(parsed.data.take ?? 50))
  url.searchParams.set('skip', String(parsed.data.skip ?? 0))

  const res = await fetch(url.toString(), {
    headers: {
      cookie: c.toString(),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Failed to load datasheets (HTTP ${res.status})`)
  }

  const data = (await res.json()) as unknown
  if (data == null || typeof data !== 'object' || !('items' in data) || !('total' in data)) {
    throw new Error('Failed to load datasheets (invalid payload)')
  }

  return data as { items: AssetDatasheetRow[]; total: number }
}


export default async function AssetDatasheetsPage({ params, searchParams }: PageProps) {
  const assetId = parseAssetId(params.id)
  if (assetId == null) notFound()

  const asset = await fetchAssetById(assetId as number)

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

  const parsedQuery = assetDatasheetQueryParamsSchema.safeParse(searchParams)

  const initialQ = parsedQuery.success ? parsedQuery.data.q : undefined
  const initialStatus = parsedQuery.success ? parsedQuery.data.status : undefined
  const initialTake = parsedQuery.success && parsedQuery.data.take != null ? parsedQuery.data.take : 50
  const initialSkip = parsedQuery.success && parsedQuery.data.skip != null ? parsedQuery.data.skip : 0

  const { items: datasheets, total } = await fetchAssetDatasheets(
    assetId as number,
    parsedQuery.success
      ? { ...parsedQuery.data, take: parsedQuery.data.take?.toString(), skip: parsedQuery.data.skip?.toString() }
      : { take: initialTake.toString(), skip: initialSkip.toString() }
  )

  const hasMore = total > initialSkip + initialTake

  return (
    <div className="p-6 space-y-6">
      <AssetHeader asset={headerAsset} assetId={assetId as number} />
      <AssetTabs
        assetId={assetId as number}
        identityAsset={identityAsset}
        lastUpdated={asset.updatedAt ?? undefined}
        activeTab="datasheets"
      />
      <div className="p-6 bg-gray-50 rounded-md border border-gray-200">
        <form className="flex items-center justify-between mb-4" action={`/assets/${assetId}/datasheets`} method="GET">
          <div className="flex space-x-2">
            <input
              type="text"
              name="q"
              placeholder="Search datasheets..."
              defaultValue={initialQ}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="relative">
              <select
                name="status"
                defaultValue={initialStatus}
                className="appearance-none px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 pr-8"
                onChange={(e) => e.currentTarget.form?.submit()} // Submit form on change
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Modified Draft">Modified Draft</option>
                <option value="Verified">Verified</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">Apply Filters</button>
        </form>

        {datasheets.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No datasheets found for this asset.
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sheet Name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Equipment Tag</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revision Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {datasheets.map((sheet) => (
                  <tr key={sheet.sheetId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <Link href={`/datasheets/filled/${sheet.sheetId}`}>{sheet.sheetName}</Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sheet.equipmentTagNum}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sheet.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sheet.revisionDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <nav
              className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6"
              aria-label="Pagination"
            >
              <div className="hidden sm:block">
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{initialSkip + 1}</span> to <span className="font-medium">{Math.min(initialSkip + initialTake, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> results
                </p>
              </div>
              <div className="flex flex-1 justify-between sm:justify-end">
                <Link
                  href={{
                    pathname: `/assets/${assetId}/datasheets`,
                    query: { ...searchParams, skip: Math.max(0, initialSkip - initialTake) },
                  }}
                  replace
                  aria-disabled={initialSkip === 0}
                  className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </Link>
                <Link
                  href={{
                    pathname: `/assets/${assetId}/datasheets`,
                    query: { ...searchParams, skip: initialSkip + initialTake },
                  }}
                  replace
                  aria-disabled={!hasMore}
                  className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </Link>
              </div>
            </nav>
          </>
        )}
      </div>
    </div>
  )
}
