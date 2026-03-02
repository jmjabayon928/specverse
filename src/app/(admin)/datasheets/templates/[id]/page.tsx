// src/app/(admin)/datasheets/templates/[id]/page.tsx

import { cookies } from 'next/headers'
import SecurePage from '@/components/security/SecurePage'
import { PERMISSIONS } from '@/constants/permissions'
import { apiJson } from '@/utils/apiJson.server'
import { requireAuth } from '@/utils/sessionUtils.server'
import TemplatePageClient from './TemplatePageClient'
import { notFound } from 'next/navigation'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

type TemplateParams = Readonly<{
  id: string
}>

type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>

type TemplateDetailPageProps = Readonly<{
  params: Promise<TemplateParams>
  searchParams: Promise<SearchParamsRecord>
}>

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

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

  const cookieStore = await cookies()
  const langCookie = cookieStore.get('lang')
  const unitCookie = cookieStore.get('unitSystem')
  const cookieLang = langCookie?.value ? safeDecode(langCookie.value) : undefined
  const cookieUnit = unitCookie?.value
    ? (unitCookie.value.trim().toUpperCase() === 'USC' ? 'USC' : 'SI')
    : undefined
  const initialLang = cookieLang ?? defaultLanguage
  const initialUnitSystem = cookieUnit ?? defaultUnitSystem

  const url = `/api/backend/templates/${sheetId}?lang=${encodeURIComponent(defaultLanguage)}&uom=${encodeURIComponent(defaultUnitSystem)}`
  const result = await apiJson<{ datasheet: UnifiedSheet; translations?: unknown }>(url, { cache: 'no-store' }, {
    assert: (v): v is { datasheet: UnifiedSheet; translations?: unknown } => typeof v === 'object' && v != null && typeof (v as { datasheet?: unknown }).datasheet === 'object' && (v as { datasheet?: unknown }).datasheet != null
  })
  const template = result.datasheet
  const translations = result.translations ?? null
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
        initialLang={initialLang}
        initialUnitSystem={initialUnitSystem}
        initialTranslations={safeTranslations}
      />
    </SecurePage>
  )
}

export default TemplateDetailPage
