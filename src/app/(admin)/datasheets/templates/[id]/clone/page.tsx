// src/app/(admin)/datasheets/templates/[id]/clone/page.tsx

import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import SecurePage from '@/components/security/SecurePage'
import TemplateClonerForm from './TemplateClonerForm'
import { fetchReferenceOptions } from '@/backend/database/ReferenceQueries'
import { getTemplateDetailsById } from '@/backend/services/templateService'
import { mapToUnifiedSheet } from '@/utils/templateViewMapper'

type TemplateClonePageParams = Readonly<{
  id: string
}>

type TemplateClonePageProps = Readonly<{
  params: TemplateClonePageParams
}>

const parseTemplateId = (rawId: string | undefined): number => {
  const value = Number.parseInt(rawId ?? '', 10)

  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }

  return value
}

const TemplateClonePage = async (props: TemplateClonePageProps) => {
  const templateId = parseTemplateId(props.params?.id)

  if (Number.isNaN(templateId)) {
    notFound()
  }

  const [sessionCookies, referenceData, templateData] = await Promise.all([
    cookies(),
    fetchReferenceOptions(),
    getTemplateDetailsById(templateId),
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
    <SecurePage requiredPermission='TEMPLATE_EDIT'>
      <TemplateClonerForm
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

export default TemplateClonePage
