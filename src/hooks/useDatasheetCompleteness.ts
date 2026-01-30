// src/hooks/useDatasheetCompleteness.ts
// Memoized completeness for filled datasheets (UX hints only).

import { useMemo } from 'react'
import { computeCompleteness } from '@/utils/datasheetCompleteness'
import type { CompletenessResult } from '@/utils/datasheetCompleteness'
import type { UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'

/**
 * Returns completeness for subsheet fields. When fieldValues is provided (edit mode),
 * it overrides field.value by field.id. Memoized; no side effects.
 */
export function useDatasheetCompleteness(
  subsheets: UnifiedSubsheet[],
  fieldValues?: Record<string, string>
): CompletenessResult {
  return useMemo(
    () => computeCompleteness(subsheets, fieldValues),
    [subsheets, fieldValues]
  )
}
