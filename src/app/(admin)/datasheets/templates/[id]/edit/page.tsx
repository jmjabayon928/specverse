// src/app/(admin)/datasheets/templates/[id]/edit/page.tsx

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import SecurePage from '@/components/security/SecurePage'
import TemplateEditorForm from './TemplateEditorForm'
import { fetchReferenceOptions } from '@/backend/database/ReferenceQueries'
import { getTemplateDetailsById } from '@/backend/services/templateService'
import { mapToUnifiedSheet } from '@/utils/templateViewMapper'
import { requireAuth } from '@/utils/sessionUtils.server'

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
    fetchReferenceOptions(accountId),
    getTemplateDetailsById(templateId, 'eng', 'SI', accountId),
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
    <SecurePage requiredPermission='DATASHEET_EDIT'>
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
