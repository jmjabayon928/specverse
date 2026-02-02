// src/app/(admin)/datasheets/templates/[id]/approve/page.tsx

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTemplateDetailsById } from '@/backend/services/templateService'
import { requireAuth } from '@/utils/sessionUtils.server'
import { canSeeApproveUI } from '@/utils/approveGating'
import TemplateViewer from '../TemplateViewer'
import ApproveButton from './ApproveButton'

export const metadata: Metadata = {
  title: 'Approve Template',
}

type TemplateApprovePageParams = Readonly<{
  id: string
}>

type TemplateApprovePageProps = Readonly<{
  params: Promise<TemplateApprovePageParams>
}>

const parseTemplateId = (rawId: string | undefined): number => {
  const value = Number.parseInt(rawId ?? '', 10)

  if (!Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }

  return value
}

const TemplateApprovePage = async (props: TemplateApprovePageProps) => {
  const { id } = await props.params
  const templateId = parseTemplateId(id)

  if (Number.isNaN(templateId)) {
    notFound()
  }

  const sessionUser = await requireAuth()

  if (!canSeeApproveUI(sessionUser)) {
    redirect('/unauthorized')
  }

  const rawData = await getTemplateDetailsById(templateId)

  if (rawData == null) {
    notFound()
  }

  return (
    <div className='container max-w-6xl py-6'>
      <h1 className='mb-6 text-2xl font-semibold'>
        Approve Template
      </h1>

      <TemplateViewer
        data={rawData.datasheet}
        unitSystem='SI'
        language='eng'
      />

      <ApproveButton sheetId={templateId} />
    </div>
  )
}

export default TemplateApprovePage
