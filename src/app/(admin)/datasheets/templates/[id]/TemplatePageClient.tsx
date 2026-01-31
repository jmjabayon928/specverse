// src/app/(admin)/datasheets/templates/[id]/TemplatePageClient.tsx
'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import SheetHeaderBar from '@/components/datasheets/SheetHeaderBar'
import TemplateActions from '@/components/datasheets/templates/TemplateActions'
import TemplateViewer from './TemplateViewer'
import { translations as labelTranslations } from '@/constants/translations'
import type { UserSession } from '@/domain/auth/sessionTypes'
import type {
  UnifiedSheet,
  SheetStatus,
} from '@/domain/datasheets/sheetTypes'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'

interface Props {
  sheetId: number
  user: UserSession
  template: UnifiedSheet
  defaultLanguage: string
  defaultUnitSystem: 'SI' | 'USC'
  initialTranslations: SheetTranslations | null
}

function getUILabel(key: string, language: string): string {
  return labelTranslations[key]?.[language] ?? key
}

const TemplatePageClient: React.FC<Props> = ({
  sheetId,
  user,
  template,
  defaultLanguage,
  defaultUnitSystem,
  initialTranslations,
}) => {
  const router = useRouter()

  const [lang, setLang] = useState<string>(defaultLanguage)
  const [unitSystem, setUnitSystem] =
    useState<'SI' | 'USC'>(defaultUnitSystem)

  // Restore language preference from cookie
  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('lang='))

    if (!cookie) {
      return
    }

    const [, value] = cookie.split('=')
    if (!value) {
      return
    }

    setLang(decodeURIComponent(value))
  }, [])

  // Restore unit system preference from cookie
  useEffect(() => {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith('unitSystem='))

    if (!cookie) {
      return
    }

    if (cookie.includes('USC')) {
      setUnitSystem('USC')
    }
  }, [])

  const [translatedTemplate, setTranslatedTemplate] =
    useState<UnifiedSheet>(template)
  const [translations, setTranslations] = useState<SheetTranslations | null>(
    initialTranslations
  )

  // Reload template when language or unit system changes
  useEffect(() => {
    if (lang === 'eng' && unitSystem === 'SI') {
      setTranslatedTemplate(template)
      setTranslations(initialTranslations)
      return
    }

    const fetchTemplateWithTranslations = async () => {
      try {
        const res = await fetch(
          `/api/backend/templates/${sheetId}?lang=${encodeURIComponent(
            lang
          )}&uom=${unitSystem}`,
          {
            cache: 'no-store',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          }
        )

        if (res.ok) {
          const data = await res.json()
          setTranslatedTemplate(data.datasheet)
          setTranslations(data.translations)
          return
        }

        throw new Error(
          `Failed to fetch translated template. Status: ${res.status}`
        )
      } catch (error: unknown) {
        // Keep the existing template visible if translation fetch fails
        console.error('Error loading translated template', error)
      }
    }

    void fetchTemplateWithTranslations()
  }, [lang, unitSystem, sheetId, template, initialTranslations])

  const handleLangChange = (newLang: string) => {
    document.cookie = `lang=${encodeURIComponent(
      newLang
    )}; path=/; max-age=31536000`
    setLang(newLang)
  }

  const handleUnitToggle = () => {
    const next: 'SI' | 'USC' = unitSystem === 'SI' ? 'USC' : 'SI'
    document.cookie = `unitSystem=${next}; path=/; max-age=31536000`
    setUnitSystem(next)
  }

  const viewerTranslations = {
    fieldLabelMap: translations?.labels,
    subsheetLabelMap: translations?.subsheets,
    sheetFieldMap: translations?.sheet,
    optionMap: translations?.options,
  }

  // Buttons inside TemplateViewer
  const handleAddNote = (id: number) => {
    router.push(`/datasheets/templates/${id}/notes/new`)
  }

  const handleAddAttachment = (id: number) => {
    router.push(`/datasheets/templates/${id}/attachments/new`)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
        <div className='flex items-start gap-4'>
          <div className='relative w-24 h-24 md:w-32 md:h-32'>
            <Image
              src={`/clients/${template.clientLogo}`}
              alt='Client Logo'
              fill
              className='object-contain'
              priority
            />
          </div>
          <div>
            <h1 className='text-xl font-semibold text-gray-900'>
              {getUILabel('Template', lang)} –{' '}
              {labelTranslations[template.status ?? 'Draft']?.[lang] ??
                template.status}
            </h1>
            <h1 className='text-xl font-semibold text-gray-900'>
              {translatedTemplate?.sheetName ?? template.sheetName}
            </h1>
            <h2 className='text-md text-gray-800'>
              {translatedTemplate?.sheetDesc}
            </h2>
            <h3 className='text-sm text-gray-600'>
              {translatedTemplate?.sheetDesc2}
            </h3>
            <p className='text-sm text-gray-500 mt-1'>
              {(template.disciplineName != null && template.disciplineName !== '') ||
              (template.subtypeName != null && template.subtypeName !== '')
                ? `${template.disciplineName ?? 'Unspecified'}${template.subtypeName != null && template.subtypeName !== '' ? ` · ${template.subtypeName}` : ''}`
                : '—'}
            </p>
          </div>
        </div>

        <div className='flex flex-col md:flex-row items-end md:items-center gap-2 md:gap-4'>
          <SheetHeaderBar
            selectedLang={lang}
            onLangChange={handleLangChange}
            unitSystem={unitSystem}
            onUnitToggle={handleUnitToggle}
          />
          <TemplateActions
            sheet={{
              sheetId,
              status:
                'Draft|Rejected|Modified Draft|Verified|Approved'.includes(
                  template.status ?? ''
                )
                  ? (template.status as SheetStatus)
                  : 'Draft',
              preparedBy: template.preparedById ?? 0,
              isTemplate: true,
            }}
            user={user}
            unitSystem={unitSystem}
            language={lang}
            clientName={template.clientName ?? 'Client'}
            sheetName={template.sheetName ?? 'Template'}
            revisionNum={template.revisionNum ?? 0}
          />
        </div>
      </div>

      {/* Viewer */}
      <TemplateViewer
        data={translatedTemplate}
        translations={viewerTranslations}
        language={lang}
        unitSystem={unitSystem}
        onAddNote={handleAddNote}
        onAddAttachment={handleAddAttachment}
      />
    </div>
  )
}

export default TemplatePageClient
