// src/utils/templateViewMapper.ts

import type { FullTemplateInput, UnifiedSheet } from "@/domain/datasheets/sheetTypes";

export function mapToUnifiedSheet(input: FullTemplateInput): UnifiedSheet {
  return {
    ...input.datasheet,
    subsheets: input.subsheets,
    isTemplate: input.isTemplate,
  } as UnifiedSheet;
}
