// src/app/(admin)/datasheets/templates/[id]/verify/page.tsx

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { PERMISSIONS } from '@/constants/permissions'
import { apiJson } from '@/utils/apiJson.server'
import { requireAuth } from '@/utils/sessionUtils.server'
import TemplateViewer from '../TemplateViewer'
import VerifyForm from './VerifyForm'
import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'

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
    && sessionUser.permissions.includes(PERMISSIONS.DATASHEET_VERIFY)

  if (!canVerify) {
    redirect('/unauthorized')
  }
  const accountId = sessionUser.accountId
  if (accountId == null) notFound()

  const url = `/api/backend/templates/${templateId}?lang=eng&uom=SI`
  const rawData = await apiJson<{ datasheet: UnifiedSheet; translations?: unknown }>(url, { cache: 'no-store' }, {
    assert: (v): v is { datasheet: UnifiedSheet; translations?: unknown } => typeof v === 'object' && v != null && typeof (v as { datasheet?: unknown }).datasheet === 'object' && (v as { datasheet?: unknown }).datasheet != null
  })

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
