// src/utils/templateViewMapper.ts
import type { FullTemplateInput, UnifiedSheet } from '@/domain/datasheets/sheetTypes'

/**
 * Map FullTemplateInput from the template form into a UnifiedSheet shape.
 * This trusts that the datasheet payload matches the UnifiedSheet core fields.
 */
export const mapToUnifiedSheet = (input: FullTemplateInput): UnifiedSheet => {
  return {
    ...input.datasheet,
    subsheets: input.subsheets,
    isTemplate: input.isTemplate,
  } as UnifiedSheet
}
