// src/components/datasheets/filled/FilledSheetActions.tsx
'use client'

import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import type { UserSession } from '@/domain/auth/sessionTypes'
import type { MinimalSheetForActions } from '@/domain/datasheets/sheetTypes'
import IconTooltip from '@/components/ui/tooltip/IconTooltip'
import ExportSheetButtons from '@/components/datasheets/ExportSheetButtons'

interface FilledSheetActionsProps {
  sheet: MinimalSheetForActions
  user: UserSession
  unitSystem: 'SI' | 'USC'
  language: string
  clientName: string
  sheetName: string
  revisionNum: number
}

const editableStatuses = new Set(['Draft', 'Modified Draft', 'Rejected'])
const verifiableStatuses = new Set(['Draft', 'Modified Draft'])
const approvedStatus = 'Approved'
const verifiedStatus = 'Verified'

function hasPermission(user: UserSession, permission: string): boolean {
  return Array.isArray(user.permissions) && user.permissions.includes(permission)
}

export default function FilledSheetActions(props: Readonly<FilledSheetActionsProps>) {
  const { sheet, user, unitSystem, language, clientName, sheetName, revisionNum } = props

  const router = useRouter()
  const pathname = usePathname()

  const hasValidUser =
    Boolean(user) && Array.isArray(user.permissions) && user.permissions.length > 0

  if (!hasValidUser) {
    return null
  }

  const hasMinimumSheet =
    typeof sheet?.status === 'string' &&
    (typeof sheet?.sheetId === 'number' && sheet.sheetId > 0)

  if (!hasMinimumSheet) {
    return null
  }

  const { status } = sheet
  const isCreator = Boolean(user.userId && sheet.preparedBy === user.userId)

  const isDetailPage =
    pathname.includes('/datasheets/filled/') && !pathname.includes('/create')

  const iconSize = isDetailPage ? 32 : 20
  const gapClass = isDetailPage ? 'gap-4' : 'gap-2'

  const canEdit =
    isCreator &&
    editableStatuses.has(status) &&
    hasPermission(user, 'DATASHEET_EDIT')

  const canVerify =
    verifiableStatuses.has(status) &&
    hasPermission(user, 'DATASHEET_VERIFY')

  const canApprove =
    status === verifiedStatus && hasPermission(user, 'DATASHEET_APPROVE')

  const canDuplicate =
    status === approvedStatus && hasPermission(user, 'DATASHEET_CREATE')

  const canExport =
    status === approvedStatus && hasPermission(user, 'DATASHEET_EXPORT')

  return (
    <div className={`flex flex-wrap items-center ${gapClass}`}>
      {canEdit && (
        <IconTooltip label='Edit filled sheet'>
          <button
            type='button'
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/edit`)}
            title='Edit filled sheet'
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
        <IconTooltip label='Verify or reject'>
          <button
            type='button'
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/verify`)}
            title='Verify or reject filled sheet'
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
        <IconTooltip label='Approve filled sheet'>
          <button
            type='button'
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/approve`)}
            title='Approve filled sheet'
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
        <IconTooltip label='Clone filled sheet'>
          <button
            type='button'
            onClick={() => router.push(`/datasheets/filled/${sheet.sheetId}/clone`)}
            title='Clone filled sheet'
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

      {canExport && (
        <ExportSheetButtons
          sheetId={sheet.sheetId}
          sheetName={sheetName}
          revisionNum={revisionNum}
          unitSystem={unitSystem}
          language={language}
          isTemplate={false}
          clientName={clientName}
          iconSize={iconSize}
        />
      )}
    </div>
  )
}
