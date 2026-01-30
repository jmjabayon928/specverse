// src/utils/datasheetCompleteness.ts
// Read-only completeness hints for filled datasheets (UX only; no validation).

import type { InfoField, UnifiedSubsheet } from '@/domain/datasheets/sheetTypes'

export interface SubsheetCompleteness {
  subName: string
  totalRequired: number
  filledRequired: number
}

export interface CompletenessResult {
  totalRequired: number
  filledRequired: number
  /** Keyed by subsheet id (or originalId, or index fallback) for stable lookup. */
  bySubsheet: Record<string, SubsheetCompleteness>
}

/**
 * Stable key for a subsheet: id, then originalId, then index fallback.
 * Use when looking up completeness.bySubsheet[key].
 */
export function getSubsheetKey(sub: UnifiedSubsheet, index: number): string {
  const id = sub.id ?? sub.originalId
  return id !== undefined && id !== null ? String(id) : String(index)
}

/**
 * Returns true iff the field is required and its value is missing or blank.
 * Numeric 0 is considered complete.
 */
function isIncomplete(field: InfoField, value: string | number | null | undefined): boolean {
  if (!field.required) return false
  if (value === undefined || value === null) return true
  const s = String(value).trim()
  return s === ''
}

/**
 * Resolve value for a field: use fieldValues[field.id] when provided (edit mode), else field.value.
 */
function getEffectiveValue(
  field: InfoField,
  fieldValues?: Record<string, string>
): string | number | null | undefined {
  if (fieldValues != null && field.id !== undefined) {
    const v = fieldValues[String(field.id)]
    return v !== undefined ? v : field.value
  }
  return field.value
}

/**
 * Compute completeness for subsheet fields only (no header/equipment).
 * When fieldValues is provided (edit mode), it overrides field.value by field.id.
 */
export function computeCompleteness(
  subsheets: UnifiedSubsheet[],
  fieldValues?: Record<string, string>
): CompletenessResult {
  const bySubsheet: Record<string, SubsheetCompleteness> = {}
  let totalRequired = 0
  let filledRequired = 0

  subsheets.forEach((sub, index) => {
    let subTotal = 0
    let subFilled = 0
    for (const field of sub.fields) {
      if (!field.required) continue
      subTotal += 1
      const value = getEffectiveValue(field, fieldValues)
      if (!isIncomplete(field, value)) subFilled += 1
    }
    const key = getSubsheetKey(sub, index)
    bySubsheet[key] = {
      subName: sub.name,
      totalRequired: subTotal,
      filledRequired: subFilled,
    }
    totalRequired += subTotal
    filledRequired += subFilled
  })

  return { totalRequired, filledRequired, bySubsheet }
}
