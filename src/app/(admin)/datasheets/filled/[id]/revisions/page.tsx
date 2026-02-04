// src/app/(admin)/datasheets/filled/[id]/revisions/page.tsx
import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { PERMISSIONS } from '@/constants/permissions'
import { requireAuth } from '@/utils/sessionUtils.server'
import SecurePage from '@/components/security/SecurePage'
import { getFilledSheetDetailsById } from '@/backend/services/filledSheetService'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'
import RevisionsListClient from './RevisionsListClient'

type PageProps = Readonly<{
  params: Promise<{ id: string }>
}>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSheetTranslations(value: unknown): value is SheetTranslations {
  if (!isPlainObject(value)) return false
  const v = value as { sheet?: unknown; subsheets?: unknown; labels?: unknown; options?: unknown }
  const sheetOk = v.sheet === undefined || isPlainObject(v.sheet)
  const subsheetsOk = v.subsheets === undefined || isPlainObject(v.subsheets)
  const labelsOk = v.labels === undefined || isPlainObject(v.labels)
  const optionsOk = v.options === undefined || isPlainObject(v.options)
  return sheetOk && subsheetsOk && labelsOk && optionsOk
}

export default async function RevisionsPage({ params }: PageProps) {
  const session = await requireAuth()
  const { id } = await params

  if (!id) notFound()

  const sheetId = Number.parseInt(id, 10)
  if (!Number.isFinite(sheetId) || sheetId <= 0) notFound()

  const cookieStore = await cookies()
  const langCookie = cookieStore.get('lang')?.value
  const defaultLanguage = langCookie ?? 'eng'
  const unitCookie = cookieStore.get('unitSystem')?.value
  const defaultUnitSystem = unitCookie === 'USC' ? ('USC' as const) : ('SI' as const)

  const accountId = session.accountId
  if (accountId == null) return notFound()

  const result = await getFilledSheetDetailsById(sheetId, defaultLanguage, defaultUnitSystem, accountId)
  const initialTranslations: SheetTranslations | null =
    result && isSheetTranslations(result.translations) ? result.translations : null

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      <RevisionsListClient
        sheetId={sheetId}
        user={session}
        defaultLanguage={defaultLanguage}
        defaultUnitSystem={defaultUnitSystem}
        initialTranslations={initialTranslations}
      />
    </SecurePage>
  )
}
