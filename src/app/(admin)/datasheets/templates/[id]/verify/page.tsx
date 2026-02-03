// src/app/(admin)/datasheets/templates/[id]/verify/page.tsx

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTemplateDetailsById } from '@/backend/services/templateService'
import { requireAuth } from '@/utils/sessionUtils.server'
import TemplateViewer from '../TemplateViewer'
import VerifyForm from './VerifyForm'

export const metadata: Metadata = {
  title: 'Verify Template',
}

type TemplateVerifyPageParams = Readonly<{
  id: string
}>

type TemplateVerifyPageProps = Readonly<{
  params: Promise<TemplateVerifyPageParams>
}>

const parseTemplateId = (rawId: string | undefined): number => {
  const value = Number.parseInt(rawId ?? '', 10)

  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }

  return value
}

const TemplateVerifyPage = async (props: TemplateVerifyPageProps) => {
  const { id } = await props.params
  const templateId = parseTemplateId(id)

  if (Number.isNaN(templateId)) {
    notFound()
  }

  const sessionUser = await requireAuth()

  const canVerify = Array.isArray(sessionUser.permissions)
    && sessionUser.permissions.includes('TEMPLATE_VERIFY')

  if (!canVerify) {
    redirect('/unauthorized')
  }
  const accountId = sessionUser.accountId
  if (accountId == null) notFound()

  const rawData = await getTemplateDetailsById(templateId, 'eng', 'SI', accountId)

  if (rawData == null) {
    notFound()
  }

  return (
    <div className='container max-w-6xl py-6'>
      <h1 className='mb-6 text-2xl font-semibold'>
        Verify Template
      </h1>

      <TemplateViewer
        data={rawData.datasheet}
        unitSystem='SI'
        language='eng'
      />

      <VerifyForm sheetId={templateId} />
    </div>
  )
}

export default TemplateVerifyPage
