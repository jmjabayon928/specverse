// src/utils/applySheetTranslations.ts

import type { UnifiedSheet } from "@/types/sheet";
import type { SheetTranslations } from "@/types/translation";

export function applySheetTranslations(
  sheet: UnifiedSheet,
  translations: SheetTranslations | null
): UnifiedSheet {
  if (!translations) return sheet;

  /*
  console.log("🧾 Applying Translations:");
  console.log("➡️ Sheet-Level Labels:", translations.sheet);
  console.log("➡️ Subsheet Labels:", translations.subsheets);
  console.log("➡️ Field Labels:", translations.labels);
  console.log("➡️ Option Labels:", translations.options);
  */

  const {
    sheet: sheetLabelMap,
    subsheets: subsheetLabelMap,
    labels: fieldLabelMap,
    options: optionLabelMap,
  } = translations;

  return {
    ...sheet,
    sheetName: sheetLabelMap?.sheetName ?? sheet.sheetName,
    sheetDesc: sheetLabelMap?.sheetDesc ?? sheet.sheetDesc,
    sheetDesc2: sheetLabelMap?.sheetDesc2 ?? sheet.sheetDesc2,
    equipmentName: sheetLabelMap?.equipmentName ?? sheet.equipmentName,
    serviceName: sheetLabelMap?.serviceName ?? sheet.serviceName,

    subsheets: sheet.subsheets.map((subsheet) => {
      const templateSubId = subsheet.originalId ?? subsheet.id ?? -1;
      const translatedSubName =
        templateSubId !== -1 ? subsheetLabelMap?.[String(templateSubId)] : undefined;

      /*
      console.log("🔠 Subsheet ID Mapping:", {
        subsheetName: subsheet.name,
        originalId: subsheet.originalId,
        id: subsheet.id,
        resolvedId: templateSubId,
        translatedName: translatedSubName,
      });
      */

      const translatedFields = subsheet.fields.map((field) => {
        const templateFieldId = field.originalId ?? field.id ?? -1;
        const translatedLabel = templateFieldId !== -1 ? fieldLabelMap?.[String(templateFieldId)] : undefined;
        const translatedOptions = templateFieldId !== -1 ? optionLabelMap?.[String(templateFieldId)] : undefined;

        /*
        console.log("🏷️ Field ID Mapping:", {
          fieldLabel: field.label,
          originalId: field.originalId,
          id: field.id,
          resolvedId: templateFieldId,
          translatedLabel,
        });
        */

        return {
          ...field,
          label: translatedLabel ?? field.label,
          options: translatedOptions ?? field.options ?? [],
        };
      });

      return {
        ...subsheet,
        name: translatedSubName ?? subsheet.name,
        fields: translatedFields,
      };
    }),
  };
}
