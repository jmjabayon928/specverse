// src/components/datasheets/ExportSheetButtons.tsx
'use client'

import Image from 'next/image'
import IconTooltip from '@/components/ui/tooltip/IconTooltip'
import { handleExport } from '@/utils/datasheetExport'

export interface ExportSheetButtonsProps {
  sheetId: number
  sheetName: string
  revisionNum: number
  clientName: string
  unitSystem: 'SI' | 'USC'
  language: string
  isTemplate: boolean
  isDetailPage?: boolean
  iconSize?: number
}

function getIconSize(
  explicitSize: number | undefined,
  isDetailPage: boolean | undefined
): number {
  if (typeof explicitSize === 'number') {
    return explicitSize
  }

  return isDetailPage ? 32 : 20
}

export default function ExportSheetButtons(props: Readonly<ExportSheetButtonsProps>) {
  const {
    sheetId,
    sheetName,
    revisionNum,
    clientName,
    unitSystem,
    language,
    isTemplate,
    isDetailPage,
    iconSize,
  } = props

  const computedSize = getIconSize(iconSize, isDetailPage)
  const isLarge = computedSize >= 32
  const sizeClass = isLarge ? 'w-8 h-8' : 'w-5 h-5'

  function handleClick(type: 'pdf' | 'excel') {
    handleExport({
      sheetId,
      type,
      unitSystem,
      language,
      sheetName,
      revisionNum,
      clientName,
      isTemplate,
    })
  }

  return (
    <div className='flex items-center gap-2'>
      <IconTooltip label='Export as PDF'>
        <button
          type='button'
          onClick={() => handleClick('pdf')}
          title='Export as PDF'
          className='hover:opacity-80 transition'
        >
          <Image
            src='/images/pdf.png'
            alt='PDF icon'
            width={computedSize}
            height={computedSize}
            className={sizeClass}
          />
        </button>
      </IconTooltip>

      <IconTooltip label='Export as Excel'>
        <button
          type='button'
          onClick={() => handleClick('excel')}
          title='Export as Excel'
          className='hover:opacity-80 transition'
        >
          <Image
            src='/images/xls.png'
            alt='Excel icon'
            width={computedSize}
            height={computedSize}
            className={sizeClass}
          />
        </button>
      </IconTooltip>
    </div>
  )
}
