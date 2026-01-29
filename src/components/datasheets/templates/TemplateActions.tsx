// src/components/datasheets/templates/TemplateActions.tsx
'use client'

import React from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'
import type { MinimalSheetForActions } from '@/domain/datasheets/sheetTypes'
import IconTooltip from '@/components/ui/tooltip/IconTooltip'
import ExportSheetButtons from '@/components/datasheets/ExportSheetButtons'

type TemplateActionsProps = {
  sheet: MinimalSheetForActions
  user: UserSession
  unitSystem: 'SI' | 'USC'
  language: string
  clientName: string
  sheetName: string
  revisionNum: number
}

const hasPermissions = (user: UserSession | null | undefined) => {
  if (user === null || user === undefined) {
    return false
  }

  if (!Array.isArray(user.permissions)) {
    return false
  }

  return user.permissions.length > 0
}

const userHasPermission = (user: UserSession, permission: string) => {
  return user.permissions.includes(permission)
}

const canEditTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isCreator = user.userId === sheet.preparedBy

  const isEditableStatus =
    sheet.status === 'Draft' ||
    sheet.status === 'Modified Draft' ||
    sheet.status === 'Rejected'

  if (!isCreator) {
    return false
  }

  return isEditableStatus && userHasPermission(user, 'DATASHEET_EDIT')
}

const canVerifyTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isVerifiableStatus =
    sheet.status === 'Draft' ||
    sheet.status === 'Modified Draft'

  if (!isVerifiableStatus) {
    return false
  }

  return userHasPermission(user, 'DATASHEET_VERIFY')
}

const canApproveTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isVerified = sheet.status === 'Verified'
  if (!isVerified) {
    return false
  }

  return userHasPermission(user, 'DATASHEET_APPROVE')
}

const canCloneTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isApproved = sheet.status === 'Approved'
  if (!isApproved) {
    return false
  }

  return userHasPermission(user, 'DATASHEET_CREATE')
}

const canExportTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isApproved = sheet.status === 'Approved'
  if (!isApproved) {
    return false
  }

  return userHasPermission(user, 'DATASHEET_EXPORT')
}

const canCreateFilledFromTemplate = (user: UserSession, sheet: MinimalSheetForActions) => {
  const isApproved = sheet.status === 'Approved'
  if (!isApproved) {
    return false
  }

  const allowedPermissions = ['FILLED_CREATE', 'DATASHEET_CREATE', 'SHEET_CREATE']

  for (const permission of allowedPermissions) {
    if (userHasPermission(user, permission)) {
      return true
    }
  }

  return false
}

const TemplateActions = (props: Readonly<TemplateActionsProps>) => {
  const {
    sheet,
    user,
    unitSystem,
    language,
    clientName,
    sheetName,
    revisionNum,
  } = props

  const router = useRouter()
  const pathname = usePathname()

  const isUserReady = hasPermissions(user)
  const hasSheetDetails =
    typeof sheet?.sheetId === 'number' &&
    typeof sheet?.status === 'string'

  if (!isUserReady) {
    return null
  }

  if (!hasSheetDetails) {
    return null
  }

  const isTemplatesPath = pathname.includes('/datasheets/templates/')
  const isCreateRoute = pathname.includes('/create')
  const isDetailPage = isTemplatesPath && isCreateRoute === false

  const iconSize = isDetailPage ? 32 : 20
  const gapClass = isDetailPage ? 'gap-4' : 'gap-2'

  const canEdit = canEditTemplate(user, sheet)
  const canVerify = canVerifyTemplate(user, sheet)
  const canApprove = canApproveTemplate(user, sheet)
  const canDuplicate = canCloneTemplate(user, sheet)
  const canExport = canExportTemplate(user, sheet)
  const canCreateFilled = canCreateFilledFromTemplate(user, sheet)

  const goToEdit = () => {
    router.push(`/datasheets/templates/${sheet.sheetId}/edit`)
  }

  const goToVerify = () => {
    router.push(`/datasheets/templates/${sheet.sheetId}/verify`)
  }

  const goToApprove = () => {
    router.push(`/datasheets/templates/${sheet.sheetId}/approve`)
  }

  const goToClone = () => {
    router.push(`/datasheets/templates/${sheet.sheetId}/clone`)
  }

  const goToCreateFilled = () => {
    router.push(`/datasheets/filled/create?templateId=${sheet.sheetId}`)
  }

  return (
    <div className={`flex flex-wrap items-center ${gapClass}`}>
      {canEdit && (
        <IconTooltip label='Edit Template'>
          <button
            type='button'
            onClick={goToEdit}
            title='Edit Template'
          >
            <Image
              src='/images/edit.png'
              alt='Edit'
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canVerify && (
        <IconTooltip label='Verify or Reject'>
          <button
            type='button'
            onClick={goToVerify}
            title='Verify or Reject Template'
          >
            <Image
              src='/images/verify.png'
              alt='Verify'
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canApprove && (
        <IconTooltip label='Approve Template'>
          <button
            type='button'
            onClick={goToApprove}
            title='Approve Template'
          >
            <Image
              src='/images/approve.png'
              alt='Approve'
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canDuplicate && (
        <IconTooltip label='Clone Template'>
          <button
            type='button'
            onClick={goToClone}
            title='Clone Template'
          >
            <Image
              src='/images/duplicate.png'
              alt='Clone'
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canCreateFilled && (
        <IconTooltip label='Create Filled Sheet'>
          <button
            type='button'
            onClick={goToCreateFilled}
            title='Create Filled Sheet'
          >
            <Image
              src='/images/fill-up.png'
              alt='Create Filled Sheet'
              width={iconSize}
              height={iconSize}
            />
          </button>
        </IconTooltip>
      )}

      {canExport && (
        <ExportSheetButtons
          sheetId={sheet.sheetId}
          sheetName={sheetName}
          revisionNum={revisionNum}
          unitSystem={unitSystem}
          language={language}
          isTemplate
          clientName={clientName}
          iconSize={iconSize}
        />
      )}
    </div>
  )
}

export default TemplateActions
