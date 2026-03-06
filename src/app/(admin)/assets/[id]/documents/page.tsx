// src/app/(admin)/assets/[id]/documents/page.tsx
import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import AssetHeader from '@/components/assets/AssetHeader'
import AssetTabs from '@/components/assets/AssetTabs'
import Link from 'next/link'
import { z } from 'zod'

type PageProps = {
  params: { id: string }
  searchParams: { [key: string]: string | string[] | undefined }
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

type AssetDocumentRow = {
  attachmentId: number
  filename: string
  contentType: string
  filesize: number
  uploadedAt: string
  uploadedBy: number
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
    throw new Error(`Asset with ID ${assetId} not found`)
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

const assetDocumentQueryParamsSchema = z.object({
  q: z
    .string()
    .optional()
    .transform(s => {
      if (s == null) return undefined
      const trimmed = s.trim()
      return trimmed === '' ? undefined : trimmed.slice(0, 200)
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

const fetchAssetDocuments = async (
  assetId: number,
  query: Record<string, string | string[] | undefined>
): Promise<{ items: AssetDocumentRow[]; total: number }> => {
  const baseUrl = await getBaseUrl()
  const c = await cookies()

  const parsed = assetDocumentQueryParamsSchema.safeParse(query)
  if (!parsed.success) {
    console.error('Invalid query params for asset documents', parsed.error)
    return { items: [], total: 0 }
  }

  const url = new URL(`${baseUrl}/api/backend/assets/${assetId}/documents`)
  if (parsed.data.q) url.searchParams.set('q', parsed.data.q)
  url.searchParams.set('take', String(parsed.data.take ?? 50))
  url.searchParams.set('skip', String(parsed.data.skip ?? 0))

  const res = await fetch(url.toString(), {
    headers: {
      cookie: c.toString(),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Failed to load documents (HTTP ${res.status})`)
  }

  const data = (await res.json()) as unknown
  if (data == null || typeof data !== 'object' || !('items' in data) || !('total' in data)) {
    throw new Error('Failed to load documents (invalid payload)')
  }

  return data as { items: AssetDocumentRow[]; total: number }
}

export default async function AssetDocumentsPage({ params, searchParams }: PageProps) {
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

  const parsedQuery = assetDocumentQueryParamsSchema.safeParse(searchParams)

  const initialQ = parsedQuery.success ? parsedQuery.data.q : undefined
  const initialTake = parsedQuery.success && parsedQuery.data.take != null ? parsedQuery.data.take : 50
  const initialSkip = parsedQuery.success && parsedQuery.data.skip != null ? parsedQuery.data.skip : 0

  const { items: documents, total } = await fetchAssetDocuments(
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
        activeTab="documents-submittals"
      />
      <div className="p-6 bg-gray-50 rounded-md border border-gray-200">
        <form className="flex items-center justify-between mb-4" action={`/assets/${assetId}/documents`} method="GET">
          <div className="flex space-x-2">
            <input
              type="text"
              name="q"
              placeholder="Search documents..."
              defaultValue={initialQ}
              className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500">Apply Filters</button>
        </form>

        <form
          className="mb-4 p-4 border rounded-md bg-white flex items-center space-x-2"
          action={`/api/backend/assets/${assetId}/documents/link`}
          method="POST"
        >
          <label htmlFor="attachmentId" className="text-sm font-medium text-gray-700">Link Existing Attachment ID:</label>
          <input
            type="number"
            id="attachmentId"
            name="attachmentId"
            placeholder="Enter Attachment ID"
            required
            min="1"
            className="flex-grow px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500">Link</button>
        </form>

        {documents.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No documents found for this asset.
          </div>
        ) : (
          <>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Type</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filesize</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded At</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((doc) => (
                  <tr key={doc.attachmentId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{doc.filename}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.contentType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{doc.filesize} bytes</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <form
                        action={`/api/backend/assets/${assetId}/documents/${doc.attachmentId}`}
                        method="POST"
                        className="inline-block"
                      >
                        <input type="hidden" name="_method" value="DELETE" /> {/* Method override for DELETE verb */}
                        <button
                          type="submit"
                          className="text-red-600 hover:text-red-900 ml-4"
                        >
                          Unlink
                        </button>
                      </form>
                    </td>
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
                    pathname: `/assets/${assetId}/documents`,
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
                    pathname: `/assets/${assetId}/documents`,
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
