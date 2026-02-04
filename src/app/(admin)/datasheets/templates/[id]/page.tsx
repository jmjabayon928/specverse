// src/app/(admin)/datasheets/templates/[id]/page.tsx

import SecurePage from '@/components/security/SecurePage'
import { PERMISSIONS } from '@/constants/permissions'
import { getTemplateDetailsById } from '@/backend/services/templateService'
import { requireAuth } from '@/utils/sessionUtils.server'
import TemplatePageClient from './TemplatePageClient'
import { notFound } from 'next/navigation'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'

type TemplateParams = Readonly<{
  id: string
}>

type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>

type TemplateDetailPageProps = Readonly<{
  params: Promise<TemplateParams>
  searchParams: Promise<SearchParamsRecord>
}>

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSheetTranslations(value: unknown): value is SheetTranslations {
  if (!isPlainObject(value)) {
    return false
  }

  const maybeSheet = (value as { sheet?: unknown }).sheet
  const maybeSubsheets = (value as { subsheets?: unknown }).subsheets
  const maybeLabels = (value as { labels?: unknown }).labels
  const maybeOptions = (value as { options?: unknown }).options

  const sheetOk =
    maybeSheet === undefined || isPlainObject(maybeSheet)
  const subsheetsOk =
    maybeSubsheets === undefined || isPlainObject(maybeSubsheets)
  const labelsOk =
    maybeLabels === undefined || isPlainObject(maybeLabels)
  const optionsOk =
    maybeOptions === undefined || isPlainObject(maybeOptions)

  return sheetOk && subsheetsOk && labelsOk && optionsOk
}

const resolveSheetId = async (paramsPromise: Promise<TemplateParams>): Promise<number> => {
  const { id } = await paramsPromise
  const parsed = Number.parseInt(id ?? '', 10)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    notFound()
  }

  return parsed
}

const resolveFilters = async (searchParamsPromise: Promise<SearchParamsRecord>) => {
  const searchParams = await searchParamsPromise

  const langParam = Array.isArray(searchParams.lang) ? searchParams.lang[0] : searchParams.lang
  const uomParam = Array.isArray(searchParams.uom) ? searchParams.uom[0] : searchParams.uom

  const defaultLanguage = langParam ?? 'eng'
  const defaultUnitSystem: 'SI' | 'USC' = uomParam === 'USC' ? 'USC' : 'SI'

  return {
    defaultLanguage,
    defaultUnitSystem,
  }
}

const TemplateDetailPage = async (props: TemplateDetailPageProps) => {
  const session = await requireAuth()
  const accountId = session.accountId
  if (accountId == null) notFound()

  const sheetId = await resolveSheetId(props.params)
  const { defaultLanguage, defaultUnitSystem } = await resolveFilters(props.searchParams)

  const result = await getTemplateDetailsById(sheetId, defaultLanguage, defaultUnitSystem, accountId)

  if (result == null) {
    notFound()
  }

  const { datasheet: template, translations } = result
  const safeTranslations: SheetTranslations | null = isSheetTranslations(translations)
    ? translations
    : null

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_VIEW}>
      <TemplatePageClient
        sheetId={sheetId}
        user={session}
        template={template}
        defaultLanguage={defaultLanguage}
        defaultUnitSystem={defaultUnitSystem}
        initialTranslations={safeTranslations}
      />
    </SecurePage>
  )
}

export default TemplateDetailPage
