import Link from 'next/link'
import { notFound } from 'next/navigation'
import SecurePage from '@/components/security/SecurePage'
import { requireAuth } from '@/utils/sessionUtils.server'
import DiffPageClient from './DiffPageClient'

type Params = Readonly<{
  id: string
  revisionId: string
}>

type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>

type PageProps = Readonly<{
  params: Promise<Params>
  searchParams: Promise<SearchParamsRecord>
}>

export default async function DiffPage({ params, searchParams }: PageProps) {
  await requireAuth()

  const { id, revisionId } = await params
  const sp = await searchParams

  const sheetId = Number.parseInt(id ?? '', 10)
  if (!Number.isFinite(sheetId) || sheetId <= 0) notFound()

  const selectedRevisionId = Number.parseInt(revisionId ?? '', 10)
  if (!Number.isFinite(selectedRevisionId) || selectedRevisionId <= 0) notFound()

  const compareToParam = Array.isArray(sp.compareTo) ? sp.compareTo[0] : sp.compareTo
  const compareToRevisionId = Number.parseInt(compareToParam ?? '', 10)

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      {!Number.isFinite(compareToRevisionId) || compareToRevisionId <= 0 ? (
        <div className="container mx-auto p-6 max-w-7xl">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Diff</h1>
            <Link
              href={`/datasheets/filled/${sheetId}/revisions`}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Revisions
            </Link>
          </div>
          <div className="bg-white rounded shadow p-6">
            <p className="text-red-600">
              Missing or invalid <code className="font-mono">compareTo</code> query parameter.
            </p>
          </div>
        </div>
      ) : (
        <DiffPageClient
          sheetId={sheetId}
          revisionId={selectedRevisionId}
          compareToRevisionId={compareToRevisionId}
        />
      )}
    </SecurePage>
  )
}

