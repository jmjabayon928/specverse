// src/app/(admin)/datasheets/templates/[id]/clone/page.tsx

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import SecurePage from '@/components/security/SecurePage'
import { PERMISSIONS } from '@/constants/permissions'
import TemplateClonerForm from './TemplateClonerForm'
import { apiJson } from '@/utils/apiJson.server'
import { mapToUnifiedSheet } from '@/utils/templateViewMapper'
import { requireAuth } from '@/utils/sessionUtils.server'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

type TemplateClonePageParams = Readonly<{
  id: string
}>

type TemplateClonePageProps = Readonly<{
  params: Promise<TemplateClonePageParams>
}>

const parseTemplateId = (rawId: string | undefined): number => {
  const value = Number.parseInt(rawId ?? '', 10)

  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }

  return value
}

const TemplateClonePage = async (props: TemplateClonePageProps) => {
  const { id } = await props.params
  const templateId = parseTemplateId(id)

  if (Number.isNaN(templateId)) {
    notFound()
  }

  const session = await requireAuth()
  const accountId = session.accountId
  if (accountId == null) notFound()

  const refUrl = '/api/backend/references/references'
  const templateUrl = `/api/backend/templates/${templateId}?lang=eng&uom=SI`
  type RefData = { areas?: Array<{ id: number; name: string }>; manufacturers?: Array<{ id: number; name: string }>; suppliers?: Array<{ id: number; name: string }>; categories?: Array<{ id: number; name: string }>; clients?: Array<{ id: number; name: string }>; projects?: Array<{ id: number; name: string }> }
  const [sessionCookies, referenceData, templateData] = await Promise.all([
    cookies(),
    apiJson<RefData>(refUrl, { cache: 'no-store' }),
    apiJson<{ datasheet: UnifiedSheet; translations?: unknown }>(templateUrl, { cache: 'no-store' }, {
      assert: (v): v is { datasheet: UnifiedSheet; translations?: unknown } => typeof v === 'object' && v != null && typeof (v as { datasheet?: unknown }).datasheet === 'object' && (v as { datasheet?: unknown }).datasheet != null
    }),
  ])

  const token = sessionCookies.get('token')?.value ?? ''
  if (token.length === 0) {
    notFound()
  }

  const defaultValues = mapToUnifiedSheet({
    datasheet: templateData.datasheet,
    subsheets: templateData.datasheet.subsheets,
    isTemplate: true,
  })

  return (
    <SecurePage requiredPermission={PERMISSIONS.DATASHEET_EDIT}>
      <TemplateClonerForm
        defaultValues={defaultValues}
        areas={referenceData.areas?.map((area: { id: number; name: string }) => ({ label: area.name, value: area.id })) ?? []}
        manufacturers={referenceData.manufacturers?.map((manufacturer: { id: number; name: string }) => ({
          label: manufacturer.name,
          value: manufacturer.id,
        })) ?? []}
        suppliers={referenceData.suppliers?.map((supplier: { id: number; name: string }) => ({
          label: supplier.name,
          value: supplier.id,
        })) ?? []}
        categories={referenceData.categories?.map((category: { id: number; name: string }) => ({
          label: category.name,
          value: category.id,
        })) ?? []}
        clients={referenceData.clients?.map((client: { id: number; name: string }) => ({
          label: client.name,
          value: client.id,
        })) ?? []}
        projects={referenceData.projects?.map((project: { id: number; name: string }) => ({
          label: project.name,
          value: project.id,
        })) ?? []}
        session={token}
      />
    </SecurePage>
  )
}

export default TemplateClonePage
