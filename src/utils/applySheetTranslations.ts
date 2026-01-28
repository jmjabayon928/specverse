// src/utils/applySheetTranslations.ts

import type { UnifiedSheet } from '@/domain/datasheets/sheetTypes'
import type { SheetTranslations } from '@/domain/i18n/translationTypes'

export const applySheetTranslations = (
  sheet: UnifiedSheet,
  translations: SheetTranslations | null
): UnifiedSheet => {
  if (!translations) {
    return sheet
  }

  const {
    sheet: sheetLabelMap,
    subsheets: subsheetLabelMap,
    labels: fieldLabelMap,
    options: optionLabelMap,
  } = translations

  return {
    ...sheet,
    sheetName: sheetLabelMap?.sheetName ?? sheet.sheetName,
    sheetDesc: sheetLabelMap?.sheetDesc ?? sheet.sheetDesc,
    sheetDesc2: sheetLabelMap?.sheetDesc2 ?? sheet.sheetDesc2,
    equipmentName: sheetLabelMap?.equipmentName ?? sheet.equipmentName,
    serviceName: sheetLabelMap?.serviceName ?? sheet.serviceName,

    subsheets: sheet.subsheets.map((subsheet) => {
      const templateSubId = subsheet.originalId ?? subsheet.id ?? -1

      if (templateSubId === -1) {
        return subsheet
      }

      const translatedSubName = subsheetLabelMap?.[String(templateSubId)]

      const translatedFields = subsheet.fields.map((field) => {
        const templateFieldId = field.originalId ?? field.id ?? -1

        if (templateFieldId === -1) {
          return field
        }

        const translatedLabel = fieldLabelMap?.[String(templateFieldId)]
        const translatedOptions = optionLabelMap?.[String(templateFieldId)]

        return {
          ...field,
          label: translatedLabel ?? field.label,
          options: translatedOptions ?? field.options ?? [],
        }
      })

      return {
        ...subsheet,
        name: translatedSubName ?? subsheet.name,
        fields: translatedFields,
      }
    }),
  }
}
