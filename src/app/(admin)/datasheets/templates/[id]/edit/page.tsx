// src/app/(admin)/datasheets/templates/[id]/edit/page.tsx

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import SecurePage from '@/components/security/SecurePage'
import { PERMISSIONS } from '@/constants/permissions'
import TemplateEditorForm from './TemplateEditorForm'
import { apiJson } from '@/utils/apiJson.server'
import { mapToUnifiedSheet } from '@/utils/templateViewMapper'
import { requireAuth } from '@/utils/sessionUtils.server'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

type TemplateEditPageParams = Readonly<{
  id: string
}>

type TemplateEditPageProps = Readonly<{
  params: Promise<TemplateEditPageParams>
}>

const parseTemplateId = (rawId: string | undefined): number => {
  const value = Number.parseInt(rawId ?? '', 10)

  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }

  return value
}

const TemplateEditPage = async (props: TemplateEditPageProps) => {
  const { id } = await props.params
  const templateId = parseTemplateId(id)

  if (Number.isNaN(templateId)) {
    notFound()
  }

  const session = await requireAuth()
  const accountId = session.accountId
  if (accountId == null) notFound()

  const [sessionCookies, referenceData, templateData] = await Promise.all([
    cookies(),
    apiJson<{ areas: Array<{ id: number; name: string }>; manufacturers: Array<{ id: number; name: string }>; suppliers: Array<{ id: number; name: string }>; categories: Array<{ id: number; name: string }>; clients: Array<{ id: number; name: string }>; projects: Array<{ id: number; name: string }> }>(
      '/api/backend/templates/reference-options',
      { cache: 'no-store' }
    ),
    apiJson<{ datasheet: UnifiedSheet; translations: unknown }>(
      `/api/backend/templates/${templateId}?lang=eng`,
      { cache: 'no-store' }
    ),
  ])

  if (templateData == null) {
    notFound()
  }

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
      <TemplateEditorForm
        defaultValues={defaultValues}
        areas={referenceData.areas.map((area) => ({ label: area.name, value: area.id }))}
        manufacturers={referenceData.manufacturers.map((manufacturer) => ({
          label: manufacturer.name,
          value: manufacturer.id,
        }))}
        suppliers={referenceData.suppliers.map((supplier) => ({
          label: supplier.name,
          value: supplier.id,
        }))}
        categories={referenceData.categories.map((category) => ({
          label: category.name,
          value: category.id,
        }))}
        clients={referenceData.clients.map((client) => ({
          label: client.name,
          value: client.id,
        }))}
        projects={referenceData.projects.map((project) => ({
          label: project.name,
          value: project.id,
        }))}
        session={token}
      />
    </SecurePage>
  )
}

export default TemplateEditPage
