// src/app/(admin)/datasheets/filled/[id]/revisions/page.tsx
import { notFound } from 'next/navigation'
import { requireAuth } from '@/utils/sessionUtils.server'
import SecurePage from '@/components/security/SecurePage'
import RevisionsListClient from './RevisionsListClient'

type PageProps = Readonly<{
  params: Promise<{ id: string }>
}>

export default async function RevisionsPage({ params }: PageProps) {
  const session = await requireAuth()
  const { id } = await params

  if (!id) notFound()

  const sheetId = Number.parseInt(id, 10)
  if (!Number.isFinite(sheetId) || sheetId <= 0) notFound()

  return (
    <SecurePage requiredPermission="DATASHEET_VIEW">
      <RevisionsListClient sheetId={sheetId} user={session} />
    </SecurePage>
  )
}
