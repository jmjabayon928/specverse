// src/utils/templateViewMapper.ts

import type { FullTemplateInput, UnifiedSheet } from "@/types/sheet";

export function mapToUnifiedSheet(input: FullTemplateInput): UnifiedSheet {
  return {
    ...input.datasheet,
    subsheets: input.subsheets,
    isTemplate: input.isTemplate,
  } as UnifiedSheet;
}
